import { db } from "@/lib/db";
import { $Enums } from "@/generated/prisma/client";
import { requireAdmittedTicket } from "@/lib/queue";

export class OrderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Release inventory held by orders whose reservation window has passed. */
export async function expireStaleOrders(eventId?: string) {
  const now = new Date();
  const stale = await db.order.findMany({
    where: {
      status: $Enums.OrderStatus.PENDING,
      expiresAt: { lt: now },
      ...(eventId ? { eventId } : {}),
    },
    include: { items: true },
  });

  for (const order of stale) {
    await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== $Enums.OrderStatus.PENDING) return;

      for (const item of order.items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { remainingQty: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: $Enums.OrderStatus.EXPIRED },
      });
    });
  }
}

type CartItem = { ticketTypeId: string; quantity: number };

/**
 * Reserve inventory and create a PENDING order. Uses a conditional UPDATE
 * (`remainingQty >= quantity`) as a compare-and-swap so concurrent buyers
 * racing for the last seats never oversell, regardless of how many requests
 * arrive at once.
 */
export async function createOrder(userId: string, eventId: string, items: CartItem[]) {
  if (items.length === 0) throw new OrderError("EMPTY_CART", "No tickets selected");

  await expireStaleOrders(eventId);

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) throw new OrderError("NOT_FOUND", "Event not found");

  const now = new Date();
  if (now < event.saleStartAt) throw new OrderError("SALE_NOT_STARTED", "Sale has not started");
  if (now > event.saleEndAt) throw new OrderError("SALE_ENDED", "Sale has ended");

  if (event.queueEnabled) {
    const ticket = await requireAdmittedTicket(eventId, userId);
    if (!ticket) {
      throw new OrderError("QUEUE_REQUIRED", "You must be admitted from the waiting room first");
    }
  }

  const ticketTypes = await db.ticketType.findMany({
    where: { id: { in: items.map((i) => i.ticketTypeId) }, eventId },
  });
  const ticketTypeMap = new Map(ticketTypes.map((t) => [t.id, t]));

  for (const item of items) {
    const tt = ticketTypeMap.get(item.ticketTypeId);
    if (!tt) throw new OrderError("NOT_FOUND", "Ticket type not found");
    if (item.quantity <= 0) throw new OrderError("INVALID_QTY", "Quantity must be positive");
    if (item.quantity > tt.maxPerOrder) {
      throw new OrderError("LIMIT_EXCEEDED", `Max ${tt.maxPerOrder} per order for ${tt.name}`);
    }
  }

  const order = await db.$transaction(async (tx) => {
    for (const item of items) {
      const result = await tx.ticketType.updateMany({
        where: { id: item.ticketTypeId, remainingQty: { gte: item.quantity } },
        data: { remainingQty: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        const tt = ticketTypeMap.get(item.ticketTypeId)!;
        throw new OrderError("SOLD_OUT", `${tt.name} is sold out`);
      }
    }

    const totalCents = items.reduce((sum, item) => {
      const tt = ticketTypeMap.get(item.ticketTypeId)!;
      return sum + tt.priceCents * item.quantity;
    }, 0);

    const created = await tx.order.create({
      data: {
        userId,
        eventId,
        totalCents,
        expiresAt: new Date(now.getTime() + event.holdMinutes * 60_000),
        items: {
          create: items.map((item) => ({
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity,
            unitCents: ticketTypeMap.get(item.ticketTypeId)!.priceCents,
          })),
        },
      },
      include: { items: { include: { ticketType: true } } },
    });

    if (event.queueEnabled) {
      await tx.queueTicket.update({
        where: { eventId_userId: { eventId, userId } },
        data: { status: $Enums.QueueStatus.USED },
      });
    }

    return created;
  });

  return order;
}

export async function payOrder(userId: string, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) throw new OrderError("NOT_FOUND", "Order not found");
  if (order.status === $Enums.OrderStatus.EXPIRED) {
    throw new OrderError("EXPIRED", "This order has expired, the hold was released");
  }
  if (order.status !== $Enums.OrderStatus.PENDING) {
    throw new OrderError("INVALID_STATE", "Order is not payable");
  }
  if (order.expiresAt.getTime() < Date.now()) {
    await expireStaleOrders(order.eventId);
    throw new OrderError("EXPIRED", "This order has expired, the hold was released");
  }

  return db.order.update({
    where: { id: orderId },
    data: { status: $Enums.OrderStatus.PAID, paidAt: new Date() },
  });
}

export async function cancelOrder(userId: string, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.userId !== userId) throw new OrderError("NOT_FOUND", "Order not found");
  if (order.status !== $Enums.OrderStatus.PENDING) {
    throw new OrderError("INVALID_STATE", "Order can no longer be cancelled");
  }

  await db.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.ticketType.update({
        where: { id: item.ticketTypeId },
        data: { remainingQty: { increment: item.quantity } },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: $Enums.OrderStatus.CANCELLED } });
  });
}

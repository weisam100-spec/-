import { db } from "@/lib/db";
import { $Enums } from "@/generated/prisma/client";

/**
 * Virtual waiting room.
 *
 * Everyone who wants to buy tickets for a queue-enabled event first joins a
 * FIFO line (QueueTicket, status WAITING). We only ever let up to
 * `admitBatchSize` people be ADMITTED (allowed onto the checkout page) at
 * once, and we only top the batch up every `admitIntervalSec` seconds. An
 * admitted slot expires after `admitWindowMinutes` if the person doesn't
 * finish checkout, freeing it for the next person in line. This keeps
 * checkout traffic bounded and purchase order fair, without needing a
 * separate job queue or Redis.
 */

export async function joinQueue(eventId: string, userId: string) {
  const existing = await db.queueTicket.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });

  if (existing && existing.status !== $Enums.QueueStatus.EXPIRED) {
    return existing;
  }

  return db.$transaction(async (tx) => {
    const count = await tx.queueTicket.count({ where: { eventId } });
    const position = count + 1;

    if (existing) {
      return tx.queueTicket.update({
        where: { id: existing.id },
        data: {
          position,
          status: $Enums.QueueStatus.WAITING,
          admittedAt: null,
          expiresAt: null,
        },
      });
    }

    return tx.queueTicket.create({
      data: {
        token: crypto.randomUUID(),
        eventId,
        userId,
        position,
        status: $Enums.QueueStatus.WAITING,
      },
    });
  });
}

export async function admitNext(eventId: string) {
  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });
  const now = new Date();

  // Free up slots whose holders never completed checkout in time.
  await db.queueTicket.updateMany({
    where: {
      eventId,
      status: $Enums.QueueStatus.ADMITTED,
      expiresAt: { lt: now },
    },
    data: { status: $Enums.QueueStatus.EXPIRED },
  });

  const activeAdmitted = await db.queueTicket.count({
    where: { eventId, status: $Enums.QueueStatus.ADMITTED },
  });
  const capacity = event.admitBatchSize - activeAdmitted;
  if (capacity <= 0) return;

  const lastAdmitted = await db.queueTicket.findFirst({
    where: { eventId, admittedAt: { not: null } },
    orderBy: { admittedAt: "desc" },
  });
  if (lastAdmitted?.admittedAt) {
    const elapsedMs = now.getTime() - lastAdmitted.admittedAt.getTime();
    if (elapsedMs < event.admitIntervalSec * 1000) return;
  }

  const next = await db.queueTicket.findMany({
    where: { eventId, status: $Enums.QueueStatus.WAITING },
    orderBy: { position: "asc" },
    take: capacity,
  });
  if (next.length === 0) return;

  const expiresAt = new Date(now.getTime() + event.admitWindowMinutes * 60_000);
  await db.queueTicket.updateMany({
    where: { id: { in: next.map((t) => t.id) } },
    data: { status: $Enums.QueueStatus.ADMITTED, admittedAt: now, expiresAt },
  });
}

export async function getQueueStatus(eventId: string, userId: string) {
  await admitNext(eventId);

  const ticket = await db.queueTicket.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!ticket) return null;

  if (ticket.status === $Enums.QueueStatus.WAITING) {
    const ahead = await db.queueTicket.count({
      where: {
        eventId,
        status: $Enums.QueueStatus.WAITING,
        position: { lt: ticket.position },
      },
    });
    return { ...ticket, peopleAhead: ahead };
  }

  return { ...ticket, peopleAhead: 0 };
}

export async function requireAdmittedTicket(eventId: string, userId: string) {
  const ticket = await db.queueTicket.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (!ticket) return null;
  if (ticket.status !== $Enums.QueueStatus.ADMITTED) return null;
  if (!ticket.expiresAt || ticket.expiresAt.getTime() < Date.now()) return null;
  return ticket;
}

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash("admin1234", 10);
  const admin = await db.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "主辦單位",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const userPassword = await bcrypt.hash("user1234", 10);
  await db.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      name: "示範用戶",
      passwordHash: userPassword,
      role: "USER",
    },
  });

  const now = Date.now();

  await db.event.upsert({
    where: { slug: "demo-concert-2026" },
    update: {},
    create: {
      slug: "demo-concert-2026",
      title: "夏夜演唱會 2026",
      description: "示範活動：開賣中，可直接體驗排隊機制與訂票流程。",
      venue: "台北小巨蛋",
      coverColor: "#6366f1",
      startAt: new Date(now + 30 * 24 * 3600_000),
      saleStartAt: new Date(now - 60_000), // already on sale
      saleEndAt: new Date(now + 14 * 24 * 3600_000),
      queueEnabled: true,
      admitBatchSize: 5,
      admitIntervalSec: 10,
      admitWindowMinutes: 5,
      holdMinutes: 10,
      organizerId: admin.id,
      ticketTypes: {
        create: [
          { name: "搖滾區", priceCents: 380000, totalQty: 8, remainingQty: 8, maxPerOrder: 2 },
          { name: "看台區", priceCents: 220000, totalQty: 30, remainingQty: 30, maxPerOrder: 4 },
        ],
      },
    },
  });

  await db.event.upsert({
    where: { slug: "future-show-2026" },
    update: {},
    create: {
      slug: "future-show-2026",
      title: "秋季音樂節 2026",
      description: "示範活動：尚未開賣，可觀察倒數計時。",
      venue: "高雄流行音樂中心",
      coverColor: "#f97316",
      startAt: new Date(now + 60 * 24 * 3600_000),
      saleStartAt: new Date(now + 3600_000),
      saleEndAt: new Date(now + 45 * 24 * 3600_000),
      queueEnabled: true,
      admitBatchSize: 20,
      admitIntervalSec: 5,
      admitWindowMinutes: 5,
      holdMinutes: 10,
      organizerId: admin.id,
      ticketTypes: {
        create: [{ name: "一般票", priceCents: 180000, totalQty: 100, remainingQty: 100, maxPerOrder: 4 }],
      },
    },
  });

  console.log("Seed complete. Admin login: admin@example.com / admin1234");
  console.log("Demo user login: user@example.com / user1234");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

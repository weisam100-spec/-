-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "saleStartAt" DATETIME NOT NULL,
    "saleEndAt" DATETIME NOT NULL,
    "coverColor" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queueEnabled" BOOLEAN NOT NULL DEFAULT true,
    "admitBatchSize" INTEGER NOT NULL DEFAULT 20,
    "admitIntervalSec" INTEGER NOT NULL DEFAULT 5,
    "admitWindowMinutes" INTEGER NOT NULL DEFAULT 5,
    "holdMinutes" INTEGER NOT NULL DEFAULT 10,
    "organizerId" TEXT NOT NULL,
    CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("admitBatchSize", "admitIntervalSec", "coverColor", "createdAt", "description", "holdMinutes", "id", "organizerId", "queueEnabled", "saleEndAt", "saleStartAt", "slug", "startAt", "title", "venue") SELECT "admitBatchSize", "admitIntervalSec", "coverColor", "createdAt", "description", "holdMinutes", "id", "organizerId", "queueEnabled", "saleEndAt", "saleStartAt", "slug", "startAt", "title", "venue" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_saleStartAt_idx" ON "Event"("saleStartAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

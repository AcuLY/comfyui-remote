/*
  Warnings:

  - You are about to drop the column `seedPolicy` on the `CompleteJobPosition` table. All the data in the column will be lost.
  - You are about to drop the column `defaultLoraConfig` on the `PositionTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `defaultSeedPolicy` on the `PositionTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `loraBindings` on the `PositionTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Character" ADD COLUMN "loraBindings" JSONB;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompleteJobPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobId" TEXT NOT NULL,
    "positionTemplateId" TEXT,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "positivePrompt" TEXT,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT,
    "shortSidePx" INTEGER,
    "batchSize" INTEGER,
    "seedPolicy1" TEXT,
    "seedPolicy2" TEXT,
    "ksampler1" JSONB,
    "ksampler2" JSONB,
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompleteJobPosition_completeJobId_fkey" FOREIGN KEY ("completeJobId") REFERENCES "CompleteJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompleteJobPosition_positionTemplateId_fkey" FOREIGN KEY ("positionTemplateId") REFERENCES "PositionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompleteJobPosition" ("aspectRatio", "batchSize", "completeJobId", "createdAt", "enabled", "extraParams", "id", "latestRunId", "loraConfig", "name", "negativePrompt", "positionTemplateId", "positivePrompt", "shortSidePx", "sortOrder", "updatedAt") SELECT "aspectRatio", "batchSize", "completeJobId", "createdAt", "enabled", "extraParams", "id", "latestRunId", "loraConfig", "name", "negativePrompt", "positionTemplateId", "positivePrompt", "shortSidePx", "sortOrder", "updatedAt" FROM "CompleteJobPosition";
DROP TABLE "CompleteJobPosition";
ALTER TABLE "new_CompleteJobPosition" RENAME TO "CompleteJobPosition";
CREATE INDEX "CompleteJobPosition_completeJobId_sortOrder_idx" ON "CompleteJobPosition"("completeJobId", "sortOrder");
CREATE TABLE "new_PositionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "lora1" JSONB,
    "lora2" JSONB,
    "defaultAspectRatio" TEXT,
    "defaultShortSidePx" INTEGER,
    "defaultBatchSize" INTEGER DEFAULT 1,
    "defaultSeedPolicy1" TEXT,
    "defaultSeedPolicy2" TEXT,
    "defaultKsampler1" JSONB,
    "defaultKsampler2" JSONB,
    "defaultParams" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PositionTemplate" ("createdAt", "defaultAspectRatio", "defaultBatchSize", "defaultParams", "defaultShortSidePx", "enabled", "id", "name", "negativePrompt", "prompt", "slug", "updatedAt") SELECT "createdAt", "defaultAspectRatio", "defaultBatchSize", "defaultParams", "defaultShortSidePx", "enabled", "id", "name", "negativePrompt", "prompt", "slug", "updatedAt" FROM "PositionTemplate";
DROP TABLE "PositionTemplate";
ALTER TABLE "new_PositionTemplate" RENAME TO "PositionTemplate";
CREATE UNIQUE INDEX "PositionTemplate_slug_key" ON "PositionTemplate"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

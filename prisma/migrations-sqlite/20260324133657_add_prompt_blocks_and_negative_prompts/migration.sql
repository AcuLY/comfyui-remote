-- AlterTable
ALTER TABLE "Character" ADD COLUMN "negativePrompt" TEXT;

-- AlterTable
ALTER TABLE "ScenePreset" ADD COLUMN "negativePrompt" TEXT;

-- AlterTable
ALTER TABLE "StylePreset" ADD COLUMN "negativePrompt" TEXT;

-- CreateTable
CREATE TABLE "PromptBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobPositionId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "sourceId" TEXT,
    "label" TEXT NOT NULL,
    "positive" TEXT NOT NULL,
    "negative" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromptBlock_completeJobPositionId_fkey" FOREIGN KEY ("completeJobPositionId") REFERENCES "CompleteJobPosition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompleteJobPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobId" TEXT NOT NULL,
    "positionTemplateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "positivePrompt" TEXT,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT,
    "batchSize" INTEGER,
    "seedPolicy" TEXT,
    "loraConfig" JSONB,
    "extraParams" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompleteJobPosition_completeJobId_fkey" FOREIGN KEY ("completeJobId") REFERENCES "CompleteJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompleteJobPosition_positionTemplateId_fkey" FOREIGN KEY ("positionTemplateId") REFERENCES "PositionTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CompleteJobPosition" ("aspectRatio", "batchSize", "completeJobId", "createdAt", "enabled", "extraParams", "id", "latestRunId", "loraConfig", "negativePrompt", "positionTemplateId", "positivePrompt", "seedPolicy", "sortOrder", "updatedAt") SELECT "aspectRatio", "batchSize", "completeJobId", "createdAt", "enabled", "extraParams", "id", "latestRunId", "loraConfig", "negativePrompt", "positionTemplateId", "positivePrompt", "seedPolicy", "sortOrder", "updatedAt" FROM "CompleteJobPosition";
DROP TABLE "CompleteJobPosition";
ALTER TABLE "new_CompleteJobPosition" RENAME TO "CompleteJobPosition";
CREATE INDEX "CompleteJobPosition_completeJobId_sortOrder_idx" ON "CompleteJobPosition"("completeJobId", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PromptBlock_completeJobPositionId_sortOrder_idx" ON "PromptBlock"("completeJobPositionId", "sortOrder");

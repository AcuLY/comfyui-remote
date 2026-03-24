-- AlterTable: Add negativePrompt to Character, ScenePreset, StylePreset
ALTER TABLE "Character" ADD COLUMN "negativePrompt" TEXT;
ALTER TABLE "ScenePreset" ADD COLUMN "negativePrompt" TEXT;
ALTER TABLE "StylePreset" ADD COLUMN "negativePrompt" TEXT;

-- CreateEnum: PromptBlockType
CREATE TYPE "PromptBlockType" AS ENUM ('character', 'scene', 'style', 'position', 'custom');

-- CreateTable: PromptBlock
CREATE TABLE "PromptBlock" (
    "id" TEXT NOT NULL,
    "completeJobPositionId" TEXT NOT NULL,
    "type" "PromptBlockType" NOT NULL DEFAULT 'custom',
    "sourceId" TEXT,
    "label" TEXT NOT NULL,
    "positive" TEXT NOT NULL,
    "negative" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptBlock_pkey" PRIMARY KEY ("id")
);

-- AlterTable: CompleteJobPosition — make positionTemplateId nullable, drop unique constraint
ALTER TABLE "CompleteJobPosition" ALTER COLUMN "positionTemplateId" DROP NOT NULL;
ALTER TABLE "CompleteJobPosition" DROP CONSTRAINT "CompleteJobPosition_completeJobId_positionTemplateId_key";
ALTER TABLE "CompleteJobPosition" DROP CONSTRAINT "CompleteJobPosition_positionTemplateId_fkey";
ALTER TABLE "CompleteJobPosition" ADD CONSTRAINT "CompleteJobPosition_positionTemplateId_fkey" FOREIGN KEY ("positionTemplateId") REFERENCES "PositionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PromptBlock_completeJobPositionId_sortOrder_idx" ON "PromptBlock"("completeJobPositionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "PromptBlock" ADD CONSTRAINT "PromptBlock_completeJobPositionId_fkey" FOREIGN KEY ("completeJobPositionId") REFERENCES "CompleteJobPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

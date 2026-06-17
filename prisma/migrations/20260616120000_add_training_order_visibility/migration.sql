-- AlterTable
ALTER TABLE "TrainingProject" ADD COLUMN "hiddenAt" TIMESTAMP(3);
ALTER TABLE "TrainingProject" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TrainingGenerationTask" ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrainingRun" ADD COLUMN "hiddenAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "TrainingProject_status_updatedAt_idx";

-- CreateIndex
CREATE INDEX "TrainingProject_status_sortOrder_idx" ON "TrainingProject"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingProject_hiddenAt_idx" ON "TrainingProject"("hiddenAt");

-- CreateIndex
CREATE INDEX "TrainingGenerationTask_hiddenAt_idx" ON "TrainingGenerationTask"("hiddenAt");

-- CreateIndex
CREATE INDEX "TrainingRun_hiddenAt_idx" ON "TrainingRun"("hiddenAt");

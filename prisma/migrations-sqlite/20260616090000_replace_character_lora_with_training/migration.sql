-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraTrainingTemplate";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraTrainingJob";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraSourceImage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraCanonicalVersion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraPromptCardVersion";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraSectionTemplate";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraJobSection";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraGenerationRun";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraCandidateImage";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraDatasetRevision";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraDatasetItem";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraTrainingRun";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraTrainingCheckpoint";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraBenchmarkRun";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraPromotionDecision";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraArtifact";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CharacterLoraWorkerTask";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "TrainingProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" DATETIME,
    "imagePromptGuidance" TEXT NOT NULL,
    "imagePromptFormat" TEXT NOT NULL,
    "captioningGuidance" TEXT NOT NULL,
    "trainingCaptionFormat" TEXT NOT NULL,
    "trainingDefaultsJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainingCharacterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "loraUsagePrompt" TEXT NOT NULL DEFAULT '',
    "characterDetailPrompt" TEXT NOT NULL DEFAULT '',
    "loraUsagePromptGenerationTaskId" TEXT,
    "characterDetailPromptGenerationTaskId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingCharacterProfile_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingCharacterImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingCharacterProfileId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceGenerationTaskOutputId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingCharacterImage_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingCharacterImage_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingCharacterImage_sourceGenerationTaskOutputId_fkey" FOREIGN KEY ("sourceGenerationTaskOutputId") REFERENCES "TrainingGenerationTaskOutput" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filePath" TEXT,
    "storageRole" TEXT NOT NULL DEFAULT 'mutable_source',
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "sha256" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingArtifact_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sectionDefaultsJson" JSONB,
    "latestRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSection_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSceneDescriptionBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingSectionId" TEXT NOT NULL,
    "sceneDescriptionPresetCategoryId" TEXT,
    "sceneDescriptionPresetId" TEXT,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "localText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSceneDescriptionBlock_trainingSectionId_fkey" FOREIGN KEY ("trainingSectionId") REFERENCES "TrainingSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSceneDescriptionBlock_sceneDescriptionPresetCategoryId_fkey" FOREIGN KEY ("sceneDescriptionPresetCategoryId") REFERENCES "TrainingSceneDescriptionPresetCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingSceneDescriptionBlock_sceneDescriptionPresetId_fkey" FOREIGN KEY ("sceneDescriptionPresetId") REFERENCES "TrainingSceneDescriptionPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSectionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "trainingSectionId" TEXT NOT NULL,
    "trainingCharacterProfileId" TEXT NOT NULL,
    "generationTaskId" TEXT NOT NULL,
    "runIndex" INTEGER NOT NULL DEFAULT 1,
    "sceneDescriptionText" TEXT NOT NULL,
    "imagePromptText" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "generationParamsJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSectionRun_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSectionRun_trainingSectionId_fkey" FOREIGN KEY ("trainingSectionId") REFERENCES "TrainingSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSectionRun_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingSectionRun_generationTaskId_fkey" FOREIGN KEY ("generationTaskId") REFERENCES "TrainingGenerationTask" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingImageResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "trainingCharacterProfileId" TEXT,
    "artifactId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "trainingSectionRunId" TEXT,
    "generationTaskOutputId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "trainingCaption" TEXT,
    "captionGenerationTaskId" TEXT,
    "supplementalPrompt" TEXT,
    "removedAt" DATETIME,
    "removeReason" TEXT,
    "filePathSnapshot" TEXT,
    "thumbnailArtifactId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "sha256" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingImageResult_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_thumbnailArtifactId_fkey" FOREIGN KEY ("thumbnailArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_trainingSectionRunId_fkey" FOREIGN KEY ("trainingSectionRunId") REFERENCES "TrainingSectionRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_generationTaskOutputId_fkey" FOREIGN KEY ("generationTaskOutputId") REFERENCES "TrainingGenerationTaskOutput" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingImageResult_captionGenerationTaskId_fkey" FOREIGN KEY ("captionGenerationTaskId") REFERENCES "TrainingGenerationTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGenerationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "generationKind" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "supplementalPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "model" TEXT,
    "paramsJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingGenerationTask_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGenerationInputReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingGenerationTaskId" TEXT NOT NULL,
    "inputKind" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "sourceField" TEXT,
    "artifactId" TEXT,
    "snapshotText" TEXT,
    "snapshotArtifactId" TEXT,
    "snapshotFilePath" TEXT,
    "role" TEXT,
    "purpose" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingGenerationInputReference_trainingGenerationTaskId_fkey" FOREIGN KEY ("trainingGenerationTaskId") REFERENCES "TrainingGenerationTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingGenerationInputReference_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingGenerationInputReference_snapshotArtifactId_fkey" FOREIGN KEY ("snapshotArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingGenerationTaskOutput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingGenerationTaskId" TEXT NOT NULL,
    "outputKind" TEXT NOT NULL,
    "textValue" TEXT,
    "artifactId" TEXT,
    "filePath" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "targetField" TEXT,
    "appliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingGenerationTaskOutput_trainingGenerationTaskId_fkey" FOREIGN KEY ("trainingGenerationTaskId") REFERENCES "TrainingGenerationTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingGenerationTaskOutput_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingDatasetRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "captionMissingCount" INTEGER NOT NULL DEFAULT 0,
    "manifestArtifactId" TEXT,
    "manifestName" TEXT,
    "frozenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingDatasetRevision_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingDatasetRevision_manifestArtifactId_fkey" FOREIGN KEY ("manifestArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingDatasetRevisionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingDatasetRevisionId" TEXT NOT NULL,
    "sourceTrainingImageResultId" TEXT NOT NULL,
    "sourceArtifactId" TEXT NOT NULL,
    "snapshotArtifactId" TEXT NOT NULL,
    "filePathSnapshot" TEXT NOT NULL,
    "captionSnapshot" TEXT NOT NULL,
    "loraUsagePromptSnapshot" TEXT,
    "sceneDescriptionText" TEXT,
    "supplementalPromptSnapshot" TEXT,
    "captionContextSnapshot" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "aspectBucket" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingDatasetRevisionItem_trainingDatasetRevisionId_fkey" FOREIGN KEY ("trainingDatasetRevisionId") REFERENCES "TrainingDatasetRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingDatasetRevisionItem_sourceTrainingImageResultId_fkey" FOREIGN KEY ("sourceTrainingImageResultId") REFERENCES "TrainingImageResult" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingDatasetRevisionItem_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingDatasetRevisionItem_snapshotArtifactId_fkey" FOREIGN KEY ("snapshotArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "trainingDatasetRevisionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "baseCheckpointId" TEXT,
    "configArtifactId" TEXT,
    "trainingLogArtifactId" TEXT,
    "finalLoraArtifactId" TEXT,
    "runSummaryJson" JSONB,
    "progressJson" JSONB,
    "currentStep" INTEGER,
    "totalSteps" INTEGER,
    "waitReason" TEXT,
    "waitingSince" DATETIME,
    "schedulerMessage" TEXT,
    "runnerType" TEXT NOT NULL DEFAULT 'local_wsl_sd_scripts',
    "runnerWorkspacePath" TEXT,
    "errorMessage" TEXT,
    "createdPresetId" TEXT,
    "createdPresetVariantId" TEXT,
    "presetCreatedAt" DATETIME,
    "cancelRequestedAt" DATETIME,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingRun_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingRun_trainingDatasetRevisionId_fkey" FOREIGN KEY ("trainingDatasetRevisionId") REFERENCES "TrainingDatasetRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingRun_configArtifactId_fkey" FOREIGN KEY ("configArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRun_trainingLogArtifactId_fkey" FOREIGN KEY ("trainingLogArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingRun_finalLoraArtifactId_fkey" FOREIGN KEY ("finalLoraArtifactId") REFERENCES "TrainingArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingTextRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingProjectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "textValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceTaskId" TEXT,
    "sourceRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingTextRevision_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingProject_slug_key" ON "TrainingProject"("slug");

-- CreateIndex
CREATE INDEX "TrainingProject_status_updatedAt_idx" ON "TrainingProject"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TrainingProject_createdAt_idx" ON "TrainingProject"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCharacterProfile_trainingProjectId_key" ON "TrainingCharacterProfile"("trainingProjectId");

-- CreateIndex
CREATE INDEX "TrainingCharacterProfile_trainingProjectId_idx" ON "TrainingCharacterProfile"("trainingProjectId");

-- CreateIndex
CREATE INDEX "TrainingCharacterImage_trainingCharacterProfileId_sortOrder_idx" ON "TrainingCharacterImage"("trainingCharacterProfileId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingCharacterImage_artifactId_idx" ON "TrainingCharacterImage"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingCharacterImage_sourceGenerationTaskOutputId_idx" ON "TrainingCharacterImage"("sourceGenerationTaskOutputId");

-- CreateIndex
CREATE INDEX "TrainingArtifact_trainingProjectId_storageRole_idx" ON "TrainingArtifact"("trainingProjectId", "storageRole");

-- CreateIndex
CREATE INDEX "TrainingArtifact_sha256_idx" ON "TrainingArtifact"("sha256");

-- CreateIndex
CREATE INDEX "TrainingArtifact_lifecycleStatus_idx" ON "TrainingArtifact"("lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingArtifact_trainingProjectId_storageKey_key" ON "TrainingArtifact"("trainingProjectId", "storageKey");

-- CreateIndex
CREATE INDEX "TrainingSection_trainingProjectId_sortOrder_idx" ON "TrainingSection"("trainingProjectId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingSection_latestRunId_idx" ON "TrainingSection"("latestRunId");

-- CreateIndex
CREATE INDEX "TrainingSceneDescriptionBlock_trainingSectionId_sortOrder_idx" ON "TrainingSceneDescriptionBlock"("trainingSectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "training_project_block_category_idx" ON "TrainingSceneDescriptionBlock"("sceneDescriptionPresetCategoryId");

-- CreateIndex
CREATE INDEX "training_project_block_preset_idx" ON "TrainingSceneDescriptionBlock"("sceneDescriptionPresetId");

-- CreateIndex
CREATE INDEX "TrainingSectionRun_trainingProjectId_status_idx" ON "TrainingSectionRun"("trainingProjectId", "status");

-- CreateIndex
CREATE INDEX "TrainingSectionRun_trainingSectionId_createdAt_idx" ON "TrainingSectionRun"("trainingSectionId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingSectionRun_generationTaskId_idx" ON "TrainingSectionRun"("generationTaskId");

-- CreateIndex
CREATE INDEX "TrainingImageResult_trainingProjectId_reviewStatus_idx" ON "TrainingImageResult"("trainingProjectId", "reviewStatus");

-- CreateIndex
CREATE INDEX "TrainingImageResult_trainingSectionRunId_idx" ON "TrainingImageResult"("trainingSectionRunId");

-- CreateIndex
CREATE INDEX "TrainingImageResult_artifactId_idx" ON "TrainingImageResult"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingImageResult_removedAt_idx" ON "TrainingImageResult"("removedAt");

-- CreateIndex
CREATE INDEX "TrainingGenerationTask_trainingProjectId_status_idx" ON "TrainingGenerationTask"("trainingProjectId", "status");

-- CreateIndex
CREATE INDEX "TrainingGenerationTask_taskType_status_idx" ON "TrainingGenerationTask"("taskType", "status");

-- CreateIndex
CREATE INDEX "TrainingGenerationTask_status_createdAt_idx" ON "TrainingGenerationTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingGenerationInputReference_trainingGenerationTaskId_sortOrder_idx" ON "TrainingGenerationInputReference"("trainingGenerationTaskId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingGenerationInputReference_sourceEntityType_sourceEntityId_idx" ON "TrainingGenerationInputReference"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "TrainingGenerationInputReference_artifactId_idx" ON "TrainingGenerationInputReference"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_trainingGenerationTaskId_createdAt_idx" ON "TrainingGenerationTaskOutput"("trainingGenerationTaskId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_artifactId_idx" ON "TrainingGenerationTaskOutput"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_targetEntityType_targetEntityId_idx" ON "TrainingGenerationTaskOutput"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevision_trainingProjectId_status_idx" ON "TrainingDatasetRevision"("trainingProjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDatasetRevision_trainingProjectId_version_key" ON "TrainingDatasetRevision"("trainingProjectId", "version");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevisionItem_trainingDatasetRevisionId_sortOrder_idx" ON "TrainingDatasetRevisionItem"("trainingDatasetRevisionId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevisionItem_sourceTrainingImageResultId_idx" ON "TrainingDatasetRevisionItem"("sourceTrainingImageResultId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDatasetRevisionItem_trainingDatasetRevisionId_sourceTrainingImageResultId_key" ON "TrainingDatasetRevisionItem"("trainingDatasetRevisionId", "sourceTrainingImageResultId");

-- CreateIndex
CREATE INDEX "TrainingRun_trainingProjectId_status_idx" ON "TrainingRun"("trainingProjectId", "status");

-- CreateIndex
CREATE INDEX "TrainingRun_trainingDatasetRevisionId_idx" ON "TrainingRun"("trainingDatasetRevisionId");

-- CreateIndex
CREATE INDEX "TrainingRun_status_createdAt_idx" ON "TrainingRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingRun_finalLoraArtifactId_idx" ON "TrainingRun"("finalLoraArtifactId");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_trainingProjectId_entityType_entityId_fieldName_createdAt_idx" ON "TrainingTextRevision"("trainingProjectId", "entityType", "entityId", "fieldName", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_sourceTaskId_idx" ON "TrainingTextRevision"("sourceTaskId");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_sourceRunId_idx" ON "TrainingTextRevision"("sourceRunId");

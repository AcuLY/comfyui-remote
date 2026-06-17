-- DropForeignKey
ALTER TABLE "CharacterLoraTrainingJob" DROP CONSTRAINT "CharacterLoraTrainingJob_trainingTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraSourceImage" DROP CONSTRAINT "CharacterLoraSourceImage_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCanonicalVersion" DROP CONSTRAINT "CharacterLoraCanonicalVersion_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCanonicalVersion" DROP CONSTRAINT "CharacterLoraCanonicalVersion_sourceRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraPromptCardVersion" DROP CONSTRAINT "CharacterLoraPromptCardVersion_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraPromptCardVersion" DROP CONSTRAINT "CharacterLoraPromptCardVersion_canonicalVersionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraSectionTemplate" DROP CONSTRAINT "CharacterLoraSectionTemplate_trainingTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraJobSection" DROP CONSTRAINT "CharacterLoraJobSection_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraJobSection" DROP CONSTRAINT "CharacterLoraJobSection_templateId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraJobSection" DROP CONSTRAINT "CharacterLoraJobSection_canonicalVersionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraJobSection" DROP CONSTRAINT "CharacterLoraJobSection_promptCardVersionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraGenerationRun" DROP CONSTRAINT "CharacterLoraGenerationRun_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraGenerationRun" DROP CONSTRAINT "CharacterLoraGenerationRun_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraGenerationRun" DROP CONSTRAINT "CharacterLoraGenerationRun_parentRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCandidateImage" DROP CONSTRAINT "CharacterLoraCandidateImage_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCandidateImage" DROP CONSTRAINT "CharacterLoraCandidateImage_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCandidateImage" DROP CONSTRAINT "CharacterLoraCandidateImage_generationRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraCandidateImage" DROP CONSTRAINT "CharacterLoraCandidateImage_includedDatasetRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraDatasetRevision" DROP CONSTRAINT "CharacterLoraDatasetRevision_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraDatasetRevision" DROP CONSTRAINT "CharacterLoraDatasetRevision_canonicalVersionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraDatasetRevision" DROP CONSTRAINT "CharacterLoraDatasetRevision_promptCardVersionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraDatasetItem" DROP CONSTRAINT "CharacterLoraDatasetItem_datasetRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraDatasetItem" DROP CONSTRAINT "CharacterLoraDatasetItem_candidateImageId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraTrainingRun" DROP CONSTRAINT "CharacterLoraTrainingRun_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraTrainingRun" DROP CONSTRAINT "CharacterLoraTrainingRun_datasetRevisionId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraTrainingCheckpoint" DROP CONSTRAINT "CharacterLoraTrainingCheckpoint_trainingRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraBenchmarkRun" DROP CONSTRAINT "CharacterLoraBenchmarkRun_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraBenchmarkRun" DROP CONSTRAINT "CharacterLoraBenchmarkRun_trainingRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraPromotionDecision" DROP CONSTRAINT "CharacterLoraPromotionDecision_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraPromotionDecision" DROP CONSTRAINT "CharacterLoraPromotionDecision_benchmarkRunId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraArtifact" DROP CONSTRAINT "CharacterLoraArtifact_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CharacterLoraWorkerTask" DROP CONSTRAINT "CharacterLoraWorkerTask_jobId_fkey";

-- DropTable
DROP TABLE "CharacterLoraTrainingTemplate";

-- DropTable
DROP TABLE "CharacterLoraTrainingJob";

-- DropTable
DROP TABLE "CharacterLoraSourceImage";

-- DropTable
DROP TABLE "CharacterLoraCanonicalVersion";

-- DropTable
DROP TABLE "CharacterLoraPromptCardVersion";

-- DropTable
DROP TABLE "CharacterLoraSectionTemplate";

-- DropTable
DROP TABLE "CharacterLoraJobSection";

-- DropTable
DROP TABLE "CharacterLoraGenerationRun";

-- DropTable
DROP TABLE "CharacterLoraCandidateImage";

-- DropTable
DROP TABLE "CharacterLoraDatasetRevision";

-- DropTable
DROP TABLE "CharacterLoraDatasetItem";

-- DropTable
DROP TABLE "CharacterLoraTrainingRun";

-- DropTable
DROP TABLE "CharacterLoraTrainingCheckpoint";

-- DropTable
DROP TABLE "CharacterLoraBenchmarkRun";

-- DropTable
DROP TABLE "CharacterLoraPromotionDecision";

-- DropTable
DROP TABLE "CharacterLoraArtifact";

-- DropTable
DROP TABLE "CharacterLoraWorkerTask";

-- DropEnum
DROP TYPE "CharacterLoraJobStatus";

-- DropEnum
DROP TYPE "CharacterLoraImageReviewStatus";

-- DropEnum
DROP TYPE "CharacterLoraRunStatus";

-- DropEnum
DROP TYPE "CharacterLoraArtifactKind";

-- DropEnum
DROP TYPE "CharacterLoraWorkerType";

-- DropEnum
DROP TYPE "CharacterLoraDecisionStatus";

-- CreateTable
CREATE TABLE "TrainingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "archivedAt" TIMESTAMP(3),
    "imagePromptGuidance" TEXT NOT NULL,
    "imagePromptFormat" TEXT NOT NULL,
    "captioningGuidance" TEXT NOT NULL,
    "trainingCaptionFormat" TEXT NOT NULL,
    "trainingDefaultsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCharacterProfile" (
    "id" TEXT NOT NULL,
    "trainingProjectId" TEXT NOT NULL,
    "loraUsagePrompt" TEXT NOT NULL DEFAULT '',
    "characterDetailPrompt" TEXT NOT NULL DEFAULT '',
    "loraUsagePromptGenerationTaskId" TEXT,
    "characterDetailPromptGenerationTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCharacterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCharacterImage" (
    "id" TEXT NOT NULL,
    "trainingCharacterProfileId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "imageType" TEXT NOT NULL,
    "label" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceGenerationTaskOutputId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCharacterImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingArtifact" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSection" (
    "id" TEXT NOT NULL,
    "trainingProjectId" TEXT NOT NULL,
    "name" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sectionDefaultsJson" JSONB,
    "latestRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSceneDescriptionBlock" (
    "id" TEXT NOT NULL,
    "trainingSectionId" TEXT NOT NULL,
    "sceneDescriptionPresetCategoryId" TEXT,
    "sceneDescriptionPresetId" TEXT,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "localText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSceneDescriptionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSectionRun" (
    "id" TEXT NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingImageResult" (
    "id" TEXT NOT NULL,
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
    "removedAt" TIMESTAMP(3),
    "removeReason" TEXT,
    "filePathSnapshot" TEXT,
    "thumbnailArtifactId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "fileSize" BIGINT,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingImageResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGenerationTask" (
    "id" TEXT NOT NULL,
    "trainingProjectId" TEXT NOT NULL,
    "generationKind" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "supplementalPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "model" TEXT,
    "paramsJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGenerationInputReference" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGenerationInputReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGenerationTaskOutput" (
    "id" TEXT NOT NULL,
    "trainingGenerationTaskId" TEXT NOT NULL,
    "outputKind" TEXT NOT NULL,
    "textValue" TEXT,
    "artifactId" TEXT,
    "filePath" TEXT,
    "targetEntityType" TEXT,
    "targetEntityId" TEXT,
    "targetField" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingGenerationTaskOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDatasetRevision" (
    "id" TEXT NOT NULL,
    "trainingProjectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "captionMissingCount" INTEGER NOT NULL DEFAULT 0,
    "manifestArtifactId" TEXT,
    "manifestName" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingDatasetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDatasetRevisionItem" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingDatasetRevisionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRun" (
    "id" TEXT NOT NULL,
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
    "waitingSince" TIMESTAMP(3),
    "schedulerMessage" TEXT,
    "runnerType" TEXT NOT NULL DEFAULT 'local_wsl_sd_scripts',
    "runnerWorkspacePath" TEXT,
    "errorMessage" TEXT,
    "createdPresetId" TEXT,
    "createdPresetVariantId" TEXT,
    "presetCreatedAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTextRevision" (
    "id" TEXT NOT NULL,
    "trainingProjectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "textValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceTaskId" TEXT,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingTextRevision_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "TrainingGenerationInputReference_trainingGenerationTaskId_s_idx" ON "TrainingGenerationInputReference"("trainingGenerationTaskId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingGenerationInputReference_sourceEntityType_sourceEnt_idx" ON "TrainingGenerationInputReference"("sourceEntityType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "TrainingGenerationInputReference_artifactId_idx" ON "TrainingGenerationInputReference"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_trainingGenerationTaskId_creat_idx" ON "TrainingGenerationTaskOutput"("trainingGenerationTaskId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_artifactId_idx" ON "TrainingGenerationTaskOutput"("artifactId");

-- CreateIndex
CREATE INDEX "TrainingGenerationTaskOutput_targetEntityType_targetEntityI_idx" ON "TrainingGenerationTaskOutput"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevision_trainingProjectId_status_idx" ON "TrainingDatasetRevision"("trainingProjectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDatasetRevision_trainingProjectId_version_key" ON "TrainingDatasetRevision"("trainingProjectId", "version");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevisionItem_trainingDatasetRevisionId_sortO_idx" ON "TrainingDatasetRevisionItem"("trainingDatasetRevisionId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingDatasetRevisionItem_sourceTrainingImageResultId_idx" ON "TrainingDatasetRevisionItem"("sourceTrainingImageResultId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDatasetRevisionItem_trainingDatasetRevisionId_sourc_key" ON "TrainingDatasetRevisionItem"("trainingDatasetRevisionId", "sourceTrainingImageResultId");

-- CreateIndex
CREATE INDEX "TrainingRun_trainingProjectId_status_idx" ON "TrainingRun"("trainingProjectId", "status");

-- CreateIndex
CREATE INDEX "TrainingRun_trainingDatasetRevisionId_idx" ON "TrainingRun"("trainingDatasetRevisionId");

-- CreateIndex
CREATE INDEX "TrainingRun_status_createdAt_idx" ON "TrainingRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingRun_finalLoraArtifactId_idx" ON "TrainingRun"("finalLoraArtifactId");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_trainingProjectId_entityType_entityId__idx" ON "TrainingTextRevision"("trainingProjectId", "entityType", "entityId", "fieldName", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_sourceTaskId_idx" ON "TrainingTextRevision"("sourceTaskId");

-- CreateIndex
CREATE INDEX "TrainingTextRevision_sourceRunId_idx" ON "TrainingTextRevision"("sourceRunId");

-- AddForeignKey
ALTER TABLE "TrainingCharacterProfile" ADD CONSTRAINT "TrainingCharacterProfile_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCharacterImage" ADD CONSTRAINT "TrainingCharacterImage_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCharacterImage" ADD CONSTRAINT "TrainingCharacterImage_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCharacterImage" ADD CONSTRAINT "TrainingCharacterImage_sourceGenerationTaskOutputId_fkey" FOREIGN KEY ("sourceGenerationTaskOutputId") REFERENCES "TrainingGenerationTaskOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingArtifact" ADD CONSTRAINT "TrainingArtifact_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSection" ADD CONSTRAINT "TrainingSection_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSceneDescriptionBlock" ADD CONSTRAINT "TrainingSceneDescriptionBlock_trainingSectionId_fkey" FOREIGN KEY ("trainingSectionId") REFERENCES "TrainingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSceneDescriptionBlock" ADD CONSTRAINT "training_project_block_category_fkey" FOREIGN KEY ("sceneDescriptionPresetCategoryId") REFERENCES "TrainingSceneDescriptionPresetCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSceneDescriptionBlock" ADD CONSTRAINT "training_project_block_preset_fkey" FOREIGN KEY ("sceneDescriptionPresetId") REFERENCES "TrainingSceneDescriptionPreset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSectionRun" ADD CONSTRAINT "TrainingSectionRun_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSectionRun" ADD CONSTRAINT "TrainingSectionRun_trainingSectionId_fkey" FOREIGN KEY ("trainingSectionId") REFERENCES "TrainingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSectionRun" ADD CONSTRAINT "TrainingSectionRun_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSectionRun" ADD CONSTRAINT "TrainingSectionRun_generationTaskId_fkey" FOREIGN KEY ("generationTaskId") REFERENCES "TrainingGenerationTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_trainingCharacterProfileId_fkey" FOREIGN KEY ("trainingCharacterProfileId") REFERENCES "TrainingCharacterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_thumbnailArtifactId_fkey" FOREIGN KEY ("thumbnailArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_trainingSectionRunId_fkey" FOREIGN KEY ("trainingSectionRunId") REFERENCES "TrainingSectionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_generationTaskOutputId_fkey" FOREIGN KEY ("generationTaskOutputId") REFERENCES "TrainingGenerationTaskOutput"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingImageResult" ADD CONSTRAINT "TrainingImageResult_captionGenerationTaskId_fkey" FOREIGN KEY ("captionGenerationTaskId") REFERENCES "TrainingGenerationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationTask" ADD CONSTRAINT "TrainingGenerationTask_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationInputReference" ADD CONSTRAINT "TrainingGenerationInputReference_trainingGenerationTaskId_fkey" FOREIGN KEY ("trainingGenerationTaskId") REFERENCES "TrainingGenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationInputReference" ADD CONSTRAINT "TrainingGenerationInputReference_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationInputReference" ADD CONSTRAINT "TrainingGenerationInputReference_snapshotArtifactId_fkey" FOREIGN KEY ("snapshotArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationTaskOutput" ADD CONSTRAINT "TrainingGenerationTaskOutput_trainingGenerationTaskId_fkey" FOREIGN KEY ("trainingGenerationTaskId") REFERENCES "TrainingGenerationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGenerationTaskOutput" ADD CONSTRAINT "TrainingGenerationTaskOutput_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevision" ADD CONSTRAINT "TrainingDatasetRevision_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevision" ADD CONSTRAINT "TrainingDatasetRevision_manifestArtifactId_fkey" FOREIGN KEY ("manifestArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevisionItem" ADD CONSTRAINT "TrainingDatasetRevisionItem_trainingDatasetRevisionId_fkey" FOREIGN KEY ("trainingDatasetRevisionId") REFERENCES "TrainingDatasetRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevisionItem" ADD CONSTRAINT "TrainingDatasetRevisionItem_sourceTrainingImageResultId_fkey" FOREIGN KEY ("sourceTrainingImageResultId") REFERENCES "TrainingImageResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevisionItem" ADD CONSTRAINT "TrainingDatasetRevisionItem_sourceArtifactId_fkey" FOREIGN KEY ("sourceArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingDatasetRevisionItem" ADD CONSTRAINT "TrainingDatasetRevisionItem_snapshotArtifactId_fkey" FOREIGN KEY ("snapshotArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_trainingDatasetRevisionId_fkey" FOREIGN KEY ("trainingDatasetRevisionId") REFERENCES "TrainingDatasetRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_configArtifactId_fkey" FOREIGN KEY ("configArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_trainingLogArtifactId_fkey" FOREIGN KEY ("trainingLogArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRun" ADD CONSTRAINT "TrainingRun_finalLoraArtifactId_fkey" FOREIGN KEY ("finalLoraArtifactId") REFERENCES "TrainingArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTextRevision" ADD CONSTRAINT "TrainingTextRevision_trainingProjectId_fkey" FOREIGN KEY ("trainingProjectId") REFERENCES "TrainingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

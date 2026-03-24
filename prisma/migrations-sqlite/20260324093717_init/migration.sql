-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "loraPath" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ScenePreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StylePreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PositionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "defaultLoraConfig" JSONB,
    "defaultAspectRatio" TEXT,
    "defaultBatchSize" INTEGER DEFAULT 1,
    "defaultSeedPolicy" TEXT,
    "defaultParams" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompleteJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "characterId" TEXT NOT NULL,
    "scenePresetId" TEXT,
    "stylePresetId" TEXT,
    "characterPrompt" TEXT NOT NULL,
    "characterLoraPath" TEXT NOT NULL,
    "scenePrompt" TEXT,
    "stylePrompt" TEXT,
    "jobLevelOverrides" JSONB,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompleteJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompleteJob_scenePresetId_fkey" FOREIGN KEY ("scenePresetId") REFERENCES "ScenePreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CompleteJob_stylePresetId_fkey" FOREIGN KEY ("stylePresetId") REFERENCES "StylePreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompleteJobPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobId" TEXT NOT NULL,
    "positionTemplateId" TEXT NOT NULL,
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
    CONSTRAINT "CompleteJobPosition_positionTemplateId_fkey" FOREIGN KEY ("positionTemplateId") REFERENCES "PositionTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobId" TEXT NOT NULL,
    "completeJobPositionId" TEXT NOT NULL,
    "runIndex" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resolvedConfigSnapshot" JSONB NOT NULL,
    "comfyPromptId" TEXT,
    "outputDir" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PositionRun_completeJobId_fkey" FOREIGN KEY ("completeJobId") REFERENCES "CompleteJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PositionRun_completeJobPositionId_fkey" FOREIGN KEY ("completeJobPositionId") REFERENCES "CompleteJobPosition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImageResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionRunId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "fileSize" BIGINT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImageResult_positionRunId_fkey" FOREIGN KEY ("positionRunId") REFERENCES "PositionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrashRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "imageResultId" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "trashPath" TEXT NOT NULL,
    "reason" TEXT,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" DATETIME,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    CONSTRAINT "TrashRecord_imageResultId_fkey" FOREIGN KEY ("imageResultId") REFERENCES "ImageResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoraAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "absolutePath" TEXT NOT NULL,
    "relativePath" TEXT NOT NULL,
    "size" BIGINT,
    "source" TEXT,
    "notes" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "completeJobId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    CONSTRAINT "JobRevision_completeJobId_fkey" FOREIGN KEY ("completeJobId") REFERENCES "CompleteJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Character_slug_key" ON "Character"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ScenePreset_slug_key" ON "ScenePreset"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "StylePreset_slug_key" ON "StylePreset"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PositionTemplate_slug_key" ON "PositionTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CompleteJob_slug_key" ON "CompleteJob"("slug");

-- CreateIndex
CREATE INDEX "CompleteJob_status_updatedAt_idx" ON "CompleteJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "CompleteJob_characterId_updatedAt_idx" ON "CompleteJob"("characterId", "updatedAt");

-- CreateIndex
CREATE INDEX "CompleteJobPosition_completeJobId_sortOrder_idx" ON "CompleteJobPosition"("completeJobId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CompleteJobPosition_completeJobId_positionTemplateId_key" ON "CompleteJobPosition"("completeJobId", "positionTemplateId");

-- CreateIndex
CREATE INDEX "PositionRun_status_createdAt_idx" ON "PositionRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PositionRun_completeJobId_createdAt_idx" ON "PositionRun"("completeJobId", "createdAt");

-- CreateIndex
CREATE INDEX "PositionRun_completeJobPositionId_createdAt_idx" ON "PositionRun"("completeJobPositionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageResult_filePath_key" ON "ImageResult"("filePath");

-- CreateIndex
CREATE INDEX "ImageResult_reviewStatus_createdAt_idx" ON "ImageResult"("reviewStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ImageResult_positionRunId_createdAt_idx" ON "ImageResult"("positionRunId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrashRecord_imageResultId_key" ON "TrashRecord"("imageResultId");

-- CreateIndex
CREATE INDEX "TrashRecord_deletedAt_idx" ON "TrashRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "TrashRecord_restoredAt_idx" ON "TrashRecord"("restoredAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoraAsset_absolutePath_key" ON "LoraAsset"("absolutePath");

-- CreateIndex
CREATE INDEX "JobRevision_completeJobId_createdAt_idx" ON "JobRevision"("completeJobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRevision_completeJobId_revisionNumber_key" ON "JobRevision"("completeJobId", "revisionNumber");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

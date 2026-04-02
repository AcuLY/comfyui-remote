-- ============================================================================
-- 迁移脚本：旧库 → 新库（全量表结构重命名）
-- ============================================================================
-- 变更：
--   PromptCategory → PresetCategory
--   PromptPreset   → Preset + PresetVariant（拆分）
--   PositionRun    → Run
--   ImageResult.positionRunId → ImageResult.runId
--
-- 用法：
--   1. 备份旧数据库：  cp dev.db dev.db.bak
--   2. 用新 schema 创建新库：  DB_PROVIDER=sqlite npx prisma db push --force-reset
--   3. 执行迁移：
--        sqlite3 dev.db
--        ATTACH 'dev.db.bak' AS old;
--        .read scripts/migrate-preset-variants.sql
--        .quit
-- ============================================================================

-- 1. PromptCategory → PresetCategory（字段不变）
INSERT OR IGNORE INTO PresetCategory
  (id, name, slug, icon, color,
   positivePromptOrder, negativePromptOrder, lora1Order, lora2Order,
   sortOrder, createdAt, updatedAt)
SELECT
  id, name, slug, icon, color,
  positivePromptOrder, negativePromptOrder, lora1Order, lora2Order,
  sortOrder, createdAt, updatedAt
FROM old.PromptCategory;

-- 2. PromptPreset → Preset（剥离内容字段）
INSERT OR IGNORE INTO Preset
  (id, categoryId, name, slug, isActive, sortOrder, notes, createdAt, updatedAt)
SELECT
  id, categoryId, name, slug, isActive, sortOrder, notes, createdAt, updatedAt
FROM old.PromptPreset;

-- 3. PromptPreset → PresetVariant（每个旧 preset 生成一个"默认"变体）
INSERT OR IGNORE INTO PresetVariant
  (id, presetId, name, slug, prompt, negativePrompt,
   lora1, lora2, defaultParams,
   sortOrder, isActive, createdAt, updatedAt)
SELECT
  id || '-v0',        -- 变体 ID
  id,                 -- presetId = 原 preset ID
  '默认',             -- name
  'default',          -- slug
  prompt,
  negativePrompt,
  lora1,
  lora2,
  defaultParams,
  0,                  -- sortOrder
  1,                  -- isActive
  createdAt,
  updatedAt
FROM old.PromptPreset;

-- 4. Project（字段不变）
INSERT OR IGNORE INTO Project
  (id, title, slug, status, presetBindings, projectLevelOverrides,
   notes, createdAt, updatedAt)
SELECT
  id, title, slug, status, presetBindings, projectLevelOverrides,
  notes, createdAt, updatedAt
FROM old.Project;

-- 5. ProjectSection（字段不变）
INSERT OR IGNORE INTO ProjectSection
  (id, projectId, name, sortOrder, enabled,
   positivePrompt, negativePrompt, aspectRatio, shortSidePx,
   batchSize, seedPolicy1, seedPolicy2, ksampler1, ksampler2,
   upscaleFactor, loraConfig, extraParams, latestRunId,
   createdAt, updatedAt)
SELECT
  id, projectId, name, sortOrder, enabled,
  positivePrompt, negativePrompt, aspectRatio, shortSidePx,
  batchSize, seedPolicy1, seedPolicy2, ksampler1, ksampler2,
  upscaleFactor, loraConfig, extraParams, latestRunId,
  createdAt, updatedAt
FROM old.ProjectSection;

-- 6. PromptBlock（字段不变）
INSERT OR IGNORE INTO PromptBlock
  (id, projectSectionId, type, sourceId, categoryId,
   label, positive, negative, sortOrder, createdAt, updatedAt)
SELECT
  id, projectSectionId, type, sourceId, categoryId,
  label, positive, negative, sortOrder, createdAt, updatedAt
FROM old.PromptBlock;

-- 7. PositionRun → Run（字段映射）
INSERT OR IGNORE INTO Run
  (id, projectId, projectSectionId, runIndex, status,
   resolvedConfigSnapshot, comfyPromptId, executionMeta,
   outputDir, errorMessage, startedAt, finishedAt,
   createdAt, updatedAt)
SELECT
  id, projectId, projectSectionId, runIndex, status,
  resolvedConfigSnapshot, comfyPromptId, executionMeta,
  outputDir, errorMessage, startedAt, finishedAt,
  createdAt, updatedAt
FROM old.PositionRun;

-- 8. ImageResult（positionRunId → runId）
INSERT OR IGNORE INTO ImageResult
  (id, runId, filePath, thumbPath,
   width, height, fileSize, reviewStatus, featured,
   reviewedAt, createdAt, updatedAt)
SELECT
  id, positionRunId, filePath, thumbPath,
  width, height, fileSize, reviewStatus, featured,
  reviewedAt, createdAt, updatedAt
FROM old.ImageResult;

-- 9. TrashRecord（字段不变）
INSERT OR IGNORE INTO TrashRecord
  (id, imageResultId, originalPath, trashPath,
   reason, deletedAt, restoredAt, actorType)
SELECT
  id, imageResultId, originalPath, trashPath,
  reason, deletedAt, restoredAt, actorType
FROM old.TrashRecord;

-- 10. LoraAsset（字段不变）
INSERT OR IGNORE INTO LoraAsset
  (id, name, category, fileName, absolutePath, relativePath,
   size, source, notes, uploadedAt, updatedAt)
SELECT
  id, name, category, fileName, absolutePath, relativePath,
  size, source, notes, uploadedAt, updatedAt
FROM old.LoraAsset;

-- 11. ProjectRevision（字段不变）
INSERT OR IGNORE INTO ProjectRevision
  (id, projectId, revisionNumber, snapshot, createdAt, actorType)
SELECT
  id, projectId, revisionNumber, snapshot, createdAt, actorType
FROM old.ProjectRevision;

-- 12. AuditLog（字段不变）
INSERT OR IGNORE INTO AuditLog
  (id, entityType, entityId, action, payload, actorType, createdAt)
SELECT
  id, entityType, entityId, action, payload, actorType, createdAt
FROM old.AuditLog;

-- ============================================================================
-- 验证
-- ============================================================================
SELECT '--- 迁移结果 ---';
SELECT 'PresetCategory: ' || COUNT(*) FROM PresetCategory;
SELECT 'Preset:         ' || COUNT(*) FROM Preset;
SELECT 'PresetVariant:  ' || COUNT(*) FROM PresetVariant;
SELECT 'Project:        ' || COUNT(*) FROM Project;
SELECT 'ProjectSection: ' || COUNT(*) FROM ProjectSection;
SELECT 'PromptBlock:    ' || COUNT(*) FROM PromptBlock;
SELECT 'Run:            ' || COUNT(*) FROM Run;
SELECT 'ImageResult:    ' || COUNT(*) FROM ImageResult;
SELECT 'TrashRecord:    ' || COUNT(*) FROM TrashRecord;
SELECT 'LoraAsset:      ' || COUNT(*) FROM LoraAsset;

-- Migration: old schema → new schema (SQLite)
-- PromptCategory → PresetCategory
-- PromptPreset → Preset + PresetVariant (split, dedup by categoryId+slug)
-- PositionRun → Run
-- ImageResult.positionRunId → ImageResult.runId

PRAGMA foreign_keys = OFF;

-- ==========================================================================
-- Step 1: Rename PromptCategory → PresetCategory
-- ==========================================================================
ALTER TABLE PromptCategory RENAME TO PresetCategory;

-- ==========================================================================
-- Step 2: Split PromptPreset → Preset + PresetVariant
-- ==========================================================================

-- 2a: Create Preset table
CREATE TABLE Preset (
    id TEXT PRIMARY KEY NOT NULL,
    categoryId TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT Preset_categoryId_fkey FOREIGN KEY (categoryId) REFERENCES PresetCategory(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX Preset_categoryId_slug_key ON Preset(categoryId, slug);
CREATE INDEX Preset_categoryId_sortOrder_idx ON Preset(categoryId, sortOrder);

-- 2b: Create PresetVariant table
CREATE TABLE PresetVariant (
    id TEXT PRIMARY KEY NOT NULL,
    presetId TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    prompt TEXT NOT NULL,
    negativePrompt TEXT,
    lora1 TEXT,
    lora2 TEXT,
    defaultParams TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    isActive INTEGER NOT NULL DEFAULT 1,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PresetVariant_presetId_fkey FOREIGN KEY (presetId) REFERENCES Preset(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX PresetVariant_presetId_slug_key ON PresetVariant(presetId, slug);
CREATE INDEX PresetVariant_presetId_sortOrder_idx ON PresetVariant(presetId, sortOrder);

-- 2c: Migrate data — deduplicate by keeping the FIRST row per (categoryId, slug)
-- Use a temp table to pick winners
CREATE TEMP TABLE _dedup AS
SELECT id, categoryId, name, slug, isActive, sortOrder, notes, createdAt, updatedAt,
       prompt, negativePrompt, lora1, lora2, defaultParams,
       ROW_NUMBER() OVER (PARTITION BY categoryId, slug ORDER BY createdAt ASC) AS rn
FROM PromptPreset;

-- Insert only first occurrence into Preset
INSERT INTO Preset (id, categoryId, name, slug, isActive, sortOrder, notes, createdAt, updatedAt)
SELECT id, categoryId, name, slug, isActive, sortOrder, notes, createdAt, updatedAt
FROM _dedup WHERE rn = 1;

-- For the first occurrence → variant "默认" with slug "default"
INSERT INTO PresetVariant (id, presetId, name, slug, prompt, negativePrompt, lora1, lora2, defaultParams, sortOrder, isActive, createdAt, updatedAt)
SELECT id || '_v0', id, '默认', 'default', prompt, negativePrompt, lora1, lora2, defaultParams, 0, isActive, createdAt, updatedAt
FROM _dedup WHERE rn = 1;

-- For duplicates (rn > 1) → add as extra variants under the winning preset
INSERT INTO PresetVariant (id, presetId, name, slug, prompt, negativePrompt, lora1, lora2, defaultParams, sortOrder, isActive, createdAt, updatedAt)
SELECT
    dup.id || '_v' || dup.rn,
    winner.id,
    dup.name || ' (v' || dup.rn || ')',
    'variant-' || dup.rn,
    dup.prompt,
    dup.negativePrompt,
    dup.lora1,
    dup.lora2,
    dup.defaultParams,
    CAST(dup.rn AS INTEGER),
    dup.isActive,
    dup.createdAt,
    dup.updatedAt
FROM _dedup dup
JOIN _dedup winner ON winner.categoryId = dup.categoryId AND winner.slug = dup.slug AND winner.rn = 1
WHERE dup.rn > 1;

DROP TABLE _dedup;

-- 2d: Update PromptBlock.sourceId — remap duplicate preset IDs to the winner
-- (blocks that pointed to a duplicate PromptPreset should now point to the winning Preset)
UPDATE PromptBlock
SET sourceId = (
    SELECT p.id FROM Preset p
    JOIN PresetVariant pv ON pv.presetId = p.id
    WHERE pv.id = PromptBlock.sourceId || '_v0'
       OR pv.id LIKE PromptBlock.sourceId || '_v%'
    LIMIT 1
)
WHERE type = 'preset' AND sourceId NOT IN (SELECT id FROM Preset);

-- 2e: Drop old table
DROP TABLE PromptPreset;

-- ==========================================================================
-- Step 3: Rename PositionRun → Run, ImageResult.positionRunId → runId
-- ==========================================================================

-- 3a: Create new Run table
CREATE TABLE Run (
    id TEXT PRIMARY KEY NOT NULL,
    projectId TEXT NOT NULL,
    projectSectionId TEXT NOT NULL,
    runIndex INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'queued',
    resolvedConfigSnapshot TEXT NOT NULL,
    comfyPromptId TEXT,
    executionMeta TEXT,
    outputDir TEXT,
    errorMessage TEXT,
    startedAt DATETIME,
    finishedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT Run_projectId_fkey FOREIGN KEY (projectId) REFERENCES Project(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT Run_projectSectionId_fkey FOREIGN KEY (projectSectionId) REFERENCES ProjectSection(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX Run_status_createdAt_idx ON Run(status, createdAt);
CREATE INDEX Run_projectId_createdAt_idx ON Run(projectId, createdAt);
CREATE INDEX Run_projectSectionId_createdAt_idx ON Run(projectSectionId, createdAt);

-- 3b: Copy data
INSERT INTO Run (id, projectId, projectSectionId, runIndex, status, resolvedConfigSnapshot, comfyPromptId, executionMeta, outputDir, errorMessage, startedAt, finishedAt, createdAt, updatedAt)
SELECT id, projectId, projectSectionId, runIndex, status, resolvedConfigSnapshot, comfyPromptId, executionMeta, outputDir, errorMessage, startedAt, finishedAt, createdAt, updatedAt
FROM PositionRun;

-- 3c: Recreate ImageResult with runId
CREATE TABLE ImageResult_new (
    id TEXT PRIMARY KEY NOT NULL,
    runId TEXT NOT NULL,
    filePath TEXT NOT NULL,
    thumbPath TEXT,
    width INTEGER,
    height INTEGER,
    fileSize INTEGER,
    reviewStatus TEXT NOT NULL DEFAULT 'pending',
    featured INTEGER NOT NULL DEFAULT 0,
    reviewedAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ImageResult_runId_fkey FOREIGN KEY (runId) REFERENCES Run(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX ImageResult_new_filePath_key ON ImageResult_new(filePath);
CREATE INDEX ImageResult_new_reviewStatus_createdAt_idx ON ImageResult_new(reviewStatus, createdAt);
CREATE INDEX ImageResult_new_runId_createdAt_idx ON ImageResult_new(runId, createdAt);

INSERT INTO ImageResult_new (id, runId, filePath, thumbPath, width, height, fileSize, reviewStatus, featured, reviewedAt, createdAt, updatedAt)
SELECT id, positionRunId, filePath, thumbPath, width, height, fileSize, reviewStatus, featured, reviewedAt, createdAt, updatedAt
FROM ImageResult;

DROP TABLE ImageResult;
ALTER TABLE ImageResult_new RENAME TO ImageResult;

-- 3d: Drop old PositionRun
DROP TABLE PositionRun;

-- ==========================================================================
-- Step 4: Verify
-- ==========================================================================
PRAGMA foreign_keys = ON;
PRAGMA integrity_check;

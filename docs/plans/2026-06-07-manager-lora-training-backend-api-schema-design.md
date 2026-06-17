# Manager LoRA Training Backend API and Schema Design

日期：2026-06-07
状态：后端专项设计稿，可作为 Prisma schema 和 service/API implementation plan 输入
上游设计：`docs/plans/2026-06-07-manager-lora-training-final-technical-design.md`

## 1. Scope

本文只定义新的 LoRA Training v2 后端边界：

- Prisma table / enum 草案；
- server repository / service 分层；
- HTTP API route 与核心 request/response；
- 关键事务、校验、生命周期规则；
- 与已退役训练 v1 模型的关系。

本文不定义：

- 具体页面视觉；
- 训练脚本命令行细节；
- benchmark / promotion / 推荐权重；
- 已退役训练 v1 数据迁移。

已退役训练 v1 首版实现里包含 canonical version、prompt card、benchmark、promotion 等流程。新模块按 `Training*` 命名重新落表，旧实现只作为文件路径安全、artifact helper、worker 组织方式的参考，不作为新 API 兼容目标。

## 2. Backend Boundaries

### 2.1 Route Namespace

新 HTTP API 使用：

```text
/api/training/**
```

不继续扩展：

```text
retired training v1 API namespace
```

原因：

- 新设计的产品语言是 Project / Section / Run / Image，不是 Job / Canonical / Promotion；
- 旧 route 含 benchmark 和 promotion 语义，会污染首版边界；
- `/training/*` 页面路由和 `/api/training/*` 后端路由一一对应，便于维护。

### 2.2 Code Organization

```text
src/app/api/training/*
  route handlers, auth, request parsing

src/lib/actions/training/*
  UI server actions, thin wrappers over services

src/server/repositories/training/*
  Prisma reads/writes and query composition

src/server/services/training/*
  transaction flows, validation, artifact lifecycle, scheduling

src/server/worker/training/*
  generation task workers, caption workers, dataset freeze, training runner polling

src/lib/training/*
  enums, Zod schemas, DTO contracts, prompt rendering, reference resolving
```

API handlers must stay thin: parse, authenticate, call service, return JSON. Business invariants live in services. Prisma-specific query composition lives in repositories.

## 3. Response Contract

All JSON endpoints return one of:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

Recommended status codes:

```text
200 read/update/action success
201 create success
204 delete/soft remove success with no body
400 invalid input
401 unauthenticated
403 forbidden
404 not found
409 state conflict or invariant violation
500 unexpected server error
```

Common error codes:

```text
not_found
invalid_input
invalid_state
conflict
forbidden
artifact_path_escape
artifact_missing
dataset_not_ready
training_run_active
scheduler_busy
runner_unavailable
```

## 4. Prisma Enums

```prisma
enum TrainingProjectStatus {
  active
  archived
}

enum TrainingSceneDescriptionBlockSourceType {
  preset
  local
}

enum TrainingGenerationKind {
  text_generation
  image_generation
}

enum TrainingGenerationTaskType {
  profile_text_generation
  scene_description_generation
  image_prompt_generation
  caption_generation
  trainingset_generation
  reference_image_generation
}

enum TrainingTaskStatus {
  queued
  running
  succeeded
  failed
  cancelled
}

enum TrainingGenerationInputKind {
  internal_text
  internal_image
  supplemental_image
}

enum TrainingGenerationOutputKind {
  text
  image
}

enum TrainingCharacterImageType {
  original_reference
  generated_reference
  auxiliary_reference
}

enum TrainingImageResultSourceType {
  section_run
  result_upload
}

enum TrainingImageReviewStatus {
  pending
  kept
  rejected
}

enum TrainingDatasetRevisionStatus {
  freezing
  ready
  failed
}

enum TrainingRunStatus {
  queued
  running
  succeeded
  failed
  cancelled
}

enum TrainingRunWaitReason {
  none
  comfyui_queue_active
  gpu_busy
  scheduler_paused
}

enum TrainingRunnerType {
  local_wsl_sd_scripts
}

enum TrainingArtifactStorageRole {
  mutable_source
  revision_snapshot
  run_output
  protected_output
  temp
}

enum TrainingArtifactLifecycleStatus {
  active
  archived_cleaned
  deleted
}

enum TrainingTextRevisionReason {
  ai_generation
  before_overwrite
  idle_checkpoint
  run_snapshot
  dataset_freeze
  start_training
}
```

## 5. Prisma Models

The following schema is intended as an implementation draft. Some mutual exclusivity rules are enforced in services because Prisma does not express all conditional constraints portably.

### 5.1 Preset Library

```prisma
model TrainingSceneDescriptionPresetCategory {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String   @unique
  icon                  String?
  color                 String?
  sortOrder             Int      @default(0)
  sceneDescriptionOrder Int      @default(0)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  folders        TrainingSceneDescriptionPresetFolder[]
  presets        TrainingSceneDescriptionPreset[]
  templateBlocks TrainingTemplateSectionSceneDescriptionBlock[]
  projectBlocks  TrainingSceneDescriptionBlock[]

  @@index([sortOrder])
  @@index([sceneDescriptionOrder])
}

model TrainingSceneDescriptionPresetFolder {
  id         String   @id @default(cuid())
  categoryId String
  parentId   String?
  name       String
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  category TrainingSceneDescriptionPresetCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  parent   TrainingSceneDescriptionPresetFolder?  @relation("TrainingPresetFolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children TrainingSceneDescriptionPresetFolder[] @relation("TrainingPresetFolderTree")
  presets  TrainingSceneDescriptionPreset[]

  @@index([categoryId, parentId, sortOrder])
}

model TrainingSceneDescriptionPreset {
  id                   String   @id @default(cuid())
  categoryId           String
  folderId             String?
  name                 String
  slug                 String
  sceneDescriptionText String   @db.Text
  notes                String?  @db.Text
  sortOrder            Int      @default(0)
  isActive             Boolean  @default(true)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  category       TrainingSceneDescriptionPresetCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  folder         TrainingSceneDescriptionPresetFolder?  @relation(fields: [folderId], references: [id], onDelete: SetNull)
  templateBlocks TrainingTemplateSectionSceneDescriptionBlock[]
  projectBlocks  TrainingSceneDescriptionBlock[]

  @@unique([categoryId, slug])
  @@unique([categoryId, id])
  @@index([categoryId, folderId, sortOrder])
  @@index([isActive, sortOrder])
}
```

Preset delete is soft delete. Cascade delete action removes current mutable blocks/references first, then sets `isActive = false`. Historical snapshots are never rewritten.

### 5.2 Templates

```prisma
model TrainingTemplate {
  id                    String   @id @default(cuid())
  name                  String
  slug                  String?  @unique
  description           String?  @db.Text
  imagePromptGuidance   String   @db.Text
  imagePromptFormat     String   @db.Text
  captioningGuidance    String   @db.Text
  trainingCaptionFormat String   @db.Text
  trainingDefaultsJson  Json?
  sortOrder             Int      @default(0)
  isActive              Boolean  @default(true)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  sections TrainingTemplateSection[]

  @@index([isActive, sortOrder])
}

model TrainingTemplateSection {
  id                 String   @id @default(cuid())
  trainingTemplateId String
  name               String?
  sortOrder          Int      @default(0)
  enabled            Boolean  @default(true)
  sectionDefaultsJson Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  trainingTemplate TrainingTemplate @relation(fields: [trainingTemplateId], references: [id], onDelete: Cascade)
  blocks           TrainingTemplateSectionSceneDescriptionBlock[]

  @@index([trainingTemplateId, sortOrder])
}

model TrainingTemplateSectionSceneDescriptionBlock {
  id                               String                                    @id @default(cuid())
  trainingTemplateSectionId         String
  sceneDescriptionPresetCategoryId  String
  sourceType                       TrainingSceneDescriptionBlockSourceType
  sceneDescriptionPresetId          String?
  localText                        String?                                   @db.Text
  sortOrder                        Int                                       @default(0)
  enabled                          Boolean                                   @default(true)
  createdAt                        DateTime                                  @default(now())
  updatedAt                        DateTime                                  @updatedAt

  trainingTemplateSection        TrainingTemplateSection                  @relation(fields: [trainingTemplateSectionId], references: [id], onDelete: Cascade)
  sceneDescriptionPresetCategory TrainingSceneDescriptionPresetCategory   @relation(fields: [sceneDescriptionPresetCategoryId], references: [id], onDelete: Restrict)
  sceneDescriptionPreset         TrainingSceneDescriptionPreset?          @relation(fields: [sceneDescriptionPresetCategoryId, sceneDescriptionPresetId], references: [categoryId, id], onDelete: Restrict)

  @@index([trainingTemplateSectionId, sortOrder])
  @@index([sceneDescriptionPresetId])
}
```

Service validation:

- `sourceType = preset` requires `sceneDescriptionPresetId` and forbids `localText`;
- `sourceType = local` requires `localText` and forbids `sceneDescriptionPresetId`;
- preset category must match block category.

### 5.3 Projects, Profile, References

```prisma
model TrainingProject {
  id                    String                @id @default(cuid())
  name                  String
  slug                  String                @unique
  status                TrainingProjectStatus @default(active)
  archivedAt            DateTime?
  imagePromptGuidance   String                @db.Text
  imagePromptFormat     String                @db.Text
  captioningGuidance    String                @db.Text
  trainingCaptionFormat String                @db.Text
  trainingDefaultsJson  Json?
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt

  profile          TrainingCharacterProfile?
  sections         TrainingSection[]
  generationTasks  TrainingGenerationTask[]
  datasetRevisions TrainingDatasetRevision[]
  trainingRuns     TrainingRun[]
  artifacts        TrainingArtifact[]
  textRevisions    TrainingTextRevision[]

  @@index([status, updatedAt])
  @@index([archivedAt])
}

model TrainingCharacterProfile {
  id                                      String   @id @default(cuid())
  trainingProjectId                       String   @unique
  loraUsagePrompt                         String   @db.Text
  characterDetailPrompt                   String   @db.Text
  loraUsagePromptGenerationTaskId         String?
  characterDetailPromptGenerationTaskId   String?
  createdAt                               DateTime @default(now())
  updatedAt                               DateTime @updatedAt

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  images          TrainingCharacterImage[]
  sectionRuns     TrainingSectionRun[]
  imageResults    TrainingImageResult[]

  @@index([trainingProjectId])
}

model TrainingCharacterImage {
  id                          String                     @id @default(cuid())
  trainingCharacterProfileId   String
  artifactId                  String
  imageType                   TrainingCharacterImageType
  label                       String?
  note                        String?                    @db.Text
  sortOrder                   Int                        @default(0)
  sourceGenerationTaskOutputId String?
  createdAt                   DateTime                   @default(now())
  updatedAt                   DateTime                   @updatedAt

  profile                    TrainingCharacterProfile    @relation(fields: [trainingCharacterProfileId], references: [id], onDelete: Cascade)
  artifact                   TrainingArtifact            @relation(fields: [artifactId], references: [id], onDelete: Restrict)
  sourceGenerationTaskOutput TrainingGenerationTaskOutput? @relation(fields: [sourceGenerationTaskOutputId], references: [id], onDelete: SetNull)

  @@index([trainingCharacterProfileId, sortOrder])
  @@index([artifactId])
}
```

Training projects do not store `sourceTemplateId`, `sourceProjectId`, or template provenance. Template import copies rows and guidance fields.

### 5.4 Sections, Runs, Image Results

```prisma
model TrainingSection {
  id                  String   @id @default(cuid())
  trainingProjectId   String
  name                String?
  sortOrder           Int      @default(0)
  enabled             Boolean  @default(true)
  sectionDefaultsJson Json?
  latestRunId         String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  blocks          TrainingSceneDescriptionBlock[]
  runs            TrainingSectionRun[]

  @@index([trainingProjectId, sortOrder])
}

model TrainingSceneDescriptionBlock {
  id                              String                                   @id @default(cuid())
  trainingSectionId               String
  sceneDescriptionPresetCategoryId String
  sourceType                      TrainingSceneDescriptionBlockSourceType
  sceneDescriptionPresetId         String?
  localText                       String?                                  @db.Text
  sortOrder                       Int                                      @default(0)
  enabled                         Boolean                                  @default(true)
  createdAt                       DateTime                                 @default(now())
  updatedAt                       DateTime                                 @updatedAt

  trainingSection                TrainingSection                         @relation(fields: [trainingSectionId], references: [id], onDelete: Cascade)
  sceneDescriptionPresetCategory TrainingSceneDescriptionPresetCategory  @relation(fields: [sceneDescriptionPresetCategoryId], references: [id], onDelete: Restrict)
  sceneDescriptionPreset         TrainingSceneDescriptionPreset?         @relation(fields: [sceneDescriptionPresetCategoryId, sceneDescriptionPresetId], references: [categoryId, id], onDelete: Restrict)

  @@index([trainingSectionId, sortOrder])
  @@index([sceneDescriptionPresetId])
}

model TrainingSectionRun {
  id                         String             @id @default(cuid())
  trainingProjectId           String
  trainingSectionId           String
  trainingCharacterProfileId  String
  generationTaskId            String
  runIndex                    Int
  sceneDescriptionText        String             @db.Text
  imagePromptText             String             @db.Text
  provider                    String?
  model                       String?
  generationParamsJson        Json?
  status                      TrainingTaskStatus @default(queued)
  errorMessage                String?            @db.Text
  createdAt                   DateTime           @default(now())
  updatedAt                   DateTime           @updatedAt
  startedAt                   DateTime?
  finishedAt                  DateTime?

  trainingProject          TrainingProject          @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  trainingSection          TrainingSection          @relation(fields: [trainingSectionId], references: [id], onDelete: Cascade)
  trainingCharacterProfile TrainingCharacterProfile @relation(fields: [trainingCharacterProfileId], references: [id], onDelete: Restrict)
  generationTask           TrainingGenerationTask   @relation(fields: [generationTaskId], references: [id], onDelete: Restrict)
  imageResults             TrainingImageResult[]

  @@unique([trainingSectionId, runIndex])
  @@index([trainingProjectId, status])
  @@index([trainingSectionId, createdAt])
  @@index([generationTaskId])
}

model TrainingImageResult {
  id                         String                       @id @default(cuid())
  trainingProjectId           String
  trainingCharacterProfileId  String
  artifactId                 String
  sourceType                 TrainingImageResultSourceType
  trainingSectionRunId        String?
  generationTaskOutputId      String?
  reviewStatus               TrainingImageReviewStatus    @default(pending)
  trainingCaption             String?                      @db.Text
  captionGenerationTaskId     String?
  supplementalPrompt          String?                      @db.Text
  removedAt                  DateTime?
  removeReason               String?                      @db.Text
  filePathSnapshot            String?
  thumbnailArtifactId         String?
  width                      Int?
  height                     Int?
  mimeType                   String?
  fileSize                   BigInt?
  sha256                     String?
  createdAt                  DateTime                     @default(now())
  updatedAt                  DateTime                     @updatedAt

  trainingProject          TrainingProject          @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  trainingCharacterProfile TrainingCharacterProfile @relation(fields: [trainingCharacterProfileId], references: [id], onDelete: Restrict)
  artifact                 TrainingArtifact         @relation("TrainingImageResultArtifact", fields: [artifactId], references: [id], onDelete: Restrict)
  thumbnailArtifact        TrainingArtifact?        @relation("TrainingImageResultThumbnail", fields: [thumbnailArtifactId], references: [id], onDelete: SetNull)
  trainingSectionRun       TrainingSectionRun?      @relation(fields: [trainingSectionRunId], references: [id], onDelete: SetNull)
  generationTaskOutput     TrainingGenerationTaskOutput? @relation(fields: [generationTaskOutputId], references: [id], onDelete: SetNull)
  datasetItems             TrainingDatasetRevisionItem[]

  @@index([trainingProjectId, reviewStatus])
  @@index([trainingSectionRunId])
  @@index([artifactId])
  @@index([sha256])
}
```

Service validation:

- `sourceType = section_run` requires `trainingSectionRunId`;
- `sourceType = result_upload` forbids `trainingSectionRunId`;
- only `reviewStatus = kept` enters a dataset revision;
- if an image result has any dataset item, it cannot be hard deleted.

### 5.5 Artifacts

```prisma
model TrainingArtifact {
  id              String                          @id @default(cuid())
  trainingProjectId String
  storageKey      String
  filePath        String
  storageRole     TrainingArtifactStorageRole     @default(mutable_source)
  mimeType        String?
  fileSize        BigInt?
  sha256          String?
  width           Int?
  height          Int?
  lifecycleStatus TrainingArtifactLifecycleStatus  @default(active)
  metadata        Json?
  createdAt       DateTime                        @default(now())
  updatedAt       DateTime                        @updatedAt

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)

  characterImages         TrainingCharacterImage[]
  imageResultArtifacts    TrainingImageResult[] @relation("TrainingImageResultArtifact")
  imageResultThumbnails   TrainingImageResult[] @relation("TrainingImageResultThumbnail")
  generationTaskOutputs   TrainingGenerationTaskOutput[]
  generationInputArtifacts TrainingGenerationInputReference[] @relation("TrainingGenerationInputArtifact")
  generationSnapshotArtifacts TrainingGenerationInputReference[] @relation("TrainingGenerationSnapshotArtifact")
  datasetSourceItems      TrainingDatasetRevisionItem[] @relation("TrainingDatasetSourceArtifact")
  datasetSnapshotItems    TrainingDatasetRevisionItem[] @relation("TrainingDatasetSnapshotArtifact")
  datasetManifests        TrainingDatasetRevision[] @relation("TrainingDatasetManifestArtifact")
  configTrainingRuns      TrainingRun[] @relation("TrainingRunConfigArtifact")
  logTrainingRuns         TrainingRun[] @relation("TrainingRunLogArtifact")
  finalLoraTrainingRuns   TrainingRun[] @relation("TrainingRunFinalLoraArtifact")

  @@unique([trainingProjectId, storageKey])
  @@index([trainingProjectId, storageRole])
  @@index([sha256])
  @@index([lifecycleStatus])
}
```

File cleanup rules:

- normal business row delete never physically deletes files;
- project delete/archive is the only physical cleanup boundary;
- `revision_snapshot` and `protected_output` are excluded from disposable archive cleanup;
- every path operation must resolve under the project artifact root with safe path checks.

### 5.6 Generation Tasks

```prisma
model TrainingGenerationTask {
  id                 String                     @id @default(cuid())
  trainingProjectId  String
  generationKind     TrainingGenerationKind
  taskType           TrainingGenerationTaskType
  supplementalPrompt String?                    @db.Text
  status             TrainingTaskStatus         @default(queued)
  provider           String?
  model              String?
  paramsJson         Json?
  errorMessage       String?                    @db.Text
  createdAt          DateTime                   @default(now())
  updatedAt          DateTime                   @updatedAt
  startedAt          DateTime?
  finishedAt         DateTime?

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  inputs          TrainingGenerationInputReference[]
  outputs         TrainingGenerationTaskOutput[]
  sectionRuns     TrainingSectionRun[]

  @@index([trainingProjectId, status])
  @@index([taskType, createdAt])
}

model TrainingGenerationInputReference {
  id                       String                       @id @default(cuid())
  trainingGenerationTaskId  String
  inputKind                TrainingGenerationInputKind
  sourceEntityType         String?
  sourceEntityId           String?
  sourceField              String?
  artifactId               String?
  snapshotText             String?                      @db.Text
  snapshotArtifactId        String?
  snapshotFilePath          String?
  role                     String?
  purpose                  String?
  sortOrder                Int                          @default(0)
  createdAt                DateTime                     @default(now())

  trainingGenerationTask TrainingGenerationTask @relation(fields: [trainingGenerationTaskId], references: [id], onDelete: Cascade)
  artifact               TrainingArtifact?      @relation("TrainingGenerationInputArtifact", fields: [artifactId], references: [id], onDelete: Restrict)
  snapshotArtifact        TrainingArtifact?      @relation("TrainingGenerationSnapshotArtifact", fields: [snapshotArtifactId], references: [id], onDelete: Restrict)

  @@index([trainingGenerationTaskId, sortOrder])
  @@index([sourceEntityType, sourceEntityId])
  @@index([artifactId])
}

model TrainingGenerationTaskOutput {
  id                       String                       @id @default(cuid())
  trainingGenerationTaskId  String
  outputKind               TrainingGenerationOutputKind
  textValue                String?                      @db.Text
  artifactId               String?
  filePath                 String?
  targetEntityType         String?
  targetEntityId           String?
  targetField              String?
  appliedAt                DateTime?
  createdAt                DateTime                     @default(now())

  trainingGenerationTask TrainingGenerationTask @relation(fields: [trainingGenerationTaskId], references: [id], onDelete: Cascade)
  artifact               TrainingArtifact?      @relation(fields: [artifactId], references: [id], onDelete: Restrict)
  characterImages        TrainingCharacterImage[]
  imageResults           TrainingImageResult[]

  @@index([trainingGenerationTaskId])
  @@index([targetEntityType, targetEntityId])
  @@index([artifactId])
}
```

Generation task cardinality rules:

- First version does not support ComfyUI-style `batchSize`, `imageCount`, or multi-output generation parameters.
- One `TrainingGenerationTask` produces at most one final `TrainingGenerationTaskOutput`.
- `generationKind = image_generation` produces one image output.
- `generationKind = text_generation` produces one text output.
- GPT-Image-2 provider is treated as one image per request.
- To create multiple training images, reference images, captions, or text drafts, create multiple `TrainingGenerationTask` rows and group them by project/section/context instead of putting multiple outputs under one task.

Input snapshot rules:

- selected references can be mutable before task starts;
- when a task starts running, each input row stores `snapshotText` and/or `snapshotArtifactId`;
- task-level supplemental prompt remains on `TrainingGenerationTask.supplementalPrompt`, not as an input row.

### 5.7 Dataset Revisions

```prisma
model TrainingDatasetRevision {
  id                String                        @id @default(cuid())
  trainingProjectId String
  version           Int
  status            TrainingDatasetRevisionStatus @default(freezing)
  itemCount         Int                           @default(0)
  manifestArtifactId String?
  errorMessage      String?                       @db.Text
  createdAt         DateTime                      @default(now())
  updatedAt         DateTime                      @updatedAt
  frozenAt          DateTime?

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  manifestArtifact TrainingArtifact? @relation("TrainingDatasetManifestArtifact", fields: [manifestArtifactId], references: [id], onDelete: SetNull)
  items           TrainingDatasetRevisionItem[]
  trainingRuns    TrainingRun[]

  @@unique([trainingProjectId, version])
  @@index([trainingProjectId, status])
}

model TrainingDatasetRevisionItem {
  id                         String   @id @default(cuid())
  trainingDatasetRevisionId   String
  sourceTrainingImageResultId String
  sourceArtifactId            String
  snapshotArtifactId          String
  filePathSnapshot            String
  captionSnapshot             String   @db.Text
  loraUsagePromptSnapshot     String   @db.Text
  sceneDescriptionText        String?  @db.Text
  supplementalPromptSnapshot  String?  @db.Text
  captionContextSnapshot      Json?
  width                       Int?
  height                      Int?
  aspectBucket                String?
  sortOrder                   Int      @default(0)
  createdAt                   DateTime @default(now())

  datasetRevision       TrainingDatasetRevision @relation(fields: [trainingDatasetRevisionId], references: [id], onDelete: Cascade)
  sourceTrainingImageResult TrainingImageResult  @relation(fields: [sourceTrainingImageResultId], references: [id], onDelete: Restrict)
  sourceArtifact        TrainingArtifact         @relation("TrainingDatasetSourceArtifact", fields: [sourceArtifactId], references: [id], onDelete: Restrict)
  snapshotArtifact      TrainingArtifact         @relation("TrainingDatasetSnapshotArtifact", fields: [snapshotArtifactId], references: [id], onDelete: Restrict)

  @@unique([trainingDatasetRevisionId, sourceTrainingImageResultId])
  @@index([trainingDatasetRevisionId, sortOrder])
  @@index([sourceTrainingImageResultId])
  @@index([snapshotArtifactId])
}
```

Each start-training action creates a new immutable revision even if selected images and captions are unchanged.

### 5.8 Training Runs

```prisma
model TrainingRun {
  id                         String                 @id @default(cuid())
  trainingProjectId           String
  trainingDatasetRevisionId   String
  status                     TrainingRunStatus       @default(queued)
  baseCheckpointId            String?
  configArtifactId            String?
  trainingLogArtifactId       String?
  finalLoraArtifactId         String?
  runSummaryJson              Json?
  progressJson                Json?
  currentStep                 Int?
  totalSteps                  Int?
  waitReason                  TrainingRunWaitReason  @default(none)
  waitingSince                DateTime?
  schedulerMessage            String?                @db.Text
  runnerType                  TrainingRunnerType     @default(local_wsl_sd_scripts)
  runnerWorkspacePath         String?
  errorMessage                String?                @db.Text
  cancelRequestedAt           DateTime?
  createdPresetId             String?
  createdPresetVariantId      String?
  presetCreatedAt             DateTime?
  createdAt                   DateTime               @default(now())
  updatedAt                   DateTime               @updatedAt
  startedAt                   DateTime?
  finishedAt                  DateTime?

  trainingProject         TrainingProject         @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)
  trainingDatasetRevision TrainingDatasetRevision @relation(fields: [trainingDatasetRevisionId], references: [id], onDelete: Restrict)
  configArtifact          TrainingArtifact?       @relation("TrainingRunConfigArtifact", fields: [configArtifactId], references: [id], onDelete: SetNull)
  trainingLogArtifact     TrainingArtifact?       @relation("TrainingRunLogArtifact", fields: [trainingLogArtifactId], references: [id], onDelete: SetNull)
  finalLoraArtifact       TrainingArtifact?       @relation("TrainingRunFinalLoraArtifact", fields: [finalLoraArtifactId], references: [id], onDelete: SetNull)

  @@index([trainingProjectId, status])
  @@index([trainingDatasetRevisionId])
  @@index([finalLoraArtifactId])
}
```

Concurrency rules:

- one active `TrainingRun` per project;
- one running local GPU task across training and local ComfyUI generation;
- queued runs use `waitReason`, not a separate `waiting` status;
- successful run with `finalLoraArtifactId` can create exactly one role preset.

### 5.9 Text Revisions

```prisma
model TrainingTextRevision {
  id                String                     @id @default(cuid())
  trainingProjectId String
  entityType        String
  entityId          String
  fieldName         String
  textValue         String                     @db.Text
  reason            TrainingTextRevisionReason
  sourceTaskId      String?
  sourceRunId       String?
  createdAt         DateTime                   @default(now())

  trainingProject TrainingProject @relation(fields: [trainingProjectId], references: [id], onDelete: Cascade)

  @@index([trainingProjectId, entityType, entityId, fieldName, createdAt])
  @@index([sourceTaskId])
  @@index([sourceRunId])
}
```

`TrainingTextRevision` is a restore checkpoint table. It is not the live source of truth for rendering prompts or captions.

## 6. API Surface

### 6.1 Projects and Templates

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/templates` | list active templates | query: `includeInactive?` | `TrainingTemplateSummary[]` |
| `POST` | `/api/training/templates` | create template | `TrainingTemplateCreateInput` | `TrainingTemplateDetail` |
| `GET` | `/api/training/templates/:templateId` | template detail | none | `TrainingTemplateDetail` |
| `PATCH` | `/api/training/templates/:templateId` | update template metadata/defaults | `TrainingTemplateUpdateInput` | `TrainingTemplateDetail` |
| `DELETE` | `/api/training/templates/:templateId` | soft deactivate template | none | 204 |
| `POST` | `/api/training/templates/:templateId/projects` | create project from template | `{ name, slug? }` | `TrainingProjectDetail` |
| `POST` | `/api/training/projects/:projectId/save-as-template` | copy project to template | `{ name, slug?, description? }` | `TrainingTemplateDetail` |
| `GET` | `/api/training/projects` | list projects | query: `status?` | `TrainingProjectSummary[]` |
| `POST` | `/api/training/projects` | create blank project | `TrainingProjectCreateInput` | `TrainingProjectDetail` |
| `GET` | `/api/training/projects/:projectId` | project detail | none | `TrainingProjectDetail` |
| `PATCH` | `/api/training/projects/:projectId` | update project defaults/status fields | `TrainingProjectUpdateInput` | `TrainingProjectDetail` |
| `DELETE` | `/api/training/projects/:projectId` | delete project completely | none | `ProjectCleanupResult` |
| `POST` | `/api/training/projects/:projectId/archive` | archive project | none | `ProjectArchiveResult` |

`TrainingProjectDetail` should include profile, sections with block summaries, image result counts, latest training run summary, and dataset readiness summary.

### 6.2 Profile and Reference Images

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/profile` | read profile | none | `TrainingCharacterProfileDetail` |
| `PATCH` | `/api/training/projects/:projectId/profile` | update `loraUsagePrompt` / `characterDetailPrompt` | partial profile fields | `TrainingCharacterProfileDetail` |
| `GET` | `/api/training/projects/:projectId/reference-images` | list reference images | none | `TrainingCharacterImage[]` |
| `POST` | `/api/training/projects/:projectId/reference-images` | upload/register reference image | multipart file or `{ artifactId, imageType, label?, note? }` | `TrainingCharacterImage` |
| `PATCH` | `/api/training/reference-images/:imageId` | update label/note/type/order | partial fields | `TrainingCharacterImage` |
| `DELETE` | `/api/training/reference-images/:imageId` | remove reference row only | none | 204 |
| `POST` | `/api/training/reference-images/:imageId/add-to-results` | add reference artifact to result pool | `{ supplementalPrompt? }` | `TrainingImageResult` |

### 6.3 Scene Description Presets and Blocks

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/scene-description/categories` | list categories/folders/presets tree | query: `includeInactive?` | `TrainingSceneDescriptionTree` |
| `POST` | `/api/training/scene-description/categories` | create category | `{ name, slug, icon?, color?, sortOrder?, sceneDescriptionOrder? }` | category |
| `PATCH` | `/api/training/scene-description/categories/:categoryId` | update category | partial fields | category |
| `DELETE` | `/api/training/scene-description/categories/:categoryId` | delete empty category | none | 204 |
| `POST` | `/api/training/scene-description/folders` | create folder | `{ categoryId, parentId?, name, sortOrder? }` | folder |
| `PATCH` | `/api/training/scene-description/folders/:folderId` | update/move folder | partial fields | folder |
| `DELETE` | `/api/training/scene-description/folders/:folderId` | delete empty folder | none | 204 |
| `POST` | `/api/training/scene-description/presets` | create preset | preset fields | preset |
| `PATCH` | `/api/training/scene-description/presets/:presetId` | update preset | partial fields | preset |
| `GET` | `/api/training/scene-description/presets/:presetId/usage` | usage before delete | none | usage summary |
| `DELETE` | `/api/training/scene-description/presets/:presetId/cascade` | remove mutable refs and soft delete | `{ confirm: true }` | cascade result |
| `GET` | `/api/training/sections/:sectionId/scene-description` | resolved current sceneDescription | none | `{ text, blocks }` |
| `POST` | `/api/training/sections/:sectionId/blocks` | create project block | block input | block |
| `PATCH` | `/api/training/blocks/:blockId` | update block | block update | block |
| `DELETE` | `/api/training/blocks/:blockId` | remove block row | none | 204 |
| `POST` | `/api/training/blocks/:blockId/detach` | convert preset block to local | `{ editedText }` | block |
| `POST` | `/api/training/sections/:sectionId/blocks/reorder` | reorder blocks | `{ ids: string[] }` | block list |

### 6.4 Sections and Section Runs

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/sections` | list sections | none | `TrainingSectionDetail[]` |
| `POST` | `/api/training/projects/:projectId/sections` | create section | `{ name?, sortOrder?, enabled?, sectionDefaultsJson? }` | section |
| `PATCH` | `/api/training/sections/:sectionId` | update section | partial fields | section |
| `DELETE` | `/api/training/sections/:sectionId` | delete section rows, keep artifacts | none | 204 |
| `POST` | `/api/training/projects/:projectId/sections/reorder` | reorder sections | `{ ids: string[] }` | section list |
| `POST` | `/api/training/sections/:sectionId/runs` | render prompt and enqueue image generation | `{ supplementalPrompt?, referenceIds?, params? }` | `TrainingSectionRun` |
| `GET` | `/api/training/sections/:sectionId/runs` | list section runs | none | `TrainingSectionRun[]` |
| `GET` | `/api/training/section-runs/:runId` | run detail | none | run detail |
| `POST` | `/api/training/section-runs/:runId/cancel` | cancel queued/running generation | none | run detail |

Creating a section run also creates a `TrainingGenerationTask(taskType=image_prompt_generation or trainingset_generation)` and snapshots `sceneDescriptionText` and `imagePromptText`.

### 6.5 Generation Tasks

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/generation-tasks` | list tasks | query: `status?, taskType?` | task summary list |
| `POST` | `/api/training/projects/:projectId/generation-tasks` | create draft/queued task | `{ generationKind, taskType, supplementalPrompt?, paramsJson? }` | task detail |
| `GET` | `/api/training/generation-tasks/:taskId` | task detail | none | task detail |
| `PATCH` | `/api/training/generation-tasks/:taskId` | update draft task metadata | partial task fields | task detail |
| `DELETE` | `/api/training/generation-tasks/:taskId` | cancel/remove non-running task | none | 204 |
| `POST` | `/api/training/generation-tasks/:taskId/inputs` | add input reference | reference input | input row |
| `DELETE` | `/api/training/generation-inputs/:inputId` | remove input reference before run | none | 204 |
| `POST` | `/api/training/generation-tasks/:taskId/supplemental-images` | upload task-local image | multipart file | input row |
| `POST` | `/api/training/generation-tasks/:taskId/preview` | render provider-facing prompt preview | none | preview |
| `POST` | `/api/training/generation-tasks/:taskId/run` | snapshot inputs and enqueue/run | none | task detail |
| `GET` | `/api/training/generation-tasks/:taskId/outputs` | list task output | none | output list, first version returns 0 or 1 row |
| `POST` | `/api/training/generation-outputs/:outputId/apply` | apply output to business target | `{ targetEntityType, targetEntityId, targetField }` | apply result |

Valid text reference sources:

```text
TrainingCharacterProfile.loraUsagePrompt
TrainingCharacterProfile.characterDetailPrompt
TrainingSection.sceneDescription
TrainingSceneDescriptionBlock.localText / resolved preset text
TrainingSceneDescriptionPreset.sceneDescriptionText
TrainingSectionRun.sceneDescriptionText
TrainingSectionRun.imagePromptText
TrainingImageResult.trainingCaption
TrainingImageResult.supplementalPrompt
TrainingGenerationTaskOutput.textValue
```

Valid image reference sources:

```text
TrainingCharacterImage
TrainingImageResult.artifactId
TrainingGenerationTaskOutput(outputKind=image).artifactId
TrainingDatasetRevisionItem.snapshotArtifactId
```

### 6.6 Image Results and Captions

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/image-results` | list result pool | query: `reviewStatus?, includeRemoved?` | image result list |
| `POST` | `/api/training/projects/:projectId/image-results/upload` | upload result image | multipart file + `supplementalPrompt?` | `TrainingImageResult` |
| `PATCH` | `/api/training/image-results/:imageResultId` | update caption/supplementalPrompt/review status | partial fields | image result |
| `DELETE` | `/api/training/image-results/:imageResultId` | soft remove or hard delete if never frozen | none | 204 |
| `POST` | `/api/training/image-results/:imageResultId/review` | set pending/kept/rejected | `{ reviewStatus }` | image result |
| `POST` | `/api/training/image-results/:imageResultId/caption` | generate/regenerate caption | `{ taskInput? }` | image result + task |
| `POST` | `/api/training/projects/:projectId/captions/generate` | bulk create single-image caption tasks | `{ mode: "kept_without_captions" | "selected", imageResultIds? }` | task summary |

Bulk caption generation is only a convenience API for creating multiple single-output `TrainingGenerationTask` rows. Each selected image gets its own task and produces at most one caption output.

Delete behavior:

- if the image result is not referenced by any dataset item, service may hard delete the row but must not delete the artifact file;
- if referenced by any dataset item, set `removedAt` and keep the row.

### 6.7 Dataset Revisions and Training Runs

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/dataset-readiness` | validate current kept images | none | readiness report |
| `GET` | `/api/training/projects/:projectId/dataset-revisions` | list revisions | none | revision list |
| `POST` | `/api/training/projects/:projectId/dataset-revisions` | freeze current kept dataset | none | revision detail |
| `GET` | `/api/training/dataset-revisions/:revisionId` | revision detail | none | revision detail |
| `POST` | `/api/training/projects/:projectId/training-runs` | create revision if needed and enqueue training | `{ revisionId?, config }` | training run |
| `GET` | `/api/training/projects/:projectId/training-runs` | list project training runs | none | run list |
| `GET` | `/api/training/training-runs/:trainingRunId` | training run detail | none | run detail |
| `POST` | `/api/training/training-runs/:trainingRunId/cancel` | cancel queued/running run | none | run detail |
| `POST` | `/api/training/training-runs/:trainingRunId/poll` | internal/manual progress poll | none | run detail |
| `POST` | `/api/training/training-runs/:trainingRunId/cleanup` | cleanup intermediate outputs after finish | none | cleanup result |
| `POST` | `/api/training/training-runs/:trainingRunId/create-preset` | create role preset from final LoRA | `{ presetName?, categoryId? }` | preset/variant ids |

Start training transaction:

```text
1. validate readiness
2. if no revisionId, create TrainingDatasetRevision(version = max + 1, status = freezing)
3. copy kept images to revision snapshot artifacts
4. create TrainingDatasetRevisionItem rows
5. write manifest artifact
6. mark revision ready
7. create TrainingRun(status = queued, revisionId)
8. trigger scheduler tick
```

### 6.8 Text Revisions

| Method | Path | Purpose | Body | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/training/projects/:projectId/text-revisions` | list revisions for field/entity | query: `entityType, entityId, fieldName` | revision list |
| `POST` | `/api/training/projects/:projectId/text-revisions` | create checkpoint | revision input | revision |
| `POST` | `/api/training/text-revisions/:revisionId/restore` | restore checkpoint to live field | none | restore result |

Restore behavior:

```text
1. load target live field
2. create before_overwrite checkpoint
3. write selected revision text to target field
4. return updated entity summary
```

### 6.9 Scheduler and Worker Internal APIs

Internal endpoints may be added under:

```text
/api/training/worker/**
/api/training/scheduler/**
```

Initial set:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/training/scheduler/status` | local GPU scheduler state |
| `POST` | `/api/training/scheduler/tick` | attempt to start next eligible queued task |
| `POST` | `/api/training/worker/generation-tasks/:taskId/complete` | worker marks generation task completed |
| `POST` | `/api/training/worker/generation-tasks/:taskId/fail` | worker marks generation task failed |
| `POST` | `/api/training/worker/training-runs/:trainingRunId/progress` | runner progress heartbeat |
| `POST` | `/api/training/worker/training-runs/:trainingRunId/complete` | runner final artifact collection |
| `POST` | `/api/training/worker/training-runs/:trainingRunId/fail` | runner failure |

These routes require local/internal auth. Public UI should use project/task/run endpoints instead.

## 7. Core Service Flows

### 7.1 Template Import

```text
createTrainingProjectFromTemplate(templateId, input)
-> load active template with sections and blocks
-> create project + profile stub in one transaction
-> copy project-level guidance/defaults
-> copy sections
-> copy blocks
   - preset blocks keep preset/category ids
   - local blocks copy localText
-> no sourceTemplateId or sourceBlockId is stored
```

### 7.2 Scene Description Resolver

```text
resolveTrainingSectionSceneDescription(sectionId)
-> load enabled blocks with category and preset
-> sort by category.sceneDescriptionOrder then block.sortOrder
-> resolve preset sceneDescriptionText for preset blocks
-> use localText for local blocks
-> trim empty text
-> join with newline
```

### 7.3 Image Prompt Render

```text
characterDetailPrompt
+ resolved sceneDescription
+ TrainingGenerationTask.supplementalPrompt
+ TrainingProject.imagePromptGuidance
+ TrainingProject.imagePromptFormat
-> TrainingSectionRun.imagePromptText
```

### 7.4 Caption Render

```text
actual image
+ loraUsagePrompt
+ sceneDescription snapshot
+ TrainingImageResult.supplementalPrompt
+ TrainingGenerationTask.supplementalPrompt
+ TrainingProject.captioningGuidance
+ TrainingProject.trainingCaptionFormat
-> TrainingImageResult.trainingCaption
```

### 7.5 Dataset Freeze

Readiness checks:

```text
- project has at least one kept image
- every kept image has non-empty trainingCaption
- source artifact files exist
- runner config prerequisites exist
```

Freeze copies source files into:

```text
data/training/<projectSlug>/revisions/<version>/images/*
```

The exact root should be resolved by an artifact service and guarded with safe path checks. `TrainingRun` reads only revision snapshot files.

### 7.6 Training Runner Adapter

```ts
interface TrainingRunner {
  prepareDatasetAndConfig(runId: string): Promise<RunnerPreparedResult>;
  start(runId: string): Promise<RunnerStartResult>;
  pollProgress(runId: string): Promise<RunnerProgressResult>;
  requestCancel(runId: string): Promise<void>;
  collectArtifacts(runId: string): Promise<RunnerArtifactResult>;
}
```

First adapter:

```text
local_wsl_sd_scripts
```

The service layer stores:

- config artifact;
- log artifact;
- final LoRA artifact;
- run summary JSON;
- progress JSON;
- runner workspace path.

It must not expose command construction details to route handlers or UI components.

## 8. Repository and Service Split

Recommended repository modules:

```text
src/server/repositories/training/projects.ts
src/server/repositories/training/templates.ts
src/server/repositories/training/profiles.ts
src/server/repositories/training/reference-images.ts
src/server/repositories/training/scene-description-presets.ts
src/server/repositories/training/sections.ts
src/server/repositories/training/section-runs.ts
src/server/repositories/training/image-results.ts
src/server/repositories/training/generation-tasks.ts
src/server/repositories/training/dataset-revisions.ts
src/server/repositories/training/training-runs.ts
src/server/repositories/training/artifacts.ts
src/server/repositories/training/text-revisions.ts
```

Recommended service modules:

```text
src/server/services/training/project-service.ts
src/server/services/training/template-service.ts
src/server/services/training/profile-service.ts
src/server/services/training/reference-image-service.ts
src/server/services/training/scene-description-service.ts
src/server/services/training/section-service.ts
src/server/services/training/section-run-service.ts
src/server/services/training/image-result-service.ts
src/server/services/training/caption-service.ts
src/server/services/training/generation-task-service.ts
src/server/services/training/dataset-freeze-service.ts
src/server/services/training/training-run-service.ts
src/server/services/training/training-scheduler-service.ts
src/server/services/training/training-runner-service.ts
src/server/services/training/artifact-service.ts
src/server/services/training/project-cleanup-service.ts
src/server/services/training/text-revision-service.ts
```

## 9. Invariants

### 9.1 Mutability

- Project/profile/section/block/image result rows are mutable current workspace state.
- Section run prompt text, task input snapshots, dataset revision items, and training run artifacts are historical state.
- Historical state is append-only except explicit cleanup of intermediate files after runs finish.

### 9.2 Delete and Archive

- Ordinary business row deletion does not delete artifact files.
- Project delete can remove all project-local rows and files after cancelling active work.
- Project archive requires a succeeded training run and protected outputs.
- Archive cleanup removes disposable artifacts only.

### 9.3 Scheduler

- No separate `waiting` status.
- Waiting uses `queued + waitReason`.
- A running training run blocks new local ComfyUI image generation.
- Active local ComfyUI queue blocks training start and sets `waitReason = comfyui_queue_active`.

### 9.4 Preset Delete

- Current mutable blocks/references can be removed or invalidated.
- Historical task snapshots, section runs, and dataset revision items are never rewritten.
- Draft task references to inactive presets must be shown as unavailable.

## 10. Implementation Conventions

These conventions are part of the backend design:

- new module artifact root uses `TRAINING_ARTIFACT_ROOT` exposed as `env.trainingArtifactRoot`;
- default artifact root is `data/training`;
- file copy should preserve extension and sha256, and may deduplicate within one revision if source hashes match;
- `manifestArtifactId` points to a JSON manifest artifact with `storageRole = revision_snapshot`;
- API DTO schemas should be written in `src/lib/training/schemas.ts` with Zod before route handlers are implemented;
- relation names may need minor Prisma adjustments during schema compilation.

## 11. Implementation Readiness

Before coding:

1. Add enums and models to `prisma/schema.prisma` and `prisma/schema.sqlite.prisma` if sqlite schema is still maintained.
2. Generate Prisma client.
3. Add DTO/Zod contracts.
4. Implement repositories first with narrow query helpers.
5. Implement services in this order:
   - artifact path service;
   - project/template/profile;
   - sceneDescription presets/blocks/resolver;
   - generation task skeleton;
   - image results/captions;
   - dataset freeze;
   - training run scheduler/runner adapter.
6. Add API routes only after services have unit-level tests or direct service verification.

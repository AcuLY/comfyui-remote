import { createPrismaClient } from "../src/lib/prisma";

const prisma = createPrismaClient();

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

async function main() {
  // --- Projects ---
  const mikuJob = await prisma.project.upsert({
    where: { slug: "miku-spring-batch-a" },
    update: {
      title: "Miku spring batch A",
      status: "running",
      notes: "Seed project used by local queue, project list, and review screens.",
    },
    create: {
      title: "Miku spring batch A",
      slug: "miku-spring-batch-a",
      status: "running",
      notes: "Seed project used by local queue, project list, and review screens.",
    },
  });

  const tangtangJob = await prisma.project.upsert({
    where: { slug: "tangtang-park-test" },
    update: {
      title: "Tangtang park test",
      status: "draft",
      notes: "Secondary seed project for list and detail coverage.",
    },
    create: {
      title: "Tangtang park test",
      slug: "tangtang-park-test",
      status: "draft",
      notes: "Secondary seed project for list and detail coverage.",
    },
  });

  // --- Sections ---
  let mikuStanding = await prisma.projectSection.findFirst({
    where: { projectId: mikuJob.id, name: "Standing" },
  });
  if (!mikuStanding) {
    mikuStanding = await prisma.projectSection.create({
      data: {
        projectId: mikuJob.id,
        sortOrder: 1,
        enabled: true,
        name: "Standing",
        batchSize: 9,
        aspectRatio: "3:4",
        seedPolicy1: "random",
        seedPolicy2: "random",
      },
    });
  }

  let mikuWatching = await prisma.projectSection.findFirst({
    where: { projectId: mikuJob.id, name: "Watching" },
  });
  if (!mikuWatching) {
    mikuWatching = await prisma.projectSection.create({
      data: {
        projectId: mikuJob.id,
        sortOrder: 2,
        enabled: true,
        name: "Watching",
        batchSize: 9,
        aspectRatio: "3:4",
        seedPolicy1: "random",
        seedPolicy2: "random",
      },
    });
  }

  let tangtangBench = await prisma.projectSection.findFirst({
    where: { projectId: tangtangJob.id, name: "Bench sit" },
  });
  if (!tangtangBench) {
    tangtangBench = await prisma.projectSection.create({
      data: {
        projectId: tangtangJob.id,
        sortOrder: 1,
        enabled: true,
        name: "Bench sit",
        batchSize: 9,
        aspectRatio: "3:4",
        seedPolicy1: "random",
        seedPolicy2: "random",
      },
    });
  }

  // --- Runs ---
  const standingRun = await prisma.run.upsert({
    where: { id: "seed-run-miku-standing" },
    update: {
      projectId: mikuJob.id,
      projectSectionId: mikuStanding.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/miku-spring-batch-a/standing/run-01/raw",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.75),
    },
    create: {
      id: "seed-run-miku-standing",
      projectId: mikuJob.id,
      projectSectionId: mikuStanding.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/miku-spring-batch-a/standing/run-01/raw",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.75),
    },
  });

  const watchingRun = await prisma.run.upsert({
    where: { id: "seed-run-miku-watching" },
    update: {
      projectId: mikuJob.id,
      projectSectionId: mikuWatching.id,
      runIndex: 2,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/miku-spring-batch-a/watching/run-02/raw",
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3.5),
    },
    create: {
      id: "seed-run-miku-watching",
      projectId: mikuJob.id,
      projectSectionId: mikuWatching.id,
      runIndex: 2,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/miku-spring-batch-a/watching/run-02/raw",
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3.5),
    },
  });

  const benchRun = await prisma.run.upsert({
    where: { id: "seed-run-tangtang-bench" },
    update: {
      projectId: tangtangJob.id,
      projectSectionId: tangtangBench.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/tangtang-park-test/bench-sit/run-01/raw",
      startedAt: hoursAgo(5),
      finishedAt: hoursAgo(4.5),
    },
    create: {
      id: "seed-run-tangtang-bench",
      projectId: tangtangJob.id,
      projectSectionId: tangtangBench.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: { batchSize: 9 },
      outputDir: "data/images/tangtang-park-test/bench-sit/run-01/raw",
      startedAt: hoursAgo(5),
      finishedAt: hoursAgo(4.5),
    },
  });

  await prisma.projectSection.update({ where: { id: mikuStanding.id }, data: { latestRunId: standingRun.id } });
  await prisma.projectSection.update({ where: { id: mikuWatching.id }, data: { latestRunId: watchingRun.id } });
  await prisma.projectSection.update({ where: { id: tangtangBench.id }, data: { latestRunId: benchRun.id } });

  // --- Images ---
  const seedImages = [
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `seed-image-miku-standing-${index + 1}`,
      runId: standingRun.id,
      filePath: `data/images/miku-spring-batch-a/standing/run-01/raw/${String(index + 1).padStart(2, "0")}.png`,
      thumbPath: `data/images/miku-spring-batch-a/standing/run-01/thumb/${String(index + 1).padStart(2, "0")}.jpg`,
      width: 900,
      height: 1200,
      fileSize: BigInt(280000 + index * 1000),
      reviewStatus: index < 2 ? "kept" : index === 3 ? "trashed" : "pending",
      reviewedAt: index < 2 || index === 3 ? hoursAgo(2.5) : null,
    })),
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `seed-image-miku-watching-${index + 1}`,
      runId: watchingRun.id,
      filePath: `data/images/miku-spring-batch-a/watching/run-02/raw/${String(index + 1).padStart(2, "0")}.png`,
      thumbPath: `data/images/miku-spring-batch-a/watching/run-02/thumb/${String(index + 1).padStart(2, "0")}.jpg`,
      width: 900,
      height: 1200,
      fileSize: BigInt(285000 + index * 1000),
      reviewStatus: index < 5 ? "kept" : "pending",
      reviewedAt: index < 5 ? hoursAgo(3.25) : null,
    })),
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `seed-image-tangtang-bench-${index + 1}`,
      runId: benchRun.id,
      filePath: `data/images/tangtang-park-test/bench-sit/run-01/raw/${String(index + 1).padStart(2, "0")}.png`,
      thumbPath: `data/images/tangtang-park-test/bench-sit/run-01/thumb/${String(index + 1).padStart(2, "0")}.jpg`,
      width: 900,
      height: 1200,
      fileSize: BigInt(275000 + index * 1000),
      reviewStatus: "pending",
      reviewedAt: null,
    })),
  ];

  for (const image of seedImages) {
    await prisma.imageResult.upsert({
      where: { id: image.id },
      update: image,
      create: image,
    });
  }

  // --- Trash Record ---
  await prisma.trashRecord.upsert({
    where: { imageResultId: "seed-image-miku-standing-4" },
    update: {
      originalPath: "data/images/miku-spring-batch-a/standing/run-01/raw/04.png",
      trashPath: "data/images/.trash/miku-standing-04.png",
      reason: "Seed trashed image for restore flow.",
      deletedAt: hoursAgo(2.5),
      restoredAt: null,
      actorType: "user",
    },
    create: {
      imageResultId: "seed-image-miku-standing-4",
      originalPath: "data/images/miku-spring-batch-a/standing/run-01/raw/04.png",
      trashPath: "data/images/.trash/miku-standing-04.png",
      reason: "Seed trashed image for restore flow.",
      deletedAt: hoursAgo(2.5),
      restoredAt: null,
      actorType: "user",
    },
  });

  // --- LoRA Assets ---
  await prisma.loraAsset.upsert({
    where: { absolutePath: "D:/ComfyUI/models/loras/characters/miku-v3.safetensors" },
    update: {
      name: "miku-v3.safetensors",
      category: "characters",
      fileName: "miku-v3.safetensors",
      relativePath: "characters/miku-v3.safetensors",
      size: BigInt(1024 * 1024 * 128),
      source: "seed",
      notes: "Seed LoRA asset entry.",
    },
    create: {
      name: "miku-v3.safetensors",
      category: "characters",
      fileName: "miku-v3.safetensors",
      absolutePath: "D:/ComfyUI/models/loras/characters/miku-v3.safetensors",
      relativePath: "characters/miku-v3.safetensors",
      size: BigInt(1024 * 1024 * 128),
      source: "seed",
      notes: "Seed LoRA asset entry.",
    },
  });

  await prisma.loraAsset.upsert({
    where: { absolutePath: "D:/ComfyUI/models/loras/styles/soft-cinema.safetensors" },
    update: {
      name: "soft-cinema.safetensors",
      category: "styles",
      fileName: "soft-cinema.safetensors",
      relativePath: "styles/soft-cinema.safetensors",
      size: BigInt(1024 * 1024 * 96),
      source: "seed",
      notes: "Seed style LoRA asset entry.",
    },
    create: {
      name: "soft-cinema.safetensors",
      category: "styles",
      fileName: "soft-cinema.safetensors",
      absolutePath: "D:/ComfyUI/models/loras/styles/soft-cinema.safetensors",
      relativePath: "styles/soft-cinema.safetensors",
      size: BigInt(1024 * 1024 * 96),
      source: "seed",
      notes: "Seed style LoRA asset entry.",
    },
  });

  // ─── Character LoRA Training Module ────────────────────────────────────────

  // Training template
  const loraTemplate = await prisma.characterLoraTrainingTemplate.upsert({
    where: { key: "character_identity_default" },
    update: {},
    create: {
      key: "character_identity_default",
      name: "角色身份默认模板",
      description: "标准四视图人设图 + 多模块训练集流程",
      baseFamily: "sdxl",
      captionStrategyDefault: "controllable_identity",
      canonicalDefaults: {
        provider: "openai-codex",
        imageModel: "gpt-image-2",
        size: "1024x1536",
        quality: "high",
      },
      promptCardDefaults: { provider: "openai-codex" },
      trainingDefaults: {
        steps: 1500,
        learningRate: 1e-4,
        networkDim: 32,
        networkAlpha: 16,
        resolution: "1024,1024",
      },
      benchmarkDefaults: { prompts: 5, stepsPerPrompt: 30 },
      promotionDefaults: { minBenchmarkScore: 0.7 },
      isActive: true,
      sortOrder: 1,
    },
  });

  // Job: Active training in canonical_pending phase
  const artifactRoot = "data/character-lora-training/mock-miku-lora";
  const loraJob = await prisma.characterLoraTrainingJob.upsert({
    where: { slug: "mock-miku-lora" },
    update: {},
    create: {
      slug: "mock-miku-lora",
      characterName: "初音ミク",
      triggerToken: "1miku",
      status: "canonical_pending",
      phase: "canonical",
      trainingScope: {
        views: ["front", "back", "left", "right"],
        sectionKeys: ["standing_front", "standing_back", "pose_dynamic"],
      },
      captionStrategy: "controllable_identity",
      baseFamily: "sdxl",
      artifactRoot,
      trainingTemplateId: loraTemplate.id,
      trainingTemplateSnapshot: {
        key: loraTemplate.key,
        name: loraTemplate.name,
        canonicalDefaults: loraTemplate.canonicalDefaults,
      },
      createdBy: "seed",
    },
  });

  // Artifacts for source images
  const sourceArtifactFront = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "source-images/ref-front-01.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "source_image",
      relativePath: "source-images/ref-front-01.png",
      sha256: "aaa111front",
      byteSize: BigInt(50000),
      mimeType: "image/png",
    },
  });
  const sourceArtifactSide = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "source-images/ref-side-01.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "source_image",
      relativePath: "source-images/ref-side-01.png",
      sha256: "bbb222side",
      byteSize: BigInt(48000),
      mimeType: "image/png",
    },
  });
  const sourceArtifactBack = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "source-images/ref-back-01.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "source_image",
      relativePath: "source-images/ref-back-01.png",
      sha256: "ccc333back",
      byteSize: BigInt(47000),
      mimeType: "image/png",
    },
  });

  // Source images
  await prisma.characterLoraSourceImage.upsert({
    where: { jobId_sha256_role: { jobId: loraJob.id, sha256: "aaa111front", role: "reference" } },
    update: {},
    create: {
      jobId: loraJob.id,
      role: "reference",
      artifactId: sourceArtifactFront.id,
      filePath: "source-images/ref-front-01.png",
      sha256: "aaa111front",
      width: 512,
      height: 768,
      sortOrder: 1,
    },
  });
  await prisma.characterLoraSourceImage.upsert({
    where: { jobId_sha256_role: { jobId: loraJob.id, sha256: "bbb222side", role: "reference" } },
    update: {},
    create: {
      jobId: loraJob.id,
      role: "reference",
      artifactId: sourceArtifactSide.id,
      filePath: "source-images/ref-side-01.png",
      sha256: "bbb222side",
      width: 512,
      height: 768,
      sortOrder: 2,
    },
  });
  await prisma.characterLoraSourceImage.upsert({
    where: { jobId_sha256_role: { jobId: loraJob.id, sha256: "ccc333back", role: "reference" } },
    update: {},
    create: {
      jobId: loraJob.id,
      role: "reference",
      artifactId: sourceArtifactBack.id,
      filePath: "source-images/ref-back-01.png",
      sha256: "ccc333back",
      width: 512,
      height: 768,
      sortOrder: 3,
    },
  });

  // Artifacts for canonical images
  const canonicalArtifactFrontV1 = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "canonical/front-v1.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "canonical_image",
      relativePath: "canonical/front-v1.png",
      sha256: "canon_front_v1_hash",
      byteSize: BigInt(120000),
      mimeType: "image/png",
    },
  });
  const canonicalArtifactFrontV2 = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "canonical/front-v2.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "canonical_image",
      relativePath: "canonical/front-v2.png",
      sha256: "canon_front_v2_hash",
      byteSize: BigInt(125000),
      mimeType: "image/png",
    },
  });
  const canonicalArtifactBackV1 = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "canonical/back-v1.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "canonical_image",
      relativePath: "canonical/back-v1.png",
      sha256: "canon_back_v1_hash",
      byteSize: BigInt(118000),
      mimeType: "image/png",
    },
  });
  const canonicalArtifactLeftV1 = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "canonical/left-v1.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "canonical_image",
      relativePath: "canonical/left-v1.png",
      sha256: "canon_left_v1_hash",
      byteSize: BigInt(110000),
      mimeType: "image/png",
    },
  });
  const canonicalArtifactRightV1 = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "canonical/right-v1.png" } },
    update: {},
    create: {
      jobId: loraJob.id,
      kind: "canonical_image",
      relativePath: "canonical/right-v1.png",
      sha256: "canon_right_v1_hash",
      byteSize: BigInt(112000),
      mimeType: "image/png",
    },
  });

  // Generation runs
  const genRunFrontV1 = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      kind: "canonical",
      canonicalView: "front",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate front view canonical reference",
      visualPrompt: "Full body front view, standing pose, white background",
      toolParams: { size: "1024x1536", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(48),
      finishedAt: hoursAgo(47.5),
      createdAt: hoursAgo(48),
    },
  });
  const genRunFrontV2 = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      kind: "canonical",
      canonicalView: "front",
      parentRunId: genRunFrontV1.id,
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Regenerate front view with adjusted pose",
      visualPrompt: "Full body front view, slightly relaxed pose, white background",
      toolParams: { size: "1024x1536", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [{ artifactId: canonicalArtifactFrontV1.id, role: "previous_candidate", relativePath: "canonical/front-v1.png", sha256: "canon_front_v1_hash" }],
      startedAt: hoursAgo(24),
      finishedAt: hoursAgo(23.5),
      createdAt: hoursAgo(24),
    },
  });
  const genRunBack = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      kind: "canonical",
      canonicalView: "back",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate back view canonical reference",
      visualPrompt: "Full body back view, standing pose, white background",
      toolParams: { size: "1024x1536", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(36),
      finishedAt: hoursAgo(35.5),
      createdAt: hoursAgo(36),
    },
  });
  const genRunLeft = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      kind: "canonical",
      canonicalView: "left",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate left side view canonical reference",
      visualPrompt: "Full body left side view, standing pose, white background",
      toolParams: { size: "1024x1536", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(12),
      finishedAt: hoursAgo(11.5),
      createdAt: hoursAgo(12),
    },
  });
  const genRunRight = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      kind: "canonical",
      canonicalView: "right",
      status: "running",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate right side view canonical reference",
      visualPrompt: "Full body right side view, standing pose, white background",
      toolParams: { size: "1024x1536", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(1),
      createdAt: hoursAgo(1),
    },
  });

  // Canonical versions
  const canonFrontV1 = await prisma.characterLoraCanonicalVersion.create({
    data: {
      jobId: loraJob.id,
      version: 1,
      status: "selected",
      canonicalView: "front",
      sourceRunId: genRunFrontV1.id,
      imageArtifactId: canonicalArtifactFrontV1.id,
      selectedAt: hoursAgo(46),
      notes: "初版正面图，基本合格",
      createdAt: hoursAgo(47),
    },
  });
  await prisma.characterLoraCanonicalVersion.create({
    data: {
      jobId: loraJob.id,
      version: 2,
      status: "candidate",
      canonicalView: "front",
      sourceRunId: genRunFrontV2.id,
      imageArtifactId: canonicalArtifactFrontV2.id,
      notes: "二版正面图，调整了姿态",
      createdAt: hoursAgo(23),
    },
  });
  await prisma.characterLoraCanonicalVersion.create({
    data: {
      jobId: loraJob.id,
      version: 3,
      status: "selected",
      canonicalView: "back",
      sourceRunId: genRunBack.id,
      imageArtifactId: canonicalArtifactBackV1.id,
      selectedAt: hoursAgo(34),
      notes: "背面图 OK",
      createdAt: hoursAgo(35),
    },
  });
  await prisma.characterLoraCanonicalVersion.create({
    data: {
      jobId: loraJob.id,
      version: 4,
      status: "rejected",
      canonicalView: "left",
      sourceRunId: genRunLeft.id,
      imageArtifactId: canonicalArtifactLeftV1.id,
      notes: "左侧服装细节不对，需要重做",
      createdAt: hoursAgo(11),
    },
  });
  await prisma.characterLoraCanonicalVersion.create({
    data: {
      jobId: loraJob.id,
      version: 5,
      status: "candidate",
      canonicalView: "right",
      sourceRunId: genRunRight.id,
      imageArtifactId: canonicalArtifactRightV1.id,
      notes: "右侧生成中",
      createdAt: hoursAgo(0.5),
    },
  });

  // Update job to point to selected canonical
  await prisma.characterLoraTrainingJob.update({
    where: { id: loraJob.id },
    data: { currentCanonicalVersionId: canonFrontV1.id },
  });

  // Worker tasks
  await prisma.characterLoraWorkerTask.create({
    data: {
      jobId: loraJob.id,
      workerType: "image_generation",
      targetType: "generationRun",
      targetId: genRunFrontV1.id,
      status: "done",
      payload: { provider: "openai-codex", canonicalView: "front" },
      attemptCount: 1,
      startedAt: hoursAgo(48),
      finishedAt: hoursAgo(47.5),
      heartbeatAt: hoursAgo(47.5),
      createdAt: hoursAgo(48),
    },
  });
  await prisma.characterLoraWorkerTask.create({
    data: {
      jobId: loraJob.id,
      workerType: "image_generation",
      targetType: "generationRun",
      targetId: genRunFrontV2.id,
      status: "done",
      payload: { provider: "openai-codex", canonicalView: "front" },
      attemptCount: 1,
      startedAt: hoursAgo(24),
      finishedAt: hoursAgo(23.5),
      heartbeatAt: hoursAgo(23.5),
      createdAt: hoursAgo(24),
    },
  });
  await prisma.characterLoraWorkerTask.create({
    data: {
      jobId: loraJob.id,
      workerType: "image_generation",
      targetType: "generationRun",
      targetId: genRunBack.id,
      status: "done",
      payload: { provider: "openai-codex", canonicalView: "back" },
      attemptCount: 1,
      startedAt: hoursAgo(36),
      finishedAt: hoursAgo(35.5),
      heartbeatAt: hoursAgo(35.5),
      createdAt: hoursAgo(36),
    },
  });
  await prisma.characterLoraWorkerTask.create({
    data: {
      jobId: loraJob.id,
      workerType: "image_generation",
      targetType: "generationRun",
      targetId: genRunLeft.id,
      status: "done",
      payload: { provider: "openai-codex", canonicalView: "left" },
      attemptCount: 1,
      startedAt: hoursAgo(12),
      finishedAt: hoursAgo(11.5),
      heartbeatAt: hoursAgo(11.5),
      createdAt: hoursAgo(12),
    },
  });
  await prisma.characterLoraWorkerTask.create({
    data: {
      jobId: loraJob.id,
      workerType: "image_generation",
      targetType: "generationRun",
      targetId: genRunRight.id,
      status: "running",
      payload: { provider: "openai-codex", canonicalView: "right" },
      leaseOwner: "worker-gpu-01",
      leaseExpiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      attemptCount: 1,
      startedAt: hoursAgo(1),
      heartbeatAt: new Date(now.getTime() - 30_000),
      createdAt: hoursAgo(1),
    },
  });

  // ─── Prompt Card Version ──────────────────────────────────────────────────

  const promptCardV1 = await prisma.characterLoraPromptCardVersion.create({
    data: {
      jobId: loraJob.id,
      canonicalVersionId: canonFrontV1.id,
      version: 1,
      triggerToken: "1miku",
      identityTraits: {
        hair: "long twin-tails, cyan/teal color",
        eyes: "large, green-cyan",
        face: "anime-style, youthful",
        body: "slender, petite",
      },
      outfitTraits: {
        top: "grey sleeveless shirt with teal tie",
        bottom: "black pleated mini skirt",
        arms: "detached black sleeves with teal trim",
        legs: "thigh-high black boots",
        accessories: "futuristic headset",
      },
      negativeTraits: ["blurry", "low quality", "extra limbs", "bad anatomy", "watermark", "text"],
      finalPromptDraft: "1miku, full body, standing, anime style, teal twin-tails, grey sleeveless top, teal tie, black pleated skirt, detached sleeves, thigh-high boots, futuristic headset, detailed face, clean lineart",
      createdAt: hoursAgo(20),
    },
  });

  // Update job to point to prompt card
  await prisma.characterLoraTrainingJob.update({
    where: { id: loraJob.id },
    data: { currentPromptCardVersionId: promptCardV1.id },
  });

  // ─── Section Templates ──────────────────────────────────────────────────

  const sectionTemplateStandingFront = await prisma.characterLoraSectionTemplate.upsert({
    where: { key: "standing_front" },
    update: {},
    create: {
      trainingTemplateId: loraTemplate.id,
      key: "standing_front",
      name: "Standing Front",
      description: "正面站立，全身可见",
      angleTag: "front",
      promptTemplate: "1miku, full body front view, standing pose, {{traits}}, white background",
      negativeTemplate: "blurry, low quality, cropped",
      targetCandidateCount: 4,
      targetKeepCount: 2,
      sortOrder: 1,
      isActive: true,
    },
  });

  const sectionTemplateActionPose = await prisma.characterLoraSectionTemplate.upsert({
    where: { key: "action_pose" },
    update: {},
    create: {
      trainingTemplateId: loraTemplate.id,
      key: "action_pose",
      name: "Action Pose",
      description: "动态姿态，展示角色表现力",
      angleTag: "front",
      promptTemplate: "1miku, dynamic action pose, {{traits}}, dramatic lighting",
      negativeTemplate: "blurry, static, stiff",
      targetCandidateCount: 4,
      targetKeepCount: 2,
      sortOrder: 2,
      isActive: true,
    },
  });

  const sectionTemplateSitting = await prisma.characterLoraSectionTemplate.upsert({
    where: { key: "sitting" },
    update: {},
    create: {
      trainingTemplateId: loraTemplate.id,
      key: "sitting",
      name: "Sitting",
      description: "坐姿，展示休闲状态",
      angleTag: "front",
      promptTemplate: "1miku, sitting pose, relaxed, {{traits}}, simple background",
      negativeTemplate: "blurry, low quality",
      targetCandidateCount: 3,
      targetKeepCount: 1,
      sortOrder: 3,
      isActive: true,
    },
  });

  // ─── Job Sections ──────────────────────────────────────────────────────

  const sectionStandingFront = await prisma.characterLoraJobSection.create({
    data: {
      jobId: loraJob.id,
      templateId: sectionTemplateStandingFront.id,
      key: "standing_front",
      name: "Standing Front",
      canonicalVersionId: canonFrontV1.id,
      promptCardVersionId: promptCardV1.id,
      targetCandidateCount: 4,
      targetKeepCount: 2,
      status: "draft",
      keepCount: 2,
      rejectCount: 1,
      pendingCount: 1,
      sortOrder: 1,
    },
  });

  const sectionActionPose = await prisma.characterLoraJobSection.create({
    data: {
      jobId: loraJob.id,
      templateId: sectionTemplateActionPose.id,
      key: "action_pose",
      name: "Action Pose",
      canonicalVersionId: canonFrontV1.id,
      promptCardVersionId: promptCardV1.id,
      targetCandidateCount: 4,
      targetKeepCount: 2,
      status: "draft",
      keepCount: 1,
      rejectCount: 0,
      pendingCount: 2,
      sortOrder: 2,
    },
  });

  const sectionSitting = await prisma.characterLoraJobSection.create({
    data: {
      jobId: loraJob.id,
      templateId: sectionTemplateSitting.id,
      key: "sitting",
      name: "Sitting",
      canonicalVersionId: canonFrontV1.id,
      promptCardVersionId: promptCardV1.id,
      targetCandidateCount: 3,
      targetKeepCount: 1,
      status: "draft",
      keepCount: 0,
      rejectCount: 0,
      pendingCount: 2,
      sortOrder: 3,
    },
  });

  // ─── Section Generation Runs ───────────────────────────────────────────

  const sectionRunStanding = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      sectionId: sectionStandingFront.id,
      kind: "section_candidate",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate standing front training image",
      visualPrompt: "1miku, full body front view, standing, white background",
      toolParams: { size: "768x1024", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(8),
      finishedAt: hoursAgo(7.5),
      createdAt: hoursAgo(8),
    },
  });

  const sectionRunAction = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      sectionId: sectionActionPose.id,
      kind: "section_candidate",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate dynamic action pose training image",
      visualPrompt: "1miku, dynamic action pose, jumping, dramatic lighting",
      toolParams: { size: "768x1024", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(6),
      finishedAt: hoursAgo(5.5),
      createdAt: hoursAgo(6),
    },
  });

  const sectionRunSitting = await prisma.characterLoraGenerationRun.create({
    data: {
      jobId: loraJob.id,
      sectionId: sectionSitting.id,
      kind: "section_candidate",
      status: "done",
      provider: "openai-codex",
      hostModel: "gpt-4.1",
      imageModel: "gpt-image-2",
      hostInstruction: "Generate sitting pose training image",
      visualPrompt: "1miku, sitting on chair, relaxed pose, simple background",
      toolParams: { size: "768x1024", quality: "high", outputFormat: "png", background: "opaque" },
      inputImages: [],
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3.5),
      createdAt: hoursAgo(4),
    },
  });

  // ─── Candidate Image Artifacts ─────────────────────────────────────────

  const candArtifacts = await Promise.all([
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/standing-front/img-01.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/standing-front/img-01.png", sha256: "cand_sf_01", byteSize: BigInt(150000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/standing-front/img-02.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/standing-front/img-02.png", sha256: "cand_sf_02", byteSize: BigInt(148000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/standing-front/img-03.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/standing-front/img-03.png", sha256: "cand_sf_03", byteSize: BigInt(152000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/standing-front/img-04.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/standing-front/img-04.png", sha256: "cand_sf_04", byteSize: BigInt(149000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/action-pose/img-01.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/action-pose/img-01.png", sha256: "cand_ap_01", byteSize: BigInt(160000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/action-pose/img-02.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/action-pose/img-02.png", sha256: "cand_ap_02", byteSize: BigInt(158000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/action-pose/img-03.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/action-pose/img-03.png", sha256: "cand_ap_03", byteSize: BigInt(155000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/sitting/img-01.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/sitting/img-01.png", sha256: "cand_sit_01", byteSize: BigInt(145000), mimeType: "image/png" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "candidates/sitting/img-02.png" } }, update: {}, create: { jobId: loraJob.id, kind: "candidate_image", relativePath: "candidates/sitting/img-02.png", sha256: "cand_sit_02", byteSize: BigInt(143000), mimeType: "image/png" } }),
  ]);

  // ─── Candidate Images ──────────────────────────────────────────────────

  // Standing front: 2 keep, 1 reject, 1 pending
  const candStandF1 = await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionStandingFront.id, generationRunId: sectionRunStanding.id, artifactId: candArtifacts[0].id, filePath: "candidates/standing-front/img-01.png", sha256: "cand_sf_01", width: 768, height: 1024, reviewStatus: "keep", captionDraft: "1miku, standing, front view, teal twin-tails, grey top, black skirt, full body, white background", reviewedAt: hoursAgo(6), createdAt: hoursAgo(7) },
  });
  const candStandF2 = await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionStandingFront.id, generationRunId: sectionRunStanding.id, artifactId: candArtifacts[1].id, filePath: "candidates/standing-front/img-02.png", sha256: "cand_sf_02", width: 768, height: 1024, reviewStatus: "keep", captionDraft: "1miku, standing pose, facing camera, detailed outfit, teal hair, anime style", reviewedAt: hoursAgo(6), createdAt: hoursAgo(7) },
  });
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionStandingFront.id, generationRunId: sectionRunStanding.id, artifactId: candArtifacts[2].id, filePath: "candidates/standing-front/img-03.png", sha256: "cand_sf_03", width: 768, height: 1024, reviewStatus: "reject", rejectReasons: ["bad anatomy", "extra fingers"], reviewedAt: hoursAgo(6), createdAt: hoursAgo(7) },
  });
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionStandingFront.id, generationRunId: sectionRunStanding.id, artifactId: candArtifacts[3].id, filePath: "candidates/standing-front/img-04.png", sha256: "cand_sf_04", width: 768, height: 1024, reviewStatus: "pending", createdAt: hoursAgo(7) },
  });

  // Action pose: 1 keep, 2 pending
  const candAction1 = await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionActionPose.id, generationRunId: sectionRunAction.id, artifactId: candArtifacts[4].id, filePath: "candidates/action-pose/img-01.png", sha256: "cand_ap_01", width: 768, height: 1024, reviewStatus: "keep", captionDraft: "1miku, dynamic jump pose, arms outstretched, dramatic angle, teal hair flowing", reviewedAt: hoursAgo(4), createdAt: hoursAgo(5) },
  });
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionActionPose.id, generationRunId: sectionRunAction.id, artifactId: candArtifacts[5].id, filePath: "candidates/action-pose/img-02.png", sha256: "cand_ap_02", width: 768, height: 1024, reviewStatus: "pending", createdAt: hoursAgo(5) },
  });
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionActionPose.id, generationRunId: sectionRunAction.id, artifactId: candArtifacts[6].id, filePath: "candidates/action-pose/img-03.png", sha256: "cand_ap_03", width: 768, height: 1024, reviewStatus: "pending", createdAt: hoursAgo(5) },
  });

  // Sitting: 2 pending
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionSitting.id, generationRunId: sectionRunSitting.id, artifactId: candArtifacts[7].id, filePath: "candidates/sitting/img-01.png", sha256: "cand_sit_01", width: 768, height: 1024, reviewStatus: "pending", createdAt: hoursAgo(3) },
  });
  await prisma.characterLoraCandidateImage.create({
    data: { jobId: loraJob.id, sectionId: sectionSitting.id, generationRunId: sectionRunSitting.id, artifactId: candArtifacts[8].id, filePath: "candidates/sitting/img-02.png", sha256: "cand_sit_02", width: 768, height: 1024, reviewStatus: "pending", createdAt: hoursAgo(3) },
  });

  // ─── Dataset Revision ──────────────────────────────────────────────────

  // Create artifacts for dataset manifest and metadata
  const manifestArtifact = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "reports/dataset-manifest-v1.json" } },
    update: {},
    create: { jobId: loraJob.id, kind: "dataset_manifest", relativePath: "reports/dataset-manifest-v1.json", sha256: "manifest_v1_hash", byteSize: BigInt(2000), mimeType: "application/json" },
  });
  const metadataArtifact = await prisma.characterLoraArtifact.upsert({
    where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "reports/dataset-metadata-v1.jsonl" } },
    update: {},
    create: { jobId: loraJob.id, kind: "dataset_manifest", relativePath: "reports/dataset-metadata-v1.jsonl", sha256: "metadata_v1_hash", byteSize: BigInt(3500), mimeType: "application/jsonl" },
  });

  const datasetRevision1 = await prisma.characterLoraDatasetRevision.create({
    data: {
      jobId: loraJob.id,
      version: 1,
      status: "frozen",
      canonicalVersionId: canonFrontV1.id,
      promptCardVersionId: promptCardV1.id,
      captionStrategy: "controllable_identity",
      itemCount: 3,
      sourceCount: 0,
      syntheticCount: 3,
      selectedManifestArtifactId: manifestArtifact.id,
      metadataJsonlArtifactId: metadataArtifact.id,
      trainDir: `${artifactRoot}/training/dataset-v1`,
      frozenAt: hoursAgo(2),
      createdAt: hoursAgo(3),
    },
  });

  // Update job to reference dataset
  await prisma.characterLoraTrainingJob.update({
    where: { id: loraJob.id },
    data: { selectedDatasetRevisionId: datasetRevision1.id, status: "section_generating", phase: "sections" },
  });

  // ─── Dataset Items ─────────────────────────────────────────────────────

  // Create caption artifacts
  const captionArtifacts = await Promise.all([
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "captions/standing-front-01.txt" } }, update: {}, create: { jobId: loraJob.id, kind: "caption", relativePath: "captions/standing-front-01.txt", sha256: "cap_sf_01", byteSize: BigInt(200), mimeType: "text/plain" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "captions/standing-front-02.txt" } }, update: {}, create: { jobId: loraJob.id, kind: "caption", relativePath: "captions/standing-front-02.txt", sha256: "cap_sf_02", byteSize: BigInt(180), mimeType: "text/plain" } }),
    prisma.characterLoraArtifact.upsert({ where: { jobId_relativePath: { jobId: loraJob.id, relativePath: "captions/action-pose-01.txt" } }, update: {}, create: { jobId: loraJob.id, kind: "caption", relativePath: "captions/action-pose-01.txt", sha256: "cap_ap_01", byteSize: BigInt(210), mimeType: "text/plain" } }),
  ]);

  await prisma.characterLoraDatasetItem.create({
    data: { datasetRevisionId: datasetRevision1.id, candidateImageId: candStandF1.id, imageArtifactId: candArtifacts[0].id, captionArtifactId: captionArtifacts[0].id, captionText: "1miku, standing, front view, teal twin-tails, grey top, black skirt, full body, white background", repeatCount: 1, sortOrder: 1 },
  });
  await prisma.characterLoraDatasetItem.create({
    data: { datasetRevisionId: datasetRevision1.id, candidateImageId: candStandF2.id, imageArtifactId: candArtifacts[1].id, captionArtifactId: captionArtifacts[1].id, captionText: "1miku, standing pose, facing camera, detailed outfit, teal hair, anime style", repeatCount: 1, sortOrder: 2 },
  });
  await prisma.characterLoraDatasetItem.create({
    data: { datasetRevisionId: datasetRevision1.id, candidateImageId: candAction1.id, imageArtifactId: candArtifacts[4].id, captionArtifactId: captionArtifacts[2].id, captionText: "1miku, dynamic jump pose, arms outstretched, dramatic angle, teal hair flowing", repeatCount: 1, sortOrder: 3 },
  });

  // Mark kept images as included_in_training
  await prisma.characterLoraCandidateImage.updateMany({
    where: { id: { in: [candStandF1.id, candStandF2.id, candAction1.id] }, jobId: loraJob.id },
    data: { reviewStatus: "included_in_training", includedDatasetRevisionId: datasetRevision1.id },
  });

  // Update section keepCounts to reflect included_in_training
  await prisma.characterLoraJobSection.update({
    where: { id: sectionStandingFront.id },
    data: { keepCount: 2 },
  });
  await prisma.characterLoraJobSection.update({
    where: { id: sectionActionPose.id },
    data: { keepCount: 1 },
  });

  console.log(`Seeded Character LoRA training data: job "${loraJob.slug}" with 5 canonical versions, 3 source images, 3 sections, 9 candidates, 1 dataset revision.`);

  console.log("Seeded local bootstrap data for ComfyUI Remote backend.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

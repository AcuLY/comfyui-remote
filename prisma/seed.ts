import { PrismaClient } from "../src/generated/prisma/client.ts";

const prisma = new PrismaClient();

const now = new Date();
const hoursAgo = (hours) => new Date(now.getTime() - hours * 60 * 60 * 1000);

async function main() {
  const [miku, tangtang] = await Promise.all([
    prisma.character.upsert({
      where: { slug: "nakano-miku" },
      update: {
        name: "Nakano Miku",
        prompt: "nakano miku, quintuplets anime style, soft expression",
        loraPath: "characters/miku-v3.safetensors",
        notes: "Seed character for local review flow.",
        isActive: true,
      },
      create: {
        name: "Nakano Miku",
        slug: "nakano-miku",
        prompt: "nakano miku, quintuplets anime style, soft expression",
        loraPath: "characters/miku-v3.safetensors",
        notes: "Seed character for local review flow.",
      },
    }),
    prisma.character.upsert({
      where: { slug: "tangtang" },
      update: {
        name: "Tangtang",
        prompt: "anime girl, brown hair, relaxed mood",
        loraPath: "characters/tangtang-v1.safetensors",
        notes: "Secondary seed character for local job list coverage.",
        isActive: true,
      },
      create: {
        name: "Tangtang",
        slug: "tangtang",
        prompt: "anime girl, brown hair, relaxed mood",
        loraPath: "characters/tangtang-v1.safetensors",
        notes: "Secondary seed character for local job list coverage.",
      },
    }),
  ]);

  const [parkBench, riverside, softDaylight, animeCinematic] = await Promise.all([
    prisma.scenePreset.upsert({
      where: { slug: "park-bench" },
      update: { name: "Park bench", prompt: "park bench, spring trees, city park" },
      create: { name: "Park bench", slug: "park-bench", prompt: "park bench, spring trees, city park" },
    }),
    prisma.scenePreset.upsert({
      where: { slug: "riverside" },
      update: { name: "Riverside", prompt: "riverside walkway, evening breeze" },
      create: { name: "Riverside", slug: "riverside", prompt: "riverside walkway, evening breeze" },
    }),
    prisma.stylePreset.upsert({
      where: { slug: "soft-daylight" },
      update: { name: "Soft daylight", prompt: "soft daylight, clean anime shading" },
      create: { name: "Soft daylight", slug: "soft-daylight", prompt: "soft daylight, clean anime shading" },
    }),
    prisma.stylePreset.upsert({
      where: { slug: "anime-cinematic" },
      update: { name: "Anime cinematic", prompt: "anime cinematic lighting, polished color grading" },
      create: { name: "Anime cinematic", slug: "anime-cinematic", prompt: "anime cinematic lighting, polished color grading" },
    }),
  ]);

  const [standingTemplate, watchingTemplate, benchSitTemplate] = await Promise.all([
    prisma.positionTemplate.upsert({
      where: { slug: "standing" },
      update: { name: "Standing", prompt: "standing pose", defaultAspectRatio: "3:4", defaultBatchSize: 9 },
      create: {
        name: "Standing",
        slug: "standing",
        prompt: "standing pose",
        negativePrompt: "low quality, bad anatomy",
        defaultAspectRatio: "3:4",
        defaultBatchSize: 9,
        defaultSeedPolicy: "random",
      },
    }),
    prisma.positionTemplate.upsert({
      where: { slug: "watching" },
      update: { name: "Watching", prompt: "looking at camera, upper body focus", defaultAspectRatio: "3:4", defaultBatchSize: 9 },
      create: {
        name: "Watching",
        slug: "watching",
        prompt: "looking at camera, upper body focus",
        negativePrompt: "low quality, bad anatomy",
        defaultAspectRatio: "3:4",
        defaultBatchSize: 9,
        defaultSeedPolicy: "random",
      },
    }),
    prisma.positionTemplate.upsert({
      where: { slug: "bench-sit" },
      update: { name: "Bench sit", prompt: "sitting on bench, relaxed posture", defaultAspectRatio: "3:4", defaultBatchSize: 9 },
      create: {
        name: "Bench sit",
        slug: "bench-sit",
        prompt: "sitting on bench, relaxed posture",
        negativePrompt: "low quality, bad anatomy",
        defaultAspectRatio: "3:4",
        defaultBatchSize: 9,
        defaultSeedPolicy: "random",
      },
    }),
  ]);

  const mikuJob = await prisma.completeJob.upsert({
    where: { slug: "miku-spring-batch-a" },
    update: {
      title: "Miku spring batch A",
      status: "running",
      characterId: miku.id,
      scenePresetId: parkBench.id,
      stylePresetId: softDaylight.id,
      characterPrompt: miku.prompt,
      characterLoraPath: miku.loraPath,
      scenePrompt: parkBench.prompt,
      stylePrompt: softDaylight.prompt,
      notes: "Seed job used by local queue, job list, and review screens.",
    },
    create: {
      title: "Miku spring batch A",
      slug: "miku-spring-batch-a",
      status: "running",
      characterId: miku.id,
      scenePresetId: parkBench.id,
      stylePresetId: softDaylight.id,
      characterPrompt: miku.prompt,
      characterLoraPath: miku.loraPath,
      scenePrompt: parkBench.prompt,
      stylePrompt: softDaylight.prompt,
      notes: "Seed job used by local queue, job list, and review screens.",
    },
  });

  const tangtangJob = await prisma.completeJob.upsert({
    where: { slug: "tangtang-park-test" },
    update: {
      title: "Tangtang park test",
      status: "draft",
      characterId: tangtang.id,
      scenePresetId: riverside.id,
      stylePresetId: animeCinematic.id,
      characterPrompt: tangtang.prompt,
      characterLoraPath: tangtang.loraPath,
      scenePrompt: riverside.prompt,
      stylePrompt: animeCinematic.prompt,
      notes: "Secondary seed job for list and detail coverage.",
    },
    create: {
      title: "Tangtang park test",
      slug: "tangtang-park-test",
      status: "draft",
      characterId: tangtang.id,
      scenePresetId: riverside.id,
      stylePresetId: animeCinematic.id,
      characterPrompt: tangtang.prompt,
      characterLoraPath: tangtang.loraPath,
      scenePrompt: riverside.prompt,
      stylePrompt: animeCinematic.prompt,
      notes: "Secondary seed job for list and detail coverage.",
    },
  });

  const mikuStanding = await prisma.completeJobPosition.upsert({
    where: {
      completeJobId_positionTemplateId: {
        completeJobId: mikuJob.id,
        positionTemplateId: standingTemplate.id,
      },
    },
    update: { sortOrder: 1, enabled: true, batchSize: 9, aspectRatio: "3:4", seedPolicy: "random" },
    create: {
      completeJobId: mikuJob.id,
      positionTemplateId: standingTemplate.id,
      sortOrder: 1,
      enabled: true,
      batchSize: 9,
      aspectRatio: "3:4",
      seedPolicy: "random",
    },
  });

  const mikuWatching = await prisma.completeJobPosition.upsert({
    where: {
      completeJobId_positionTemplateId: {
        completeJobId: mikuJob.id,
        positionTemplateId: watchingTemplate.id,
      },
    },
    update: { sortOrder: 2, enabled: true, batchSize: 9, aspectRatio: "3:4", seedPolicy: "random" },
    create: {
      completeJobId: mikuJob.id,
      positionTemplateId: watchingTemplate.id,
      sortOrder: 2,
      enabled: true,
      batchSize: 9,
      aspectRatio: "3:4",
      seedPolicy: "random",
    },
  });

  const tangtangBench = await prisma.completeJobPosition.upsert({
    where: {
      completeJobId_positionTemplateId: {
        completeJobId: tangtangJob.id,
        positionTemplateId: benchSitTemplate.id,
      },
    },
    update: { sortOrder: 1, enabled: true, batchSize: 9, aspectRatio: "3:4", seedPolicy: "random" },
    create: {
      completeJobId: tangtangJob.id,
      positionTemplateId: benchSitTemplate.id,
      sortOrder: 1,
      enabled: true,
      batchSize: 9,
      aspectRatio: "3:4",
      seedPolicy: "random",
    },
  });

  const standingRun = await prisma.positionRun.upsert({
    where: { id: "seed-run-miku-standing" },
    update: {
      completeJobId: mikuJob.id,
      completeJobPositionId: mikuStanding.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {
        character: miku.name,
        scene: parkBench.name,
        style: softDaylight.name,
        position: standingTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/miku-spring-batch-a/standing/run-01/raw",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.75),
    },
    create: {
      id: "seed-run-miku-standing",
      completeJobId: mikuJob.id,
      completeJobPositionId: mikuStanding.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {
        character: miku.name,
        scene: parkBench.name,
        style: softDaylight.name,
        position: standingTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/miku-spring-batch-a/standing/run-01/raw",
      startedAt: hoursAgo(3),
      finishedAt: hoursAgo(2.75),
    },
  });

  const watchingRun = await prisma.positionRun.upsert({
    where: { id: "seed-run-miku-watching" },
    update: {
      completeJobId: mikuJob.id,
      completeJobPositionId: mikuWatching.id,
      runIndex: 2,
      status: "done",
      resolvedConfigSnapshot: {
        character: miku.name,
        scene: parkBench.name,
        style: softDaylight.name,
        position: watchingTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/miku-spring-batch-a/watching/run-02/raw",
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3.5),
    },
    create: {
      id: "seed-run-miku-watching",
      completeJobId: mikuJob.id,
      completeJobPositionId: mikuWatching.id,
      runIndex: 2,
      status: "done",
      resolvedConfigSnapshot: {
        character: miku.name,
        scene: parkBench.name,
        style: softDaylight.name,
        position: watchingTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/miku-spring-batch-a/watching/run-02/raw",
      startedAt: hoursAgo(4),
      finishedAt: hoursAgo(3.5),
    },
  });

  const benchRun = await prisma.positionRun.upsert({
    where: { id: "seed-run-tangtang-bench" },
    update: {
      completeJobId: tangtangJob.id,
      completeJobPositionId: tangtangBench.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {
        character: tangtang.name,
        scene: riverside.name,
        style: animeCinematic.name,
        position: benchSitTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/tangtang-park-test/bench-sit/run-01/raw",
      startedAt: hoursAgo(5),
      finishedAt: hoursAgo(4.5),
    },
    create: {
      id: "seed-run-tangtang-bench",
      completeJobId: tangtangJob.id,
      completeJobPositionId: tangtangBench.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {
        character: tangtang.name,
        scene: riverside.name,
        style: animeCinematic.name,
        position: benchSitTemplate.name,
        batchSize: 9,
      },
      outputDir: "data/images/tangtang-park-test/bench-sit/run-01/raw",
      startedAt: hoursAgo(5),
      finishedAt: hoursAgo(4.5),
    },
  });

  await prisma.completeJobPosition.update({ where: { id: mikuStanding.id }, data: { latestRunId: standingRun.id } });
  await prisma.completeJobPosition.update({ where: { id: mikuWatching.id }, data: { latestRunId: watchingRun.id } });
  await prisma.completeJobPosition.update({ where: { id: tangtangBench.id }, data: { latestRunId: benchRun.id } });

  const seedImages = [
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `seed-image-miku-standing-${index + 1}`,
      positionRunId: standingRun.id,
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
      positionRunId: watchingRun.id,
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
      positionRunId: benchRun.id,
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

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
  const standingRun = await prisma.positionRun.upsert({
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

  const watchingRun = await prisma.positionRun.upsert({
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

  const benchRun = await prisma.positionRun.upsert({
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

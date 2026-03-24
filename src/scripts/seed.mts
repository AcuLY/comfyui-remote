import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";

function detectProvider(): "postgresql" | "sqlite" {
  const explicit = process.env.DB_PROVIDER?.toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) return "sqlite";
  return "postgresql";
}

async function createAdapter() {
  if (detectProvider() === "sqlite") {
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    return new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
}

const adapter = await createAdapter();
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // --- Characters ---
  const miku = await prisma.character.upsert({
    where: { slug: "nakano-miku" },
    update: {},
    create: {
      name: "Nakano Miku",
      slug: "nakano-miku",
      prompt: "miku, long hair, calm expression, school uniform, headphones around neck",
      loraPath: "characters/miku-v3.safetensors",
      notes: "五等分花嫁 - 三玖",
    },
  });

  const tangtang = await prisma.character.upsert({
    where: { slug: "tangtang" },
    update: {},
    create: {
      name: "Tangtang",
      slug: "tangtang",
      prompt: "tangtang, short hair, bright eyes, casual clothing, cheerful",
      loraPath: "characters/tangtang-v2.safetensors",
      notes: "原创角色",
    },
  });

  // --- Scene Presets ---
  const parkBench = await prisma.scenePreset.upsert({
    where: { slug: "park-bench" },
    update: {},
    create: {
      name: "Park bench",
      slug: "park-bench",
      prompt: "park bench, spring afternoon, cherry blossoms, outdoor, natural sunlight",
    },
  });

  const riverside = await prisma.scenePreset.upsert({
    where: { slug: "riverside" },
    update: {},
    create: {
      name: "Riverside",
      slug: "riverside",
      prompt: "riverside, calm water, willow tree, warm sunset, serene atmosphere",
    },
  });

  // --- Style Presets ---
  const softDaylight = await prisma.stylePreset.upsert({
    where: { slug: "soft-daylight" },
    update: {},
    create: {
      name: "Soft daylight",
      slug: "soft-daylight",
      prompt: "soft daylight, anime cinematic, detailed shading, warm color palette, depth of field",
    },
  });

  const animeCinematic = await prisma.stylePreset.upsert({
    where: { slug: "anime-cinematic" },
    update: {},
    create: {
      name: "Anime cinematic",
      slug: "anime-cinematic",
      prompt: "anime cinematic, dramatic lighting, vivid colors, film grain, high contrast",
    },
  });

  // --- Position Templates ---
  const standing = await prisma.positionTemplate.upsert({
    where: { slug: "standing" },
    update: {},
    create: {
      name: "Standing",
      slug: "standing",
      prompt: "standing pose, full body, looking at viewer, arms at sides",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      defaultAspectRatio: "3:4",
      defaultBatchSize: 8,
      defaultSeedPolicy: "random",
    },
  });

  const watching = await prisma.positionTemplate.upsert({
    where: { slug: "watching" },
    update: {},
    create: {
      name: "Watching",
      slug: "watching",
      prompt: "watching pose, upper body, looking away, thoughtful expression",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      defaultAspectRatio: "3:4",
      defaultBatchSize: 8,
      defaultSeedPolicy: "random",
    },
  });

  const benchSit = await prisma.positionTemplate.upsert({
    where: { slug: "bench-sit" },
    update: {},
    create: {
      name: "Bench sit",
      slug: "bench-sit",
      prompt: "sitting on bench, relaxed pose, legs crossed, upper body",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      defaultAspectRatio: "3:4",
      defaultBatchSize: 6,
      defaultSeedPolicy: "random",
    },
  });

  // --- CompleteJob: Miku spring batch A ---
  const jobMiku = await prisma.completeJob.upsert({
    where: { slug: "miku-spring-batch-a" },
    update: {},
    create: {
      title: "Miku spring batch A",
      slug: "miku-spring-batch-a",
      status: "done",
      characterId: miku.id,
      scenePresetId: parkBench.id,
      stylePresetId: softDaylight.id,
      characterPrompt: miku.prompt,
      characterLoraPath: miku.loraPath,
      scenePrompt: parkBench.prompt,
      stylePrompt: softDaylight.prompt,
    },
  });

  const mikuStanding = await prisma.completeJobPosition.upsert({
    where: { completeJobId_positionTemplateId: { completeJobId: jobMiku.id, positionTemplateId: standing.id } },
    update: {},
    create: {
      completeJobId: jobMiku.id,
      positionTemplateId: standing.id,
      sortOrder: 0,
      batchSize: 8,
      aspectRatio: "3:4",
    },
  });

  const mikuWatching = await prisma.completeJobPosition.upsert({
    where: { completeJobId_positionTemplateId: { completeJobId: jobMiku.id, positionTemplateId: watching.id } },
    update: {},
    create: {
      completeJobId: jobMiku.id,
      positionTemplateId: watching.id,
      sortOrder: 1,
      batchSize: 8,
      aspectRatio: "3:4",
    },
  });

  // --- CompleteJob: Tangtang park test ---
  const jobTangtang = await prisma.completeJob.upsert({
    where: { slug: "tangtang-park-test" },
    update: {},
    create: {
      title: "Tangtang park test",
      slug: "tangtang-park-test",
      status: "done",
      characterId: tangtang.id,
      scenePresetId: riverside.id,
      stylePresetId: animeCinematic.id,
      characterPrompt: tangtang.prompt,
      characterLoraPath: tangtang.loraPath,
      scenePrompt: riverside.prompt,
      stylePrompt: animeCinematic.prompt,
    },
  });

  const tangtangBench = await prisma.completeJobPosition.upsert({
    where: { completeJobId_positionTemplateId: { completeJobId: jobTangtang.id, positionTemplateId: benchSit.id } },
    update: {},
    create: {
      completeJobId: jobTangtang.id,
      positionTemplateId: benchSit.id,
      sortOrder: 0,
      batchSize: 6,
      aspectRatio: "3:4",
    },
  });

  // --- PositionRuns + ImageResults ---
  const runMikuStanding = await prisma.positionRun.create({
    data: {
      completeJobId: jobMiku.id,
      completeJobPositionId: mikuStanding.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {},
      startedAt: new Date("2026-03-23T22:00:00Z"),
      finishedAt: new Date("2026-03-23T22:08:00Z"),
      images: {
        create: Array.from({ length: 9 }, (_, i) => ({
          filePath: `https://picsum.photos/seed/miku-standing-${i + 1}/900/1200`,
          thumbPath: `https://picsum.photos/seed/miku-standing-${i + 1}/300/400`,
          width: 900,
          height: 1200,
          reviewStatus: i < 2 ? "kept" as const : "pending" as const,
        })),
      },
    },
  });

  await prisma.positionRun.create({
    data: {
      completeJobId: jobMiku.id,
      completeJobPositionId: mikuWatching.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {},
      startedAt: new Date("2026-03-23T21:50:00Z"),
      finishedAt: new Date("2026-03-23T21:56:00Z"),
      images: {
        create: Array.from({ length: 9 }, (_, i) => ({
          filePath: `https://picsum.photos/seed/miku-watching-${i + 1}/900/1200`,
          thumbPath: `https://picsum.photos/seed/miku-watching-${i + 1}/300/400`,
          width: 900,
          height: 1200,
          reviewStatus: i < 4 ? "pending" as const : "kept" as const,
        })),
      },
    },
  });

  const runTangtangBench = await prisma.positionRun.create({
    data: {
      completeJobId: jobTangtang.id,
      completeJobPositionId: tangtangBench.id,
      runIndex: 1,
      status: "done",
      resolvedConfigSnapshot: {},
      startedAt: new Date("2026-03-23T21:15:00Z"),
      finishedAt: new Date("2026-03-23T21:22:00Z"),
      images: {
        create: Array.from({ length: 9 }, (_, i) => ({
          filePath: `https://picsum.photos/seed/tangtang-bench-${i + 1}/900/1200`,
          thumbPath: `https://picsum.photos/seed/tangtang-bench-${i + 1}/300/400`,
          width: 900,
          height: 1200,
          reviewStatus: "pending" as const,
        })),
      },
    },
  });

  // --- LoRA Assets ---
  await prisma.loraAsset.upsert({
    where: { absolutePath: "/models/loras/characters/miku-v3.safetensors" },
    update: {},
    create: {
      name: "miku-v3.safetensors",
      category: "characters",
      fileName: "miku-v3.safetensors",
      absolutePath: "/models/loras/characters/miku-v3.safetensors",
      relativePath: "characters/miku-v3.safetensors",
      size: 143820000,
    },
  });

  await prisma.loraAsset.upsert({
    where: { absolutePath: "/models/loras/styles/soft-cinema.safetensors" },
    update: {},
    create: {
      name: "soft-cinema.safetensors",
      category: "styles",
      fileName: "soft-cinema.safetensors",
      absolutePath: "/models/loras/styles/soft-cinema.safetensors",
      relativePath: "styles/soft-cinema.safetensors",
      size: 98500000,
    },
  });

  // --- Trash Records ---
  const mikuStandingImages = await prisma.imageResult.findMany({
    where: { positionRunId: runMikuStanding.id },
    orderBy: { createdAt: "asc" },
  });

  if (mikuStandingImages[3]) {
    await prisma.imageResult.update({
      where: { id: mikuStandingImages[3].id },
      data: { reviewStatus: "trashed" },
    });
    await prisma.trashRecord.create({
      data: {
        imageResultId: mikuStandingImages[3].id,
        originalPath: mikuStandingImages[3].filePath,
        trashPath: `data/images/.trash/${mikuStandingImages[3].id}.png`,
        reason: "User review: not good enough",
        actorType: "user",
      },
    });
  }

  const tangtangBenchImages = await prisma.imageResult.findMany({
    where: { positionRunId: runTangtangBench.id },
    orderBy: { createdAt: "asc" },
  });

  if (tangtangBenchImages[6]) {
    await prisma.imageResult.update({
      where: { id: tangtangBenchImages[6].id },
      data: { reviewStatus: "trashed" },
    });
    await prisma.trashRecord.create({
      data: {
        imageResultId: tangtangBenchImages[6].id,
        originalPath: tangtangBenchImages[6].filePath,
        trashPath: `data/images/.trash/${tangtangBenchImages[6].id}.png`,
        reason: "User review: duplicate pose",
        actorType: "user",
      },
    });
  }

  console.log("✅ Seed complete!");
  console.log(`   Characters: ${miku.name}, ${tangtang.name}`);
  console.log(`   Scene Presets: ${parkBench.name}, ${riverside.name}`);
  console.log(`   Style Presets: ${softDaylight.name}, ${animeCinematic.name}`);
  console.log(`   Position Templates: ${standing.name}, ${watching.name}, ${benchSit.name}`);
  console.log(`   Jobs: ${jobMiku.title}, ${jobTangtang.title}`);
  console.log(`   Runs: 3 (with 27 images total)`);
  console.log(`   Trash records: 2`);
  console.log(`   LoRA assets: 2`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

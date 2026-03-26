import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function detectProvider(): "postgresql" | "sqlite" {
  const explicit = process.env.DB_PROVIDER?.toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) return "sqlite";
  return "postgresql";
}

// Dynamically import the correct PrismaClient based on DB_PROVIDER.
// We cast through `any` because the two generated PrismaClient constructors
// have identical shapes at runtime but differ nominally in their TS types,
// making the union non-constructable.
const clientModule = detectProvider() === "sqlite"
  ? await import("../generated/prisma-sqlite/client.js")
  : await import("../generated/prisma/client.js");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PrismaClient = clientModule.PrismaClient as any;

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

/** Minimal 1×1 PNG (67 bytes) used as placeholder for seed images. */
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

/** Minimal 1×1 JPEG (107 bytes) used as placeholder for seed thumbnails. */
const PLACEHOLDER_JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAFBABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==",
  "base64",
);

/**
 * Ensure a placeholder file exists on disk so that
 * image-file-service file operations (trash / restore) work correctly.
 */
async function ensurePlaceholderFile(relativePath: string, content: Buffer) {
  const absolutePath = resolve(process.cwd(), relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

/** Build image entries for a position run and write placeholder files to disk. */
async function buildSeedImages(
  jobSlug: string,
  positionSlug: string,
  runIndex: number,
  count: number,
  reviewStatusFn: (i: number) => "kept" | "pending" | "trashed",
) {
  const runSegment = `run-${String(runIndex).padStart(2, "0")}`;
  const entries: Array<{
    filePath: string;
    thumbPath: string;
    width: number;
    height: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const fileName = `${String(i + 1).padStart(2, "0")}.png`;
    const thumbName = `${String(i + 1).padStart(2, "0")}.jpg`;
    const filePath = `data/images/${jobSlug}/${positionSlug}/${runSegment}/raw/${fileName}`;
    const thumbPath = `data/images/${jobSlug}/${positionSlug}/${runSegment}/thumb/${thumbName}`;

    await ensurePlaceholderFile(filePath, PLACEHOLDER_PNG);
    await ensurePlaceholderFile(thumbPath, PLACEHOLDER_JPG);

    entries.push({
      filePath,
      thumbPath,
      width: 900,
      height: 1200,
      reviewStatus: reviewStatusFn(i),
    } as any);
  }

  return entries;
}

/** Generate initial PromptBlocks for a position (mirrors createJob logic). */
async function generatePromptBlocks(
  positionId: string,
  character: { id: string; name: string; prompt: string; negativePrompt?: string | null },
  scenePreset: { id: string; name: string; prompt: string; negativePrompt?: string | null } | null,
  stylePreset: { id: string; name: string; prompt: string; negativePrompt?: string | null } | null,
  positionTemplate: { id: string; name: string; prompt: string; negativePrompt?: string | null } | null,
) {
  let sortOrder = 0;

  await prisma.promptBlock.create({
    data: {
      completeJobPositionId: positionId,
      type: "character",
      sourceId: character.id,
      label: character.name,
      positive: character.prompt,
      negative: character.negativePrompt ?? null,
      sortOrder: sortOrder++,
    },
  });

  if (scenePreset) {
    await prisma.promptBlock.create({
      data: {
        completeJobPositionId: positionId,
        type: "scene",
        sourceId: scenePreset.id,
        label: scenePreset.name,
        positive: scenePreset.prompt,
        negative: scenePreset.negativePrompt ?? null,
        sortOrder: sortOrder++,
      },
    });
  }

  if (stylePreset) {
    await prisma.promptBlock.create({
      data: {
        completeJobPositionId: positionId,
        type: "style",
        sourceId: stylePreset.id,
        label: stylePreset.name,
        positive: stylePreset.prompt,
        negative: stylePreset.negativePrompt ?? null,
        sortOrder: sortOrder++,
      },
    });
  }

  if (positionTemplate) {
    await prisma.promptBlock.create({
      data: {
        completeJobPositionId: positionId,
        type: "position",
        sourceId: positionTemplate.id,
        label: positionTemplate.name,
        positive: positionTemplate.prompt,
        negative: positionTemplate.negativePrompt ?? null,
        sortOrder: sortOrder++,
      },
    });
  }
}

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up previous seed data to avoid unique constraint conflicts.
  // Order matters: trash records → image results → position runs → prompt blocks.
  await prisma.trashRecord.deleteMany({});
  await prisma.imageResult.deleteMany({});
  await prisma.positionRun.deleteMany({});
  await prisma.promptBlock.deleteMany({});
  console.log("   Cleaned old run / image / trash / prompt-block data.");

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
      defaultSeedPolicy1: "random",
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
      defaultSeedPolicy1: "random",
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
      defaultSeedPolicy1: "random",
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

  let mikuStanding = await prisma.completeJobPosition.findFirst({
    where: { completeJobId: jobMiku.id, positionTemplateId: standing.id },
  });
  if (!mikuStanding) {
    mikuStanding = await prisma.completeJobPosition.create({
      data: {
        completeJobId: jobMiku.id,
        positionTemplateId: standing.id,
        sortOrder: 0,
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(mikuStanding.id, miku, parkBench, softDaylight, standing);

  let mikuWatching = await prisma.completeJobPosition.findFirst({
    where: { completeJobId: jobMiku.id, positionTemplateId: watching.id },
  });
  if (!mikuWatching) {
    mikuWatching = await prisma.completeJobPosition.create({
      data: {
        completeJobId: jobMiku.id,
        positionTemplateId: watching.id,
        sortOrder: 1,
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(mikuWatching.id, miku, parkBench, softDaylight, watching);

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

  let tangtangBench = await prisma.completeJobPosition.findFirst({
    where: { completeJobId: jobTangtang.id, positionTemplateId: benchSit.id },
  });
  if (!tangtangBench) {
    tangtangBench = await prisma.completeJobPosition.create({
      data: {
        completeJobId: jobTangtang.id,
        positionTemplateId: benchSit.id,
        sortOrder: 0,
        batchSize: 6,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(tangtangBench.id, tangtang, riverside, animeCinematic, benchSit);

  // --- PositionRuns + ImageResults ---
  const mikuStandingImages = await buildSeedImages(
    "miku-spring-batch-a", "standing", 1, 9,
    (i) => i < 2 ? "kept" : "pending",
  );

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
        create: mikuStandingImages,
      },
    },
  });

  const mikuWatchingImages = await buildSeedImages(
    "miku-spring-batch-a", "watching", 1, 9,
    (i) => i < 4 ? "pending" : "kept",
  );

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
        create: mikuWatchingImages,
      },
    },
  });

  const tangtangBenchImages = await buildSeedImages(
    "tangtang-park-test", "bench-sit", 1, 9,
    () => "pending",
  );

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
        create: tangtangBenchImages,
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
  const mikuStandingDbImages = await prisma.imageResult.findMany({
    where: { positionRunId: runMikuStanding.id },
    orderBy: { createdAt: "asc" },
  });

  if (mikuStandingDbImages[3]) {
    const trashTarget = mikuStandingDbImages[3];
    const trashPath = `data/images/.trash/${trashTarget.id}/${trashTarget.filePath.split("/").pop()}`;
    await ensurePlaceholderFile(trashPath, PLACEHOLDER_PNG);
    await prisma.imageResult.update({
      where: { id: trashTarget.id },
      data: { reviewStatus: "trashed" },
    });
    await prisma.trashRecord.create({
      data: {
        imageResultId: trashTarget.id,
        originalPath: trashTarget.filePath,
        trashPath,
        reason: "User review: not good enough",
        actorType: "user",
      },
    });
  }

  const tangtangBenchDbImages = await prisma.imageResult.findMany({
    where: { positionRunId: runTangtangBench.id },
    orderBy: { createdAt: "asc" },
  });

  if (tangtangBenchDbImages[6]) {
    const trashTarget = tangtangBenchDbImages[6];
    const trashPath = `data/images/.trash/${trashTarget.id}/${trashTarget.filePath.split("/").pop()}`;
    await ensurePlaceholderFile(trashPath, PLACEHOLDER_PNG);
    await prisma.imageResult.update({
      where: { id: trashTarget.id },
      data: { reviewStatus: "trashed" },
    });
    await prisma.trashRecord.create({
      data: {
        imageResultId: trashTarget.id,
        originalPath: trashTarget.filePath,
        trashPath,
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
  console.log(`   Positions: ${mikuStanding.id.split("-")[0]}..${mikuWatching.id.split("-")[0]}, ${tangtangBench.id.split("-")[0]}..`);
  console.log(`   Runs: 3 (with 27 images total)`);
  console.log(`   Trash records: 2`);
  console.log(`   LoRA assets: 2`);
  console.log(`   PromptBlocks: 4 per position (12 total)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

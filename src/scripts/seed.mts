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

/** Generate initial PromptBlocks for a section using preset/custom types. */
async function generatePromptBlocks(
  sectionId: string,
  blocks: Array<{
    type: "preset" | "custom";
    label: string;
    prompt: string;
    negativePrompt?: string | null;
    sourceId?: string;
  }>,
) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    await prisma.promptBlock.create({
      data: {
        projectSectionId: sectionId,
        type: block.type,
        sourceId: block.sourceId ?? null,
        label: block.label,
        positive: block.prompt,
        negative: block.negativePrompt ?? null,
        sortOrder: i,
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

  // --- PromptCategories & PromptPresets ---
  const catCharacter = await prisma.promptCategory.upsert({
    where: { slug: "character" },
    update: {},
    create: {
      name: "角色",
      slug: "character",
      color: "sky",
      icon: "User",
      sortOrder: 0,
    },
  });

  const catScene = await prisma.promptCategory.upsert({
    where: { slug: "scene" },
    update: {},
    create: {
      name: "场景",
      slug: "scene",
      color: "emerald",
      icon: "MapPin",
      sortOrder: 1,
    },
  });

  const catStyle = await prisma.promptCategory.upsert({
    where: { slug: "style" },
    update: {},
    create: {
      name: "风格",
      slug: "style",
      color: "violet",
      icon: "Palette",
      sortOrder: 2,
    },
  });

  const catPose = await prisma.promptCategory.upsert({
    where: { slug: "pose" },
    update: {},
    create: {
      name: "姿势",
      slug: "pose",
      color: "amber",
      icon: "LayoutGrid",
      sortOrder: 3,
    },
  });

  const presetMiku = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-miku" },
    update: {},
    create: {
      id: "seed-preset-miku",
      categoryId: catCharacter.id,
      name: "Nakano Miku",
      prompt: "miku, long hair, calm expression, school uniform, headphones around neck",
      negativePrompt: null,
      sortOrder: 0,
    },
  });

  const presetTangtang = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-tangtang" },
    update: {},
    create: {
      id: "seed-preset-tangtang",
      categoryId: catCharacter.id,
      name: "Tangtang",
      prompt: "tangtang, short hair, bright eyes, casual clothing, cheerful",
      negativePrompt: null,
      sortOrder: 1,
    },
  });

  const presetParkBench = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-park-bench" },
    update: {},
    create: {
      id: "seed-preset-park-bench",
      categoryId: catScene.id,
      name: "Park bench",
      prompt: "park bench, spring afternoon, cherry blossoms, outdoor, natural sunlight",
      negativePrompt: null,
      sortOrder: 0,
    },
  });

  const presetRiverside = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-riverside" },
    update: {},
    create: {
      id: "seed-preset-riverside",
      categoryId: catScene.id,
      name: "Riverside",
      prompt: "riverside, calm water, willow tree, warm sunset, serene atmosphere",
      negativePrompt: null,
      sortOrder: 1,
    },
  });

  const presetSoftDaylight = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-soft-daylight" },
    update: {},
    create: {
      id: "seed-preset-soft-daylight",
      categoryId: catStyle.id,
      name: "Soft daylight",
      prompt: "soft daylight, anime cinematic, detailed shading, warm color palette, depth of field",
      negativePrompt: null,
      sortOrder: 0,
    },
  });

  const presetAnimeCinematic = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-anime-cinematic" },
    update: {},
    create: {
      id: "seed-preset-anime-cinematic",
      categoryId: catStyle.id,
      name: "Anime cinematic",
      prompt: "anime cinematic, dramatic lighting, vivid colors, film grain, high contrast",
      negativePrompt: null,
      sortOrder: 1,
    },
  });

  const presetStanding = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-standing" },
    update: {},
    create: {
      id: "seed-preset-standing",
      categoryId: catPose.id,
      name: "Standing",
      prompt: "standing pose, full body, looking at viewer, arms at sides",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      sortOrder: 0,
    },
  });

  const presetWatching = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-watching" },
    update: {},
    create: {
      id: "seed-preset-watching",
      categoryId: catPose.id,
      name: "Watching",
      prompt: "watching pose, upper body, looking away, thoughtful expression",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      sortOrder: 1,
    },
  });

  const presetBenchSit = await prisma.promptPreset.upsert({
    where: { id: "seed-preset-bench-sit" },
    update: {},
    create: {
      id: "seed-preset-bench-sit",
      categoryId: catPose.id,
      name: "Bench sit",
      prompt: "sitting on bench, relaxed pose, legs crossed, upper body",
      negativePrompt: "bad anatomy, extra limbs, blurry",
      sortOrder: 2,
    },
  });

  // --- Projects ---
  const jobMiku = await prisma.project.upsert({
    where: { slug: "miku-spring-batch-a" },
    update: {},
    create: {
      title: "Miku spring batch A",
      slug: "miku-spring-batch-a",
      status: "done",
    },
  });

  let mikuStanding = await prisma.projectSection.findFirst({
    where: { projectId: jobMiku.id, sortOrder: 0 },
  });
  if (!mikuStanding) {
    mikuStanding = await prisma.projectSection.create({
      data: {
        projectId: jobMiku.id,
        sortOrder: 0,
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(mikuStanding.id, [
    { type: "preset", label: presetMiku.name, prompt: presetMiku.prompt, sourceId: presetMiku.id },
    { type: "preset", label: presetParkBench.name, prompt: presetParkBench.prompt, sourceId: presetParkBench.id },
    { type: "preset", label: presetSoftDaylight.name, prompt: presetSoftDaylight.prompt, sourceId: presetSoftDaylight.id },
    { type: "preset", label: presetStanding.name, prompt: presetStanding.prompt, negativePrompt: presetStanding.negativePrompt, sourceId: presetStanding.id },
  ]);

  let mikuWatching = await prisma.projectSection.findFirst({
    where: { projectId: jobMiku.id, sortOrder: 1 },
  });
  if (!mikuWatching) {
    mikuWatching = await prisma.projectSection.create({
      data: {
        projectId: jobMiku.id,
        sortOrder: 1,
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(mikuWatching.id, [
    { type: "preset", label: presetMiku.name, prompt: presetMiku.prompt, sourceId: presetMiku.id },
    { type: "preset", label: presetParkBench.name, prompt: presetParkBench.prompt, sourceId: presetParkBench.id },
    { type: "preset", label: presetSoftDaylight.name, prompt: presetSoftDaylight.prompt, sourceId: presetSoftDaylight.id },
    { type: "preset", label: presetWatching.name, prompt: presetWatching.prompt, negativePrompt: presetWatching.negativePrompt, sourceId: presetWatching.id },
  ]);

  // --- Project: Tangtang park test ---
  const jobTangtang = await prisma.project.upsert({
    where: { slug: "tangtang-park-test" },
    update: {},
    create: {
      title: "Tangtang park test",
      slug: "tangtang-park-test",
      status: "done",
    },
  });

  let tangtangBench = await prisma.projectSection.findFirst({
    where: { projectId: jobTangtang.id, sortOrder: 0 },
  });
  if (!tangtangBench) {
    tangtangBench = await prisma.projectSection.create({
      data: {
        projectId: jobTangtang.id,
        sortOrder: 0,
        batchSize: 6,
        aspectRatio: "3:4",
      },
    });
  }
  await generatePromptBlocks(tangtangBench.id, [
    { type: "preset", label: presetTangtang.name, prompt: presetTangtang.prompt, sourceId: presetTangtang.id },
    { type: "preset", label: presetRiverside.name, prompt: presetRiverside.prompt, sourceId: presetRiverside.id },
    { type: "preset", label: presetAnimeCinematic.name, prompt: presetAnimeCinematic.prompt, sourceId: presetAnimeCinematic.id },
    { type: "preset", label: presetBenchSit.name, prompt: presetBenchSit.prompt, negativePrompt: presetBenchSit.negativePrompt, sourceId: presetBenchSit.id },
  ]);

  // --- PositionRuns + ImageResults ---
  const mikuStandingImages = await buildSeedImages(
    "miku-spring-batch-a", "standing", 1, 9,
    (i) => i < 2 ? "kept" : "pending",
  );

  const runMikuStanding = await prisma.positionRun.create({
    data: {
      projectId: jobMiku.id,
      projectSectionId: mikuStanding.id,
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
      projectId: jobMiku.id,
      projectSectionId: mikuWatching.id,
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
      projectId: jobTangtang.id,
      projectSectionId: tangtangBench.id,
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
  console.log(`   Categories: ${catCharacter.name}, ${catScene.name}, ${catStyle.name}, ${catPose.name}`);
  console.log(`   Presets: ${presetMiku.name}, ${presetTangtang.name}, ${presetParkBench.name}, ${presetRiverside.name}, ${presetSoftDaylight.name}, ${presetAnimeCinematic.name}, ${presetStanding.name}, ${presetWatching.name}, ${presetBenchSit.name}`);
  console.log(`   Jobs: ${jobMiku.title}, ${jobTangtang.title}`);
  console.log(`   Sections: ${mikuStanding.id.split("-")[0]}..${mikuWatching.id.split("-")[0]}, ${tangtangBench.id.split("-")[0]}..`);
  console.log(`   Runs: 3 (with 27 images total)`);
  console.log(`   Trash records: 2`);
  console.log(`   LoRA assets: 2`);
  console.log(`   PromptBlocks: 4 per section (12 total)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

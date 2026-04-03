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

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up previous seed data to avoid unique constraint conflicts.
  await prisma.trashRecord.deleteMany({});
  await prisma.imageResult.deleteMany({});
  await prisma.run.deleteMany({});
  await prisma.promptBlock.deleteMany({});
  console.log("   Cleaned old run / image / trash / prompt-block data.");

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

  const jobTangtang = await prisma.project.upsert({
    where: { slug: "tangtang-park-test" },
    update: {},
    create: {
      title: "Tangtang park test",
      slug: "tangtang-park-test",
      status: "done",
    },
  });

  // --- Sections ---
  let mikuStanding = await prisma.projectSection.findFirst({
    where: { projectId: jobMiku.id, name: "Standing" },
  });
  if (!mikuStanding) {
    mikuStanding = await prisma.projectSection.create({
      data: {
        projectId: jobMiku.id,
        sortOrder: 0,
        name: "Standing",
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }

  await prisma.promptBlock.create({
    data: {
      projectSectionId: mikuStanding.id,
      type: "custom",
      label: "Standing prompt",
      positive: "standing pose, full body, looking at viewer, arms at sides",
      negative: "bad anatomy, extra limbs, blurry",
      sortOrder: 0,
    },
  });

  let mikuWatching = await prisma.projectSection.findFirst({
    where: { projectId: jobMiku.id, name: "Watching" },
  });
  if (!mikuWatching) {
    mikuWatching = await prisma.projectSection.create({
      data: {
        projectId: jobMiku.id,
        sortOrder: 1,
        name: "Watching",
        batchSize: 8,
        aspectRatio: "3:4",
      },
    });
  }

  await prisma.promptBlock.create({
    data: {
      projectSectionId: mikuWatching.id,
      type: "custom",
      label: "Watching prompt",
      positive: "watching pose, upper body, looking away, thoughtful expression",
      negative: "bad anatomy, extra limbs, blurry",
      sortOrder: 0,
    },
  });

  let tangtangBench = await prisma.projectSection.findFirst({
    where: { projectId: jobTangtang.id, name: "Bench sit" },
  });
  if (!tangtangBench) {
    tangtangBench = await prisma.projectSection.create({
      data: {
        projectId: jobTangtang.id,
        sortOrder: 0,
        name: "Bench sit",
        batchSize: 6,
        aspectRatio: "3:4",
      },
    });
  }

  await prisma.promptBlock.create({
    data: {
      projectSectionId: tangtangBench.id,
      type: "custom",
      label: "Bench sit prompt",
      positive: "sitting on bench, relaxed pose, legs crossed, upper body",
      negative: "bad anatomy, extra limbs, blurry",
      sortOrder: 0,
    },
  });

  // --- Runs + ImageResults ---
  const mikuStandingImages = await buildSeedImages(
    "miku-spring-batch-a", "standing", 1, 9,
    (i) => i < 2 ? "kept" : "pending",
  );

  const runMikuStanding = await prisma.run.create({
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

  await prisma.run.create({
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

  const runTangtangBench = await prisma.run.create({
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
    where: { runId: runMikuStanding.id },
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
    where: { runId: runTangtangBench.id },
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
  console.log(`   Jobs: ${jobMiku.title}, ${jobTangtang.title}`);
  console.log(`   Sections: 3`);
  console.log(`   Runs: 3 (with 27 images total)`);
  console.log(`   Trash records: 2`);
  console.log(`   LoRA assets: 2`);
  console.log(`   PromptBlocks: 1 per section (3 total)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

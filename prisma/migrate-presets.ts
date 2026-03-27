/**
 * Data migration script: Legacy preset tables → PromptCategory + PromptPreset
 *
 * Migrates: Character, ScenePreset, StylePreset, PositionTemplate
 *       → PromptCategory (4 defaults) + PromptPreset (one per legacy record)
 *
 * Also patches:
 *   - CompleteJob.presetBindings ← built from old FK columns
 *   - PromptBlock.type character/scene/style/position → "preset" + categoryId
 *
 * Run with:  npx tsx prisma/migrate-presets.ts
 *
 * Safe to re-run: uses upserts keyed on slug.
 */

import "dotenv/config";

function detectProvider(): "postgresql" | "sqlite" {
  const explicit = process.env.DB_PROVIDER?.toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  if (explicit === "postgresql" || explicit === "postgres") return "postgresql";
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:") || url.endsWith(".db") || url.endsWith(".sqlite")) return "sqlite";
  return "postgresql";
}

const clientModule =
  detectProvider() === "sqlite"
    ? await import("../src/generated/prisma-sqlite/client.js")
    : await import("../src/generated/prisma/client.js");
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

// ── Category definitions ─────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { slug: "character", name: "角色", icon: "User", color: "sky", sortOrder: 0, ppo: 0, npo: 0, l1o: 0, l2o: 0 },
  { slug: "scene", name: "场景", icon: "MapPin", color: "emerald", sortOrder: 1, ppo: 10, npo: 10, l1o: 10, l2o: 10 },
  { slug: "style", name: "风格", icon: "Palette", color: "violet", sortOrder: 2, ppo: 20, npo: 20, l1o: 20, l2o: 20 },
  { slug: "position", name: "镜位", icon: "LayoutGrid", color: "amber", sortOrder: 3, ppo: 30, npo: 30, l1o: 30, l2o: 30 },
] as const;

async function main() {
  console.log("🔄 Starting preset migration...\n");

  // ── Step 1: Create 4 default PromptCategories ──────────────────────────

  const categoryMap = new Map<string, string>(); // slug → id

  for (const def of CATEGORY_DEFS) {
    const cat = await prisma.promptCategory.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        icon: def.icon,
        color: def.color,
        sortOrder: def.sortOrder,
        positivePromptOrder: def.ppo,
        negativePromptOrder: def.npo,
        lora1Order: def.l1o,
        lora2Order: def.l2o,
      },
      create: {
        name: def.name,
        slug: def.slug,
        icon: def.icon,
        color: def.color,
        sortOrder: def.sortOrder,
        positivePromptOrder: def.ppo,
        negativePromptOrder: def.npo,
        lora1Order: def.l1o,
        lora2Order: def.l2o,
      },
    });
    categoryMap.set(def.slug, cat.id);
    console.log(`   PromptCategory: ${def.name} (${cat.id})`);
  }

  const characterCatId = categoryMap.get("character")!;
  const sceneCatId = categoryMap.get("scene")!;
  const styleCatId = categoryMap.get("style")!;
  const positionCatId = categoryMap.get("position")!;

  // ── Step 2: Character → PromptPreset ───────────────────────────────────

  const characters = await prisma.character.findMany();
  const charIdMap = new Map<string, string>(); // old id → new preset id

  for (const ch of characters) {
    // Build lora1 from loraBindings or loraPath
    let lora1 = ch.loraBindings;
    if (!lora1 && ch.loraPath) {
      lora1 = [{ path: ch.loraPath, weight: 1, enabled: true }];
    }

    const preset = await prisma.promptPreset.upsert({
      where: { slug: ch.slug },
      update: {
        name: ch.name,
        prompt: ch.prompt,
        negativePrompt: ch.negativePrompt,
        lora1: lora1 ?? undefined,
        notes: ch.notes,
        isActive: ch.isActive,
        categoryId: characterCatId,
      },
      create: {
        categoryId: characterCatId,
        name: ch.name,
        slug: ch.slug,
        prompt: ch.prompt,
        negativePrompt: ch.negativePrompt,
        lora1: lora1 ?? undefined,
        notes: ch.notes,
        isActive: ch.isActive,
        sortOrder: 0,
      },
    });
    charIdMap.set(ch.id, preset.id);
  }
  console.log(`   Characters migrated: ${characters.length}`);

  // ── Step 3: ScenePreset → PromptPreset ─────────────────────────────────

  const scenePresets = await prisma.scenePreset.findMany();
  const sceneIdMap = new Map<string, string>();

  for (const sp of scenePresets) {
    const preset = await prisma.promptPreset.upsert({
      where: { slug: sp.slug },
      update: {
        name: sp.name,
        prompt: sp.prompt,
        negativePrompt: sp.negativePrompt,
        notes: sp.notes,
        isActive: sp.isActive,
        categoryId: sceneCatId,
      },
      create: {
        categoryId: sceneCatId,
        name: sp.name,
        slug: sp.slug,
        prompt: sp.prompt,
        negativePrompt: sp.negativePrompt,
        notes: sp.notes,
        isActive: sp.isActive,
        sortOrder: 0,
      },
    });
    sceneIdMap.set(sp.id, preset.id);
  }
  console.log(`   ScenePresets migrated: ${scenePresets.length}`);

  // ── Step 4: StylePreset → PromptPreset ─────────────────────────────────

  const stylePresets = await prisma.stylePreset.findMany();
  const styleIdMap = new Map<string, string>();

  for (const sp of stylePresets) {
    const preset = await prisma.promptPreset.upsert({
      where: { slug: sp.slug },
      update: {
        name: sp.name,
        prompt: sp.prompt,
        negativePrompt: sp.negativePrompt,
        notes: sp.notes,
        isActive: sp.isActive,
        categoryId: styleCatId,
      },
      create: {
        categoryId: styleCatId,
        name: sp.name,
        slug: sp.slug,
        prompt: sp.prompt,
        negativePrompt: sp.negativePrompt,
        notes: sp.notes,
        isActive: sp.isActive,
        sortOrder: 0,
      },
    });
    styleIdMap.set(sp.id, preset.id);
  }
  console.log(`   StylePresets migrated: ${stylePresets.length}`);

  // ── Step 5: PositionTemplate → PromptPreset ────────────────────────────

  const positionTemplates = await prisma.positionTemplate.findMany();
  const positionIdMap = new Map<string, string>();

  for (const pt of positionTemplates) {
    const defaultParams: Record<string, unknown> = {};
    if (pt.defaultAspectRatio) defaultParams.defaultAspectRatio = pt.defaultAspectRatio;
    if (pt.defaultShortSidePx) defaultParams.defaultShortSidePx = pt.defaultShortSidePx;
    if (pt.defaultBatchSize) defaultParams.defaultBatchSize = pt.defaultBatchSize;
    if (pt.defaultSeedPolicy1) defaultParams.defaultSeedPolicy1 = pt.defaultSeedPolicy1;
    if (pt.defaultSeedPolicy2) defaultParams.defaultSeedPolicy2 = pt.defaultSeedPolicy2;
    if (pt.defaultKsampler1) defaultParams.defaultKsampler1 = pt.defaultKsampler1;
    if (pt.defaultKsampler2) defaultParams.defaultKsampler2 = pt.defaultKsampler2;
    // Merge with any existing defaultParams
    if (pt.defaultParams && typeof pt.defaultParams === "object") {
      Object.assign(defaultParams, pt.defaultParams);
    }

    const preset = await prisma.promptPreset.upsert({
      where: { slug: pt.slug },
      update: {
        name: pt.name,
        prompt: pt.prompt,
        negativePrompt: pt.negativePrompt,
        lora1: pt.lora1 ?? undefined,
        lora2: pt.lora2 ?? undefined,
        defaultParams: Object.keys(defaultParams).length > 0 ? defaultParams : undefined,
        isActive: pt.enabled,
        categoryId: positionCatId,
      },
      create: {
        categoryId: positionCatId,
        name: pt.name,
        slug: pt.slug,
        prompt: pt.prompt,
        negativePrompt: pt.negativePrompt,
        lora1: pt.lora1 ?? undefined,
        lora2: pt.lora2 ?? undefined,
        defaultParams: Object.keys(defaultParams).length > 0 ? defaultParams : undefined,
        isActive: pt.enabled,
        sortOrder: 0,
      },
    });
    positionIdMap.set(pt.id, preset.id);
  }
  console.log(`   PositionTemplates migrated: ${positionTemplates.length}`);

  // ── Step 6: Patch CompleteJob.presetBindings ───────────────────────────

  const jobs = await prisma.completeJob.findMany({
    select: {
      id: true,
      characterId: true,
      scenePresetId: true,
      stylePresetId: true,
      presetBindings: true,
    },
  });

  let jobsPatched = 0;
  for (const job of jobs) {
    // Skip jobs that already have presetBindings
    if (job.presetBindings && Array.isArray(job.presetBindings) && job.presetBindings.length > 0) {
      continue;
    }

    const bindings: Array<{ categoryId: string; presetId: string }> = [];

    const charPresetId = charIdMap.get(job.characterId);
    if (charPresetId) {
      bindings.push({ categoryId: characterCatId, presetId: charPresetId });
    }

    if (job.scenePresetId) {
      const scenePresetId = sceneIdMap.get(job.scenePresetId);
      if (scenePresetId) {
        bindings.push({ categoryId: sceneCatId, presetId: scenePresetId });
      }
    }

    if (job.stylePresetId) {
      const stylePresetId = styleIdMap.get(job.stylePresetId);
      if (stylePresetId) {
        bindings.push({ categoryId: styleCatId, presetId: stylePresetId });
      }
    }

    if (bindings.length > 0) {
      await prisma.completeJob.update({
        where: { id: job.id },
        data: { presetBindings: bindings },
      });
      jobsPatched++;
    }
  }
  console.log(`   CompleteJobs patched: ${jobsPatched}/${jobs.length}`);

  // ── Step 7: Patch PromptBlock type + categoryId ────────────────────────

  const TYPE_TO_CATEGORY: Record<string, string> = {
    character: characterCatId,
    scene: sceneCatId,
    style: styleCatId,
    position: positionCatId,
  };

  let blocksPatched = 0;
  for (const [oldType, catId] of Object.entries(TYPE_TO_CATEGORY)) {
    const result = await prisma.promptBlock.updateMany({
      where: { type: oldType },
      data: { type: "preset", categoryId: catId },
    });
    blocksPatched += result.count;
  }
  console.log(`   PromptBlocks patched: ${blocksPatched}`);

  console.log("\n✅ Migration complete!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Migration failed:", e);
  prisma.$disconnect();
  process.exit(1);
});

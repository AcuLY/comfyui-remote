/**
 * Migration script: Character / ScenePreset / StylePreset / PositionTemplate
 *   → PromptCategory + PromptPreset
 *
 * Also updates CompleteJob.presetBindings and PromptBlock.type/categoryId.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-presets.mts
 */

import "dotenv/config";

// ---------------------------------------------------------------------------
// DB provider detection (same as seed.mts)
// ---------------------------------------------------------------------------

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter }) as any;

// ---------------------------------------------------------------------------
// Default categories
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { name: "角色", slug: "character", icon: "User",       color: "sky",     sortOrder: 0, positivePromptOrder: 0,  negativePromptOrder: 0,  lora1Order: 0,  lora2Order: 0  },
  { name: "场景", slug: "scene",     icon: "MapPin",     color: "emerald", sortOrder: 1, positivePromptOrder: 10, negativePromptOrder: 10, lora1Order: 10, lora2Order: 10 },
  { name: "风格", slug: "style",     icon: "Palette",    color: "violet",  sortOrder: 2, positivePromptOrder: 20, negativePromptOrder: 20, lora1Order: 20, lora2Order: 20 },
  { name: "镜位", slug: "position",  icon: "LayoutGrid", color: "amber",   sortOrder: 3, positivePromptOrder: 30, negativePromptOrder: 30, lora1Order: 30, lora2Order: 30 },
] as const;

// Map old type strings to category slugs
const TYPE_TO_CATEGORY_SLUG: Record<string, string> = {
  character: "character",
  scene: "scene",
  style: "style",
  position: "position",
};

// ---------------------------------------------------------------------------
// Main migration
// ---------------------------------------------------------------------------

async function main() {
  console.log(`DB provider: ${detectProvider()}`);

  // Step 1: Create default PromptCategories (upsert by slug)
  console.log("\n── Step 1: Creating default PromptCategories ──");
  const categoryMap: Record<string, string> = {}; // slug → id

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.promptCategory.findUnique({ where: { slug: cat.slug } });
    if (existing) {
      categoryMap[cat.slug] = existing.id;
      console.log(`  ✓ Category "${cat.name}" already exists (${existing.id})`);
    } else {
      const created = await prisma.promptCategory.create({ data: cat });
      categoryMap[cat.slug] = created.id;
      console.log(`  + Created category "${cat.name}" (${created.id})`);
    }
  }

  // Old ID → new PromptPreset ID mapping
  const presetIdMap: Record<string, string> = {};

  // Step 2: Migrate Character → PromptPreset (category=角色)
  console.log("\n── Step 2: Migrating Characters ──");
  const characters = await prisma.character.findMany();
  for (const c of characters) {
    // Build lora1 from loraBindings or loraPath
    let lora1 = null;
    if (c.loraBindings) {
      const bindings = typeof c.loraBindings === "string" ? JSON.parse(c.loraBindings) : c.loraBindings;
      if (Array.isArray(bindings) && bindings.length > 0) {
        lora1 = bindings;
      }
    }
    if (!lora1 && c.loraPath) {
      lora1 = [{ path: c.loraPath, weight: 1.0, enabled: true }];
    }

    const existing = await prisma.promptPreset.findUnique({ where: { slug: c.slug } });
    if (existing) {
      presetIdMap[c.id] = existing.id;
      console.log(`  ✓ Preset "${c.name}" already exists (${existing.id})`);
      continue;
    }

    const preset = await prisma.promptPreset.create({
      data: {
        categoryId: categoryMap["character"],
        name: c.name,
        slug: c.slug,
        prompt: c.prompt,
        negativePrompt: c.negativePrompt,
        lora1: lora1 ? JSON.stringify(lora1) : null,
        lora2: null,
        notes: c.notes,
        isActive: c.isActive,
      },
    });
    presetIdMap[c.id] = preset.id;
    console.log(`  + Migrated character "${c.name}" → preset (${preset.id})`);
  }

  // Step 3: Migrate ScenePreset → PromptPreset (category=场景)
  console.log("\n── Step 3: Migrating Scenes ──");
  const scenes = await prisma.scenePreset.findMany();
  for (const s of scenes) {
    const existing = await prisma.promptPreset.findUnique({ where: { slug: s.slug } });
    if (existing) {
      presetIdMap[s.id] = existing.id;
      console.log(`  ✓ Preset "${s.name}" already exists (${existing.id})`);
      continue;
    }

    const preset = await prisma.promptPreset.create({
      data: {
        categoryId: categoryMap["scene"],
        name: s.name,
        slug: s.slug,
        prompt: s.prompt,
        negativePrompt: s.negativePrompt,
        notes: s.notes,
        isActive: s.isActive,
      },
    });
    presetIdMap[s.id] = preset.id;
    console.log(`  + Migrated scene "${s.name}" → preset (${preset.id})`);
  }

  // Step 4: Migrate StylePreset → PromptPreset (category=风格)
  console.log("\n── Step 4: Migrating Styles ──");
  const styles = await prisma.stylePreset.findMany();
  for (const s of styles) {
    const existing = await prisma.promptPreset.findUnique({ where: { slug: s.slug } });
    if (existing) {
      presetIdMap[s.id] = existing.id;
      console.log(`  ✓ Preset "${s.name}" already exists (${existing.id})`);
      continue;
    }

    const preset = await prisma.promptPreset.create({
      data: {
        categoryId: categoryMap["style"],
        name: s.name,
        slug: s.slug,
        prompt: s.prompt,
        negativePrompt: s.negativePrompt,
        notes: s.notes,
        isActive: s.isActive,
      },
    });
    presetIdMap[s.id] = preset.id;
    console.log(`  + Migrated style "${s.name}" → preset (${preset.id})`);
  }

  // Step 5: Migrate PositionTemplate → PromptPreset (category=镜位)
  console.log("\n── Step 5: Migrating PositionTemplates ──");
  const positions = await prisma.positionTemplate.findMany();
  for (const p of positions) {
    const existing = await prisma.promptPreset.findUnique({ where: { slug: p.slug } });
    if (existing) {
      presetIdMap[p.id] = existing.id;
      console.log(`  ✓ Preset "${p.name}" already exists (${existing.id})`);
      continue;
    }

    // Build defaultParams from the various default* fields
    const defaultParams: Record<string, unknown> = {};
    if (p.defaultAspectRatio) defaultParams.aspectRatio = p.defaultAspectRatio;
    if (p.defaultShortSidePx) defaultParams.shortSidePx = p.defaultShortSidePx;
    if (p.defaultBatchSize) defaultParams.batchSize = p.defaultBatchSize;
    if (p.defaultSeedPolicy1) defaultParams.seedPolicy1 = p.defaultSeedPolicy1;
    if (p.defaultSeedPolicy2) defaultParams.seedPolicy2 = p.defaultSeedPolicy2;
    if (p.defaultKsampler1) defaultParams.ksampler1 = typeof p.defaultKsampler1 === "string" ? JSON.parse(p.defaultKsampler1) : p.defaultKsampler1;
    if (p.defaultKsampler2) defaultParams.ksampler2 = typeof p.defaultKsampler2 === "string" ? JSON.parse(p.defaultKsampler2) : p.defaultKsampler2;
    if (p.defaultParams) {
      const extra = typeof p.defaultParams === "string" ? JSON.parse(p.defaultParams) : p.defaultParams;
      Object.assign(defaultParams, extra);
    }

    const preset = await prisma.promptPreset.create({
      data: {
        categoryId: categoryMap["position"],
        name: p.name,
        slug: p.slug,
        prompt: p.prompt,
        negativePrompt: p.negativePrompt,
        lora1: p.lora1 ? (typeof p.lora1 === "string" ? p.lora1 : JSON.stringify(p.lora1)) : null,
        lora2: p.lora2 ? (typeof p.lora2 === "string" ? p.lora2 : JSON.stringify(p.lora2)) : null,
        defaultParams: Object.keys(defaultParams).length > 0 ? JSON.stringify(defaultParams) : null,
        notes: null,
        isActive: p.enabled,
      },
    });
    presetIdMap[p.id] = preset.id;
    console.log(`  + Migrated position "${p.name}" → preset (${preset.id})`);
  }

  // Step 6: Update CompleteJob.presetBindings
  console.log("\n── Step 6: Updating CompleteJob.presetBindings ──");
  const jobs = await prisma.completeJob.findMany({
    select: { id: true, characterId: true, scenePresetId: true, stylePresetId: true, presetBindings: true },
  });
  let jobsUpdated = 0;
  for (const job of jobs) {
    if (job.presetBindings) continue; // Already migrated

    const bindings: Array<{ categoryId: string; presetId: string }> = [];
    if (job.characterId && presetIdMap[job.characterId]) {
      bindings.push({ categoryId: categoryMap["character"], presetId: presetIdMap[job.characterId] });
    }
    if (job.scenePresetId && presetIdMap[job.scenePresetId]) {
      bindings.push({ categoryId: categoryMap["scene"], presetId: presetIdMap[job.scenePresetId] });
    }
    if (job.stylePresetId && presetIdMap[job.stylePresetId]) {
      bindings.push({ categoryId: categoryMap["style"], presetId: presetIdMap[job.stylePresetId] });
    }

    if (bindings.length > 0) {
      await prisma.completeJob.update({
        where: { id: job.id },
        data: { presetBindings: JSON.stringify(bindings) },
      });
      jobsUpdated++;
    }
  }
  console.log(`  Updated ${jobsUpdated} / ${jobs.length} jobs`);

  // Step 7: Update PromptBlock.type and categoryId
  console.log("\n── Step 7: Updating PromptBlock.type/categoryId ──");
  const blocks = await prisma.promptBlock.findMany({
    select: { id: true, type: true, sourceId: true, categoryId: true },
  });
  let blocksUpdated = 0;
  for (const block of blocks) {
    if (block.categoryId) continue; // Already migrated

    const catSlug = TYPE_TO_CATEGORY_SLUG[block.type];
    if (catSlug && categoryMap[catSlug]) {
      // Map sourceId from old entity ID to new preset ID
      const newSourceId = block.sourceId ? (presetIdMap[block.sourceId] ?? block.sourceId) : block.sourceId;
      await prisma.promptBlock.update({
        where: { id: block.id },
        data: {
          type: "preset",
          categoryId: categoryMap[catSlug],
          sourceId: newSourceId,
        },
      });
      blocksUpdated++;
    }
    // "custom" blocks remain unchanged (type=custom, categoryId=null)
  }
  console.log(`  Updated ${blocksUpdated} / ${blocks.length} blocks`);

  console.log("\n✅ Migration complete!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

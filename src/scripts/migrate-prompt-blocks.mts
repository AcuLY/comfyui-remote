/**
 * Migration script: generate PromptBlocks for existing CompleteJobPositions
 * that don't have any blocks yet.
 *
 * Logic mirrors createProject() in project-repository.ts:
 *   1. Character block (always)
 *   2. Scene block (if scenePreset exists)
 *   3. Style block (if stylePreset exists)
 *   4. Position block (if positionTemplate exists)
 *
 * Usage:
 *   npx tsx src/scripts/migrate-prompt-blocks.mts
 *   # Dry-run (no writes):
 *   DRY_RUN=1 npx tsx src/scripts/migrate-prompt-blocks.mts
 */

import "dotenv/config";
import { PrismaClient, PromptBlockType } from "../generated/prisma/client.js";

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

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN — no changes will be written." : "🚀 Migrating PromptBlocks for existing positions...");

  // Find all positions that have zero PromptBlocks
  const positionsWithoutBlocks = await prisma.projectSection.findMany({
    where: {
      promptBlocks: { none: {} },
    },
    select: {
      id: true,
      projectId: true,
      positionTemplateId: true,
      positivePrompt: true,
      negativePrompt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`   Found ${positionsWithoutBlocks.length} positions without PromptBlocks.`);

  if (positionsWithoutBlocks.length === 0) {
    console.log("   Nothing to migrate.");
    await prisma.$disconnect();
    return;
  }

  if (DRY_RUN) {
    for (const pos of positionsWithoutBlocks) {
      const job = await prisma.project.findUnique({
        where: { id: pos.projectId },
        select: {
          characterId: true,
          scenePresetId: true,
          stylePresetId: true,
        },
      });
      const pt = pos.positionTemplateId
        ? await prisma.positionTemplate.findUnique({
            where: { id: pos.positionTemplateId },
            select: { name: true },
          })
        : null;

      console.log(`   [DRY] Position ${pos.id}: job=${pos.projectId}, template=${pt?.name ?? "none"}, customPrompt=${pos.positivePrompt ? "yes" : "no"}`);
    }
    await prisma.$disconnect();
    return;
  }

  let migratedCount = 0;
  let errorCount = 0;

  for (const pos of positionsWithoutBlocks) {
    try {
      const job = await prisma.project.findUnique({
        where: { id: pos.projectId },
        select: {
          characterId: true,
          scenePresetId: true,
          stylePresetId: true,
        },
      });

      if (!job) {
        console.warn(`   ⚠ Position ${pos.id}: job ${pos.projectId} not found, skipping.`);
        errorCount++;
        continue;
      }

      const [character, scenePreset, stylePreset, positionTemplate] = await Promise.all([
        prisma.character.findUnique({
          where: { id: job.characterId },
          select: { id: true, name: true, prompt: true, negativePrompt: true },
        }),
        job.scenePresetId
          ? prisma.scenePreset.findUnique({
              where: { id: job.scenePresetId },
              select: { id: true, name: true, prompt: true, negativePrompt: true },
            })
          : null,
        job.stylePresetId
          ? prisma.stylePreset.findUnique({
              where: { id: job.stylePresetId },
              select: { id: true, name: true, prompt: true, negativePrompt: true },
            })
          : null,
        pos.positionTemplateId
          ? prisma.positionTemplate.findUnique({
              where: { id: pos.positionTemplateId },
              select: { id: true, name: true, prompt: true, negativePrompt: true },
            })
          : null,
      ]);

      let sortOrder = 0;
      const blocks: Array<{
        type: PromptBlockType;
        sourceId: string | null;
        label: string;
        positive: string;
        negative: string | null;
        sortOrder: number;
      }> = [];

      // Character block
      if (character) {
        blocks.push({
          type: "character" as PromptBlockType,
          sourceId: character.id,
          label: character.name,
          positive: character.prompt,
          negative: character.negativePrompt,
          sortOrder: sortOrder++,
        });
      }

      // Scene block
      if (scenePreset) {
        blocks.push({
          type: "scene" as PromptBlockType,
          sourceId: scenePreset.id,
          label: scenePreset.name,
          positive: scenePreset.prompt,
          negative: scenePreset.negativePrompt,
          sortOrder: sortOrder++,
        });
      }

      // Style block
      if (stylePreset) {
        blocks.push({
          type: "style" as PromptBlockType,
          sourceId: stylePreset.id,
          label: stylePreset.name,
          positive: stylePreset.prompt,
          negative: stylePreset.negativePrompt,
          sortOrder: sortOrder++,
        });
      }

      // Position template block
      if (positionTemplate) {
        blocks.push({
          type: "position" as PromptBlockType,
          sourceId: positionTemplate.id,
          label: positionTemplate.name,
          positive: positionTemplate.prompt,
          negative: positionTemplate.negativePrompt,
          sortOrder: sortOrder++,
        });
      }

      // If the position has a custom positivePrompt (set via edit form), add as custom block
      if (pos.positivePrompt) {
        blocks.push({
          type: "custom" as PromptBlockType,
          sourceId: null,
          label: "Custom Override",
          positive: pos.positivePrompt,
          negative: pos.negativePrompt,
          sortOrder: sortOrder++,
        });
      }

      if (blocks.length > 0) {
        await prisma.promptBlock.createMany({
          data: blocks.map((block) => ({
            projectSectionId: pos.id,
            ...block,
          })),
        });

        const blockSummary = blocks.map((b) => `${b.type}(${b.label})`).join(", ");
        console.log(`   ✅ Position ${pos.id}: created ${blocks.length} blocks [${blockSummary}]`);
        migratedCount++;
      } else {
        console.warn(`   ⚠ Position ${pos.id}: no source data to create blocks, skipping.`);
        errorCount++;
      }
    } catch (error) {
      console.error(`   ❌ Position ${pos.id}: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  }

  console.log(`\n   Migration complete: ${migratedCount} migrated, ${errorCount} errors.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});

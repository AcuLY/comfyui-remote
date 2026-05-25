/**
 * Backfill comfyOutputSubfolder for existing completed runs.
 *
 * Extracts the output_path from the submittedPrompt JSON ($.515.inputs.output_path)
 * which records the exact path that was submitted to ComfyUI's SaveImage node.
 *
 * Usage: npx tsx src/scripts/backfill-comfy-output-subfolder.ts
 */
import { db } from "../lib/db";

async function main() {
  const runs = await db.run.findMany({
    where: {
      status: "done",
      comfyOutputSubfolder: null,
      submittedPrompt: { not: { equals: null } },
    },
    select: {
      id: true,
      submittedPrompt: true,
    },
  });

  console.log(`Found ${runs.length} runs to backfill`);

  let updated = 0;
  let skipped = 0;

  for (const run of runs) {
    try {
      const prompt = run.submittedPrompt as Record<string, unknown> | null;
      const node515 = prompt?.["515"] as Record<string, unknown> | undefined;
      const inputs = node515?.inputs as Record<string, unknown> | undefined;
      const outputPath = inputs?.output_path as string | undefined;

      if (!outputPath || typeof outputPath !== "string" || !outputPath.trim()) {
        skipped++;
        continue;
      }

      await db.run.update({
        where: { id: run.id },
        data: { comfyOutputSubfolder: outputPath.trim() },
      });
      updated++;
    } catch (error) {
      console.error(`Failed to backfill run ${run.id}:`, error);
      skipped++;
    }
  }

  console.log(`Backfilled ${updated} runs, skipped ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

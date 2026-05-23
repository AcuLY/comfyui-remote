import process from "node:process";

import { prisma } from "../../src/lib/prisma";
import { ensureCharacterLoraBenchmarkTemplate } from "../../src/server/services/character-lora-training/benchmark-promotion-service";

const HELP = `
Character LoRA benchmark ProjectTemplate bootstrap

Usage:
  cmd /c npx tsx scripts/character-lora-training/ensure-benchmark-template.ts
  cmd /c npx tsx scripts/character-lora-training/ensure-benchmark-template.ts --checkpoint fake-base.safetensors

Options:
  --checkpoint <name>  Optional default checkpointName written to the 7 template sections.
  --help              Show this help.
`.trim();

main().catch(async (error) => {
  console.error("[character-lora ensure-benchmark-template] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const checkpointName = readCheckpointName(args);
  const result = await ensureCharacterLoraBenchmarkTemplate({ checkpointName });
  console.log(JSON.stringify({
    result: result.result,
    created: result.created,
    found: result.found,
    id: result.template.id,
    name: result.template.name,
    sectionCount: result.template.sectionCount,
    isUsable: result.template.isUsable,
    requiredSectionCount: result.requiredSectionCount,
  }, null, 2));
}

function readCheckpointName(args: string[]) {
  let checkpointName: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--checkpoint") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--checkpoint requires a value");
      }
      checkpointName = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--checkpoint=")) {
      checkpointName = arg.slice("--checkpoint=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  const normalized = checkpointName?.trim();
  return normalized ? normalized : null;
}

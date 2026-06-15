import type { Prisma } from "@/generated/prisma";

export const LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS = [
  "角色 lora 测试",
  "角色 LoRA 测试",
  "character lora",
] as const;

export const LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME = "角色 LoRA 测试";
export const LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_DESCRIPTION =
  "Default ProjectTemplate for Character LoRA training benchmark and promotion evidence. It covers the standard 7 promotion variants.";

const LEGACY_TRAINING_BENCHMARK_PURPOSE = "character_lora_benchmark";
const LEGACY_TRAINING_BENCHMARK_NOTES_NEEDLES = [
  `"purpose": "${LEGACY_TRAINING_BENCHMARK_PURPOSE}"`,
  `"purpose":"${LEGACY_TRAINING_BENCHMARK_PURPOSE}"`,
] as const;

function legacyTrainingBenchmarkNotesFilters() {
  return LEGACY_TRAINING_BENCHMARK_NOTES_NEEDLES.map((needle) => ({
    notes: { contains: needle },
  }));
}

function excludeLegacyTrainingBenchmarkNotesWhere() {
  return {
    OR: [
      { notes: null },
      { NOT: { OR: legacyTrainingBenchmarkNotesFilters() } },
    ],
  };
}

export function isLegacyTrainingBenchmarkResourceNotes(notes: string | null | undefined) {
  if (!notes) return false;

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const record = parsed as Record<string, unknown>;
    return record.temporary === true && record.purpose === LEGACY_TRAINING_BENCHMARK_PURPOSE;
  } catch {
    return false;
  }
}

export function buildGenerationProjectWhere(where: Prisma.ProjectWhereInput = {}): Prisma.ProjectWhereInput {
  return {
    AND: [
      where,
      excludeLegacyTrainingBenchmarkNotesWhere(),
    ],
  };
}

export function buildGenerationPresetWhere(where: Prisma.PresetWhereInput = {}): Prisma.PresetWhereInput {
  return {
    AND: [
      where,
      excludeLegacyTrainingBenchmarkNotesWhere(),
    ],
  };
}

export function buildLegacyCharacterLoraBenchmarkTemplateWhere(): Prisma.ProjectTemplateWhereInput {
  return {
    OR: [
      ...LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS.map((term) => ({ name: { contains: term } })),
      { description: { contains: "Character LoRA training benchmark" } },
    ],
  };
}

export function buildGenerationProjectTemplateWhere(
  where: Prisma.ProjectTemplateWhereInput = {},
): Prisma.ProjectTemplateWhereInput {
  return {
    AND: [
      where,
      ...LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS.map((term) => ({
        NOT: { name: { contains: term } },
      })),
      {
        OR: [
          { description: null },
          { NOT: { description: { contains: "Character LoRA training benchmark" } } },
        ],
      },
    ],
  };
}

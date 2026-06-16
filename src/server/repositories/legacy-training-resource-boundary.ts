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
export const LEGACY_TRAINING_BENCHMARK_RESOURCE_WRITE_ERROR =
  "Generation resources cannot declare legacy training benchmark ownership";
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

export function hasLegacyTrainingBenchmarkPurposeNotes(notes: string | null | undefined) {
  if (!notes) return false;

  if (LEGACY_TRAINING_BENCHMARK_NOTES_NEEDLES.some((needle) => notes.includes(needle))) {
    return true;
  }

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    return (parsed as Record<string, unknown>).purpose === LEGACY_TRAINING_BENCHMARK_PURPOSE;
  } catch {
    return false;
  }
}

export function hasLegacyCharacterLoraBenchmarkTemplateIdentity(
  name: string | null | undefined,
  description: string | null | undefined,
) {
  const normalizedName = name?.toLowerCase() ?? "";
  if (
    LEGACY_CHARACTER_LORA_BENCHMARK_TEMPLATE_NAME_TERMS.some((term) =>
      normalizedName.includes(term.toLowerCase())
    )
  ) {
    return true;
  }

  return description?.includes("Character LoRA training benchmark") ?? false;
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

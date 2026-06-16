import type { Prisma } from "@/generated/prisma";

export const RESERVED_TRAINING_TEMPLATE_NAME_TERMS = [
  "训练测试",
  "training benchmark",
] as const;

export const RESERVED_TRAINING_TEMPLATE_NAME = "训练测试";
export const RESERVED_TRAINING_TEMPLATE_DESCRIPTION =
  "Default ProjectTemplate reserved for training benchmark evidence.";

const RESERVED_TRAINING_RESOURCE_PURPOSE = "training_benchmark";
export const TRAINING_RESERVED_RESOURCE_WRITE_ERROR =
  "Generation resources cannot declare reserved training ownership";
const RESERVED_TRAINING_NOTES_NEEDLES = [
  `"purpose": "${RESERVED_TRAINING_RESOURCE_PURPOSE}"`,
  `"purpose":"${RESERVED_TRAINING_RESOURCE_PURPOSE}"`,
] as const;

function reservedTrainingNotesFilters() {
  return RESERVED_TRAINING_NOTES_NEEDLES.map((needle) => ({
    notes: { contains: needle },
  }));
}

function excludeReservedTrainingNotesWhere() {
  return {
    OR: [
      { notes: null },
      { NOT: { OR: reservedTrainingNotesFilters() } },
    ],
  };
}

export function isReservedTrainingResourceNotes(notes: string | null | undefined) {
  if (!notes) return false;

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    const record = parsed as Record<string, unknown>;
    return record.temporary === true && record.purpose === RESERVED_TRAINING_RESOURCE_PURPOSE;
  } catch {
    return false;
  }
}

export function hasReservedTrainingPurposeNotes(notes: string | null | undefined) {
  if (!notes) return false;

  if (RESERVED_TRAINING_NOTES_NEEDLES.some((needle) => notes.includes(needle))) {
    return true;
  }

  try {
    const parsed = JSON.parse(notes) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    return (parsed as Record<string, unknown>).purpose === RESERVED_TRAINING_RESOURCE_PURPOSE;
  } catch {
    return false;
  }
}

export function hasReservedTrainingTemplateIdentity(
  name: string | null | undefined,
  description: string | null | undefined,
) {
  const normalizedName = name?.toLowerCase() ?? "";
  if (
    RESERVED_TRAINING_TEMPLATE_NAME_TERMS.some((term) =>
      normalizedName.includes(term.toLowerCase())
    )
  ) {
    return true;
  }

  return description?.includes(RESERVED_TRAINING_TEMPLATE_DESCRIPTION) ?? false;
}

export function buildGenerationProjectWhere(where: Prisma.ProjectWhereInput = {}): Prisma.ProjectWhereInput {
  return {
    AND: [
      where,
      excludeReservedTrainingNotesWhere(),
    ],
  };
}

export function buildGenerationPresetWhere(where: Prisma.PresetWhereInput = {}): Prisma.PresetWhereInput {
  return {
    AND: [
      where,
      excludeReservedTrainingNotesWhere(),
    ],
  };
}

export function buildReservedTrainingTemplateWhere(): Prisma.ProjectTemplateWhereInput {
  return {
    OR: [
      ...RESERVED_TRAINING_TEMPLATE_NAME_TERMS.map((term) => ({ name: { contains: term } })),
      { description: { contains: RESERVED_TRAINING_TEMPLATE_DESCRIPTION } },
    ],
  };
}

export function buildGenerationProjectTemplateWhere(
  where: Prisma.ProjectTemplateWhereInput = {},
): Prisma.ProjectTemplateWhereInput {
  return {
    AND: [
      where,
      ...RESERVED_TRAINING_TEMPLATE_NAME_TERMS.map((term) => ({
        NOT: { name: { contains: term } },
      })),
      {
        OR: [
          { description: null },
          { NOT: { description: { contains: RESERVED_TRAINING_TEMPLATE_DESCRIPTION } } },
        ],
      },
    ],
  };
}

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type PresetChangeDimension = "variants" | "content";
export type PresetGroupChangeDimension = "meta" | "members";

export type PresetHistoryEntry<Dimension extends string> = {
  id: string;
  dimension: Dimension;
  title: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

const HISTORY_LIMIT_PER_DIMENSION = 10;

const PRESET_DIMENSIONS: PresetChangeDimension[] = ["variants", "content"];
const GROUP_DIMENSIONS: PresetGroupChangeDimension[] = ["meta", "members"];

function cloneForJson(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value: unknown): string {
  return JSON.stringify(cloneForJson(value));
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return cloneForJson(value) as Prisma.InputJsonValue;
}

async function prunePresetHistory(presetId: string, dimension: PresetChangeDimension) {
  const stale = await prisma.presetChangeLog.findMany({
    where: { presetId, dimension },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: HISTORY_LIMIT_PER_DIMENSION,
    select: { id: true },
  });

  if (stale.length === 0) return;

  await prisma.presetChangeLog.deleteMany({
    where: { id: { in: stale.map((item) => item.id) } },
  });
}

async function prunePresetGroupHistory(groupId: string, dimension: PresetGroupChangeDimension) {
  const stale = await prisma.presetGroupChangeLog.findMany({
    where: { presetGroupId: groupId, dimension },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: HISTORY_LIMIT_PER_DIMENSION,
    select: { id: true },
  });

  if (stale.length === 0) return;

  await prisma.presetGroupChangeLog.deleteMany({
    where: { id: { in: stale.map((item) => item.id) } },
  });
}

export async function recordPresetChange(input: {
  presetId: string;
  dimension: PresetChangeDimension;
  title: string;
  before: unknown;
  after: unknown;
}) {
  if (stableStringify(input.before) === stableStringify(input.after)) return;

  await prisma.presetChangeLog.create({
    data: {
      presetId: input.presetId,
      dimension: input.dimension,
      title: input.title,
      before: toPrismaJson(input.before),
      after: toPrismaJson(input.after),
    },
  });

  await prunePresetHistory(input.presetId, input.dimension);
}

export async function recordPresetGroupChange(input: {
  groupId: string;
  dimension: PresetGroupChangeDimension;
  title: string;
  before: unknown;
  after: unknown;
}) {
  if (stableStringify(input.before) === stableStringify(input.after)) return;

  await prisma.presetGroupChangeLog.create({
    data: {
      presetGroupId: input.groupId,
      dimension: input.dimension,
      title: input.title,
      before: toPrismaJson(input.before),
      after: toPrismaJson(input.after),
    },
  });

  await prunePresetGroupHistory(input.groupId, input.dimension);
}

export function groupPresetHistory(
  entries: Array<{
    id: string;
    dimension: string;
    title: string;
    before: unknown;
    after: unknown;
    createdAt: Date;
  }>,
) {
  const history: Record<PresetChangeDimension, PresetHistoryEntry<PresetChangeDimension>[]> = {
    variants: [],
    content: [],
  };

  for (const entry of entries) {
    if (!PRESET_DIMENSIONS.includes(entry.dimension as PresetChangeDimension)) continue;
    history[entry.dimension as PresetChangeDimension].push({
      ...entry,
      dimension: entry.dimension as PresetChangeDimension,
      createdAt: entry.createdAt.toISOString(),
    });
  }

  return history;
}

export function groupPresetGroupHistory(
  entries: Array<{
    id: string;
    dimension: string;
    title: string;
    before: unknown;
    after: unknown;
    createdAt: Date;
  }>,
) {
  const history: Record<PresetGroupChangeDimension, PresetHistoryEntry<PresetGroupChangeDimension>[]> = {
    meta: [],
    members: [],
  };

  for (const entry of entries) {
    if (!GROUP_DIMENSIONS.includes(entry.dimension as PresetGroupChangeDimension)) continue;
    history[entry.dimension as PresetGroupChangeDimension].push({
      ...entry,
      dimension: entry.dimension as PresetGroupChangeDimension,
      createdAt: entry.createdAt.toISOString(),
    });
  }

  return history;
}

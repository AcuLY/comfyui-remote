import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export type SectionChangeDimension = "runParams" | "prompt" | "lora";

const HISTORY_LIMIT_PER_DIMENSION = 10;

const DIMENSIONS: SectionChangeDimension[] = ["runParams", "prompt", "lora"];

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

async function pruneSectionHistory(sectionId: string, dimension: SectionChangeDimension) {
  const stale = await prisma.sectionChangeLog.findMany({
    where: { projectSectionId: sectionId, dimension },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: HISTORY_LIMIT_PER_DIMENSION,
    select: { id: true },
  });

  if (stale.length === 0) return;

  await prisma.sectionChangeLog.deleteMany({
    where: { id: { in: stale.map((item) => item.id) } },
  });
}

export async function recordSectionChange(input: {
  sectionId: string;
  dimension: SectionChangeDimension;
  title: string;
  before: unknown;
  after: unknown;
}) {
  if (stableStringify(input.before) === stableStringify(input.after)) return;

  await prisma.sectionChangeLog.create({
    data: {
      projectSectionId: input.sectionId,
      dimension: input.dimension,
      title: input.title,
      before: toPrismaJson(input.before),
      after: toPrismaJson(input.after),
    },
  });

  await pruneSectionHistory(input.sectionId, input.dimension);
}

export async function getSectionChangeHistory(sectionId: string) {
  const entriesByDimension = await Promise.all(
    DIMENSIONS.map(async (dimension) => {
      const entries = await prisma.sectionChangeLog.findMany({
        where: { projectSectionId: sectionId, dimension },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: HISTORY_LIMIT_PER_DIMENSION,
        select: {
          id: true,
          dimension: true,
          title: true,
          before: true,
          after: true,
          createdAt: true,
        },
      });

      return [
        dimension,
        entries.map((entry) => ({
          ...entry,
          dimension: entry.dimension as SectionChangeDimension,
          createdAt: entry.createdAt.toISOString(),
        })),
      ] as const;
    }),
  );

  return Object.fromEntries(entriesByDimension) as Record<
    SectionChangeDimension,
    Array<{
      id: string;
      dimension: SectionChangeDimension;
      title: string;
      before: unknown;
      after: unknown;
      createdAt: string;
    }>
  >;
}

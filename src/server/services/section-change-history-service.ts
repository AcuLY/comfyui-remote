import { prisma } from "@/lib/prisma";
import { stableStringify, toPrismaJson } from "./change-history-utils";

export type SectionChangeDimension = "runParams" | "prompt" | "lora";

const HISTORY_LIMIT_PER_DIMENSION = 10;

const DIMENSIONS: SectionChangeDimension[] = ["runParams", "prompt", "lora"];

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

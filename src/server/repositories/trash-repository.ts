import type { Prisma } from "@/generated/prisma";
import { db } from "@/lib/db";
import { toImageUrl } from "@/lib/image-url";
import type { TrashItem, TrashPagination } from "@/lib/types";
import { buildGenerationProjectWhere } from "@/server/repositories/generation-resource-boundary";
import { formatDate } from "@/server/repositories/queue-data-repository";

type TrashRecordWithImage = Awaited<ReturnType<typeof getActiveTrashRecords>>[number];

const DEFAULT_TRASH_PAGE_SIZE = 48;
const MAX_TRASH_PAGE_SIZE = 96;

type TrashPageOptions = {
  page?: number;
  pageSize?: number;
};

export type TrashPage = {
  items: TrashItem[];
  pagination: TrashPagination;
};

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}

function normalizeTrashPageOptions(options: TrashPageOptions = {}) {
  return {
    page: normalizePositiveInteger(options.page, 1),
    pageSize: Math.min(
      normalizePositiveInteger(options.pageSize, DEFAULT_TRASH_PAGE_SIZE),
      MAX_TRASH_PAGE_SIZE,
    ),
  };
}

function serializeTrashRecord(record: TrashRecordWithImage): TrashItem {
  const { run } = record.imageResult;
  const sectionName =
    run.projectSection.name ??
    `小节 ${run.projectSection.sortOrder + 1}`;

  return {
    id: record.id,
    imageResultId: record.imageResultId,
    src: toImageUrl(record.imageResult.thumbPath ?? record.imageResult.filePath) ?? "",
    title: `${run.project.title} / ${sectionName}`,
    deletedAt: formatDate(record.deletedAt),
    originalPath: record.originalPath,
    projectId: run.project.id,
    projectTitle: run.project.title,
    sectionId: run.projectSection.id,
    sectionName,
    sectionSortOrder: run.projectSection.sortOrder,
  };
}

function buildActiveTrashWhere(where: Prisma.TrashRecordWhereInput = {}) {
  return {
    AND: [
      { restoredAt: null },
      { imageResult: { run: { project: buildGenerationProjectWhere() } } },
      where,
    ],
  } satisfies Prisma.TrashRecordWhereInput;
}

async function getActiveTrashRecords(
  where: Prisma.TrashRecordWhereInput = {},
  pagination?: { skip: number; take: number },
) {
  return db.trashRecord.findMany({
    where: buildActiveTrashWhere(where),
    orderBy: { deletedAt: "desc" },
    ...(pagination ? { skip: pagination.skip, take: pagination.take } : {}),
    include: {
      imageResult: {
        include: {
          run: {
            select: {
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
              projectSection: {
                select: {
                  id: true,
                  name: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function listTrashItems(options: TrashPageOptions = {}): Promise<TrashPage> {
  const { page, pageSize } = normalizeTrashPageOptions(options);
  const where = buildActiveTrashWhere();
  const totalItems = await db.trashRecord.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const records = await getActiveTrashRecords({}, {
    skip: startIndex,
    take: pageSize,
  });

  return {
    items: records.map(serializeTrashRecord),
    pagination: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
      startItem: totalItems === 0 ? 0 : startIndex + 1,
      endItem: Math.min(startIndex + pageSize, totalItems),
    },
  };
}

export async function listSectionTrashItems(sectionId: string): Promise<TrashItem[]> {
  const section = await db.projectSection.findFirst({
    where: {
      id: sectionId,
      project: buildGenerationProjectWhere(),
    },
    select: { id: true },
  });

  if (!section) {
    throw new Error("SECTION_NOT_FOUND");
  }

  const records = await getActiveTrashRecords({
    imageResult: {
      run: {
        projectSectionId: sectionId,
      },
    },
  });

  return records.map(serializeTrashRecord);
}

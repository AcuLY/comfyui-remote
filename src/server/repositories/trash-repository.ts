import { db } from "@/lib/db";
import { toImageUrl } from "@/lib/image-url";
import type { TrashItem } from "@/lib/types";
import { formatDate } from "@/server/repositories/queue-data-repository";

type TrashRecordWithImage = Awaited<ReturnType<typeof getActiveTrashRecords>>[number];

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

async function getActiveTrashRecords(where: {
  imageResult?: {
    run?: {
      projectSectionId?: string;
    };
  };
} = {}) {
  return db.trashRecord.findMany({
    where: {
      restoredAt: null,
      ...where,
    },
    orderBy: { deletedAt: "desc" },
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

export async function listTrashItems(): Promise<TrashItem[]> {
  const records = await getActiveTrashRecords();
  return records.map(serializeTrashRecord);
}

export async function listSectionTrashItems(sectionId: string): Promise<TrashItem[]> {
  const section = await db.projectSection.findUnique({
    where: { id: sectionId },
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

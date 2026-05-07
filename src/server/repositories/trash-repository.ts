import { db } from "@/lib/db";
import { toImageUrl } from "@/lib/image-url";
import type { TrashItem } from "@/lib/types";
import { formatDate } from "@/server/repositories/queue-data-repository";

export async function listSectionTrashItems(sectionId: string): Promise<TrashItem[]> {
  const section = await db.projectSection.findUnique({
    where: { id: sectionId },
    select: { id: true },
  });

  if (!section) {
    throw new Error("SECTION_NOT_FOUND");
  }

  const records = await db.trashRecord.findMany({
    where: {
      restoredAt: null,
      imageResult: {
        run: {
          projectSectionId: sectionId,
        },
      },
    },
    orderBy: { deletedAt: "desc" },
    include: {
      imageResult: {
        include: {
          run: {
            include: {
              project: true,
              projectSection: true,
            },
          },
        },
      },
    },
  });

  return records.map((record) => {
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
  });
}

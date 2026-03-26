import { db } from "@/lib/db";
import { toImageUrl } from "@/lib/image-url";

export async function listTrashItems() {
  const records = await db.trashRecord.findMany({
    where: { restoredAt: null },
    orderBy: { deletedAt: "desc" },
    include: {
      imageResult: true,
    },
    take: 100,
  });

  return records.map((record) => ({
    id: record.id,
    imageResultId: record.imageResultId,
    deletedAt: record.deletedAt,
    originalPath: record.originalPath,
    trashPath: record.trashPath,
    previewPath: toImageUrl(record.imageResult.thumbPath ?? record.imageResult.filePath) ?? "",
  }));
}

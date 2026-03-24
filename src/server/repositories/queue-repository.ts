import { db } from "@/lib/db";

export async function listQueueRuns() {
  const runs = await db.positionRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      completeJob: { include: { character: true } },
      completeJobPosition: { include: { positionTemplate: true } },
      images: true,
    },
    take: 50,
  });

  return runs.map((run) => ({
    id: run.id,
    characterName: run.completeJob.character.name,
    jobTitle: run.completeJob.title,
    positionName: run.completeJobPosition.positionTemplate?.name ?? "Unknown",
    createdAt: run.createdAt,
    pendingCount: run.images.filter((image) => image.reviewStatus === "pending").length,
    totalCount: run.images.length,
    status: run.status,
  }));
}

import { db } from "@/lib/db";

export async function listJobs() {
  const jobs = await db.completeJob.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      character: true,
      scenePreset: true,
      stylePreset: true,
      positions: true,
    },
    take: 50,
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    updatedAt: job.updatedAt,
    characterName: job.character.name,
    sceneName: job.scenePreset?.name ?? "未设置",
    styleName: job.stylePreset?.name ?? "未设置",
    positionCount: job.positions.length,
  }));
}

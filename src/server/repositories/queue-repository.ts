import { db } from "@/lib/db";

type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;

export async function listQueueRuns() {
  const runs = await db.positionRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      completeJob: {
        select: { id: true, title: true, presetBindings: true },
      },
      completeJobPosition: { include: { positionTemplate: true } },
      images: true,
    },
    take: 50,
  });

  // Batch resolve preset names for characterName
  const allPresetIds = new Set<string>();
  for (const run of runs) {
    const bindings = run.completeJob.presetBindings as PresetBindingJson | null;
    if (bindings) for (const b of bindings) allPresetIds.add(b.presetId);
  }

  const presetMap = new Map<string, { name: string; categorySlug: string }>();
  if (allPresetIds.size > 0) {
    const presets = await db.promptPreset.findMany({
      where: { id: { in: [...allPresetIds] } },
      select: { id: true, name: true, category: { select: { slug: true } } },
    });
    for (const p of presets) presetMap.set(p.id, { name: p.name, categorySlug: p.category.slug });
  }

  return runs.map((run) => {
    const bindings = run.completeJob.presetBindings as PresetBindingJson | null;
    let characterName = "—";
    if (bindings) {
      for (const b of bindings) {
        const preset = presetMap.get(b.presetId);
        if (preset?.categorySlug === "character") { characterName = preset.name; break; }
      }
    }
    return {
      id: run.id,
      characterName,
      jobTitle: run.completeJob.title,
      positionName: run.completeJobPosition.positionTemplate?.name ?? "Unknown",
      createdAt: run.createdAt,
      pendingCount: run.images.filter((image) => image.reviewStatus === "pending").length,
      totalCount: run.images.length,
      status: run.status,
    };
  });
}

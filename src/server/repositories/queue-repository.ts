import { db } from "@/lib/db";

type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;

export async function listQueueRuns() {
  const runs = await db.positionRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { id: true, title: true, presetBindings: true },
      },
      projectSection: true,
      images: true,
    },
    take: 50,
  });

  // Batch resolve preset names
  const allPresetIds = new Set<string>();
  for (const run of runs) {
    const bindings = run.project.presetBindings as PresetBindingJson | null;
    if (bindings) for (const b of bindings) allPresetIds.add(b.presetId);
  }

  const presetMap = new Map<string, { name: string }>();
  if (allPresetIds.size > 0) {
    const presets = await db.preset.findMany({
      where: { id: { in: [...allPresetIds] } },
      select: { id: true, name: true },
    });
    for (const p of presets) presetMap.set(p.id, { name: p.name });
  }

  return runs.map((run) => {
    const bindings = run.project.presetBindings as PresetBindingJson | null;
    const presetNames: string[] = [];
    if (bindings) {
      for (const b of bindings) {
        const preset = presetMap.get(b.presetId);
        if (preset) presetNames.push(preset.name);
      }
    }
    return {
      id: run.id,
      presetNames,
      projectTitle: run.project.title,
      sectionName: run.projectSection.name ?? "Unknown",
      createdAt: run.createdAt,
      pendingCount: run.images.filter((image) => image.reviewStatus === "pending").length,
      totalCount: run.images.length,
      status: run.status,
    };
  });
}

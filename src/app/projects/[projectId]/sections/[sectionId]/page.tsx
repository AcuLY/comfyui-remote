import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionEditor } from "@/components/section-editor";
import { SectionParamsForm } from "./section-params-form";
import { SectionNameEditor } from "./section-name-editor";
import { SectionRunButton } from "@/app/projects/[projectId]/project-detail-actions";
import type { PromptBlockData } from "@/lib/actions";
import { getPresetLibraryV2 } from "@/lib/server-data";
import { parseSectionLoraConfig, serializeSectionLoraConfig, generateLoraEntryId, parseLoraBindings } from "@/lib/lora-types";
import type { LoraEntry } from "@/lib/lora-types";
import { revalidatePath } from "next/cache";
import { getSectionChangeHistory } from "@/server/services/section-change-history-service";
import { SectionChangeHistory } from "./section-change-history";
import { SectionSwitchHeaderLink, SectionSwitchScrollRestorer } from "./section-switch-navigation";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ projectId: string; sectionId: string }>;
}) {
  const { projectId, sectionId } = await params;

  const [pos, libraryV2, siblingSections] = await Promise.all([
    prisma.projectSection.findUnique({
      where: { id: sectionId },
      include: {
        project: {
          select: {
            presetBindings: true,
            checkpointName: true,
          },
        },
        promptBlocks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            type: true,
            sourceId: true,
            variantId: true,
            categoryId: true,
            bindingId: true,
            groupBindingId: true,
            label: true,
            positive: true,
            negative: true,
            sortOrder: true,
          },
        },
      },
    }),
    getPresetLibraryV2(),
    prisma.projectSection.findMany({
      where: { projectId },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    }),
  ]);

  if (!pos || pos.projectId !== projectId) {
    notFound();
  }

  const sectionIdx = siblingSections.findIndex((s) => s.id === sectionId);
  const prevSection = sectionIdx > 0 ? siblingSections[sectionIdx - 1] : null;
  const nextSection = sectionIdx < siblingSections.length - 1 ? siblingSections[sectionIdx + 1] : null;

  const sectionName =
    pos.name || `小节 ${pos.sortOrder}`;

  const initialBlocks: PromptBlockData[] = pos.promptBlocks.map((b) => ({
    id: b.id,
    type: b.type,
    sourceId: b.sourceId,
    variantId: b.variantId,
    categoryId: b.categoryId,
    bindingId: b.bindingId,
    groupBindingId: b.groupBindingId,
    label: b.label,
    positive: b.positive,
    negative: b.negative,
    sortOrder: b.sortOrder,
  }));

  const sectionParams = {
    batchSize: pos.batchSize ?? null,
    aspectRatio: pos.aspectRatio ?? null,
    shortSidePx: pos.shortSidePx ?? null,
    // v0.3: dual seedPolicy
    seedPolicy1: pos.seedPolicy1 ?? null,
    seedPolicy2: pos.seedPolicy2 ?? null,
    // v0.3: ksampler params
    ksampler1: pos.ksampler1 ?? null,
    ksampler2: pos.ksampler2 ?? null,
    upscaleFactor: pos.upscaleFactor ?? null,
    checkpointName: pos.checkpointName ?? null,
    projectCheckpointName: pos.project.checkpointName ?? null,
  };

  // Parse existing LoRA config ({ lora1, lora2 })
  const loraConfig = parseSectionLoraConfig(pos.loraConfig);

  // Unified: ALL presets' lora1 → section.lora1, lora2 → section.lora2
  if (pos.project) {
    let loraChanged = false;

    type PresetBindingJson = Array<{ categoryId: string; presetId: string }>;
    const bindings = pos.project.presetBindings as PresetBindingJson | null;
    if (bindings && bindings.length > 0) {
      const presetIds = bindings.map((b) => b.presetId);
      const variants = await prisma.presetVariant.findMany({
        where: { presetId: { in: presetIds } },
        select: {
          id: true, name: true, presetId: true, lora1: true, lora2: true,
          preset: {
            select: {
              name: true,
              category: { select: { name: true, color: true } },
            },
          },
        },
      });

      // Build a lookup: presetId → bindingId from the section's prompt blocks
      const blockBindingMap = new Map<string, string>();
      for (const block of pos.promptBlocks) {
        if (block.sourceId && block.bindingId) {
          blockBindingMap.set(block.sourceId, block.bindingId);
        }
      }

      // Build a lookup: presetId → { categoryName, presetName, lora paths }
      // so we can backfill bindingId on existing entries that lack one
      const presetLoraPathMap = new Map<string, Set<string>>();
      for (const variant of variants) {
        const paths = presetLoraPathMap.get(variant.presetId) ?? new Set<string>();
        if (variant.lora1) {
          for (const b of parseLoraBindings(variant.lora1)) {
            if (b.path) paths.add(b.path);
          }
        }
        if (variant.lora2) {
          for (const b of parseLoraBindings(variant.lora2)) {
            if (b.path) paths.add(b.path);
          }
        }
        presetLoraPathMap.set(variant.presetId, paths);
      }

      for (const variant of variants) {
        const categoryName = variant.preset.category.name;
        const categoryColor = variant.preset.category.color;
        const presetName = variant.preset.name;
        const bindingId = blockBindingMap.get(variant.presetId);
        if (variant.lora1) {
          const lora1Bindings = parseLoraBindings(variant.lora1);
          for (const binding of lora1Bindings) {
            if (!binding.path) continue;
            const exists = loraConfig.lora1.some((e) => e.path === binding.path);
            if (!exists) {
              loraConfig.lora1.push({
                id: generateLoraEntryId(),
                path: binding.path,
                weight: binding.weight,
                enabled: binding.enabled,
                source: "preset",
                sourceLabel: categoryName,
                sourceColor: categoryColor ?? undefined,
                sourceName: presetName,
                bindingId,
              });
              loraChanged = true;
            }
          }
        }
        if (variant.lora2) {
          const lora2Bindings = parseLoraBindings(variant.lora2);
          for (const binding of lora2Bindings) {
            if (!binding.path) continue;
            const exists = loraConfig.lora2.some((e) => e.path === binding.path);
            if (!exists) {
              loraConfig.lora2.push({
                id: generateLoraEntryId(),
                path: binding.path,
                weight: binding.weight,
                enabled: binding.enabled,
                source: "preset",
                sourceLabel: categoryName,
                sourceColor: categoryColor ?? undefined,
                sourceName: presetName,
                bindingId,
              });
              loraChanged = true;
            }
          }
        }
      }

      // Backfill: add bindingId to existing entries that are missing one
      // by matching their path + sourceName against known presets
      for (const [presetId, paths] of presetLoraPathMap) {
        const bindingId = blockBindingMap.get(presetId);
        if (!bindingId) continue;
        for (const entry of loraConfig.lora1) {
          if (!entry.bindingId && entry.source === "preset" && paths.has(entry.path)) {
            entry.bindingId = bindingId;
            loraChanged = true;
          }
        }
        for (const entry of loraConfig.lora2) {
          if (!entry.bindingId && entry.source === "preset" && paths.has(entry.path)) {
            entry.bindingId = bindingId;
            loraChanged = true;
          }
        }
      }
    }

    if (loraChanged) {
      await prisma.projectSection.update({
        where: { id: sectionId },
        data: {
          loraConfig: serializeSectionLoraConfig(loraConfig),
        },
      });
    }
  }

  // Server action to save LoRA config (2-partition: lora1, lora2)
  async function handleLoraChange(config: { lora1: LoraEntry[]; lora2: LoraEntry[] }) {
    "use server";
    const { prisma } = await import("@/lib/prisma");
    const { serializeSectionLoraConfig } = await import("@/lib/lora-types");
    const { recordSectionChange } = await import("@/server/services/section-change-history-service");
    const before = await prisma.projectSection.findUnique({
      where: { id: sectionId },
      select: { loraConfig: true },
    });
    const nextConfig = serializeSectionLoraConfig(config);

    await prisma.projectSection.update({
      where: { id: sectionId },
      data: {
        loraConfig: nextConfig,
      },
    });
    await recordSectionChange({
      sectionId,
      dimension: "lora",
      title: "更新 LoRA 配置",
      before: before?.loraConfig ?? null,
      after: nextConfig,
    });

    revalidatePath(`/projects/${projectId}/sections/${sectionId}`);
  }

  const changeHistory = await getSectionChangeHistory(sectionId);

  return (
    <div className="-mx-5 -mt-4 min-h-[calc(100dvh-5rem)] bg-[var(--panel)] px-5 pt-4 sm:-mx-6 sm:px-6">
      <SectionSwitchScrollRestorer projectId={projectId} sectionId={sectionId} />
      <div className="min-w-0 space-y-4">
        <div className="sticky top-0 z-20 -mx-5 -mt-4 border-b border-white/[0.08] bg-[var(--panel)]/95 px-5 pb-3 pt-4 shadow-[0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/projects/${projectId}#section-${sectionId}`}
                scroll={false}
                className="inline-flex items-center gap-2 text-sm text-zinc-300"
              >
                <ArrowLeft className="size-4" /> 返回
              </Link>
              <div className="flex min-w-0 items-center gap-1.5">
                {prevSection ? (
                  <SectionSwitchHeaderLink
                    projectId={projectId}
                    href={`/projects/${projectId}/sections/${prevSection.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <ChevronLeft className="size-3" /> 上一节
                  </SectionSwitchHeaderLink>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-2 py-1 text-xs text-zinc-600">
                    <ChevronLeft className="size-3" /> 上一节
                  </span>
                )}
                {nextSection ? (
                  <SectionSwitchHeaderLink
                    projectId={projectId}
                    href={`/projects/${projectId}/sections/${nextSection.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    下一节 <ChevronRight className="size-3" />
                  </SectionSwitchHeaderLink>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/5 px-2 py-1 text-xs text-zinc-600">
                    下一节 <ChevronRight className="size-3" />
                  </span>
                )}
                <Link
                  href={`/api/projects/${projectId}/section-workflow/${sectionId}`}
                  download
                  className="inline-flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/[0.08] px-2 py-1 text-xs text-sky-200 transition hover:bg-sky-500/15 hover:text-sky-100"
                >
                  <Download className="size-3" /> 下载 workflow
                </Link>
                <Link
                  href={`/projects/${projectId}/sections/${sectionId}/results`}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ImageIcon className="size-3" /> 查看结果
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <SectionNameEditor sectionId={sectionId} initialName={sectionName} />
              </div>
              <div className="w-full sm:w-auto">
                <SectionRunButton projectId={projectId} sectionId={sectionId} defaultBatchSize={sectionParams.batchSize} showBatchOverride={false} />
              </div>
            </div>
          </div>
        </div>

        <section className="w-full min-w-0">
          <div className="space-y-6">
            <div id="section-params" className="scroll-mt-24">
              <SectionParamsForm
                projectId={projectId}
                sectionId={sectionId}
                initialParams={sectionParams}
              />
            </div>
            <div className="border-t border-white/5 pt-4">
              <SectionEditor
                sectionId={sectionId}
                initialBlocks={initialBlocks}
                initialLoraConfig={loraConfig}
                libraryV2={libraryV2}
                onLoraChange={handleLoraChange}
                onRename={async (name: string) => {
                  "use server";
                  const { renameSection } = await import("@/lib/actions");
                  await renameSection(sectionId, name);
                }}
              />
            </div>
          </div>
        </section>
        <div id="section-history" className="scroll-mt-24">
          <SectionChangeHistory history={changeHistory} />
        </div>
      </div>
    </div>
  );
}

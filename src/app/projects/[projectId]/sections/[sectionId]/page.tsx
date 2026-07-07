import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { WorkflowDownloadMenu } from "@/components/workflow-download-menu";
import { buildFolderScopedItemOrder, hrefWithFolderQuery } from "@/lib/folder-navigation";
import { toImageUrl } from "@/lib/image-url";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { SectionEditor } from "@/components/section-editor";
import { SectionParamsForm } from "./section-params-form";
import { SectionNameEditor } from "./section-name-editor";
import { SectionRunButton } from "@/app/projects/[projectId]/project-detail-actions";
import type { PromptBlockData } from "@/lib/actions/prompt-block";
import { getProjectSectionEditPageData } from "@/lib/server-data";
import type { SectionLoraConfig } from "@/lib/lora-types";
import { SectionChangeHistory } from "./section-change-history";
import { SectionSwitchHeaderLink, SectionSwitchScrollRestorer, SectionKeyboardShortcuts } from "./section-switch-navigation";
import { saveSectionLoraConfigAction } from "./actions";

const RESOLVED_ONLY_BLOCK_ID_PREFIX = "resolved:";

export default async function SectionEditPage({
  params,
}: {
  params: Promise<{ projectId: string; sectionId: string }>;
}) {
  const { projectId, sectionId } = await params;

  const sectionEditData = await getProjectSectionEditPageData(projectId, sectionId);

  if (!sectionEditData) {
    notFound();
  }

  const { section: pos, resolvedConfig, siblingFolders, siblingSections, libraryV2, changeHistory } = sectionEditData;
  const orderedSiblingSections = buildFolderScopedItemOrder(siblingFolders, siblingSections);
  const sectionIdx = orderedSiblingSections.findIndex((s) => s.id === sectionId);
  const prevSection = sectionIdx > 0 ? orderedSiblingSections[sectionIdx - 1] : null;
  const nextSection =
    sectionIdx >= 0 && sectionIdx < orderedSiblingSections.length - 1
      ? orderedSiblingSections[sectionIdx + 1]
      : null;
  const returnHref = hrefWithFolderQuery(
    `/projects/${projectId}`,
    "sectionFolder",
    pos.folderId,
    `section-${sectionId}`,
  );

  const sectionName =
    pos.name || `小节 ${pos.sortOrder}`;
  const latestRun = pos.runs[0] ?? null;
  const latestResultImages = (latestRun?.images ?? []).map((img) => ({
    id: img.id,
    src: toImageUrl(img.thumbPath ?? img.filePath) ?? "",
    status: img.reviewStatus,
  }));

    const readResolvedStringParam = (key: string) => {
      const value = resolvedConfig?.parameters[key];
      return typeof value === "string" ? value : null;
    };
    const readResolvedStringArrayParam = (key: string) => {
      const value = resolvedConfig?.parameters[key];
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : null;
    };
  const readResolvedIntegerParam = (key: string) => {
    const value = resolvedConfig?.parameters[key];
    return typeof value === "number" && Number.isInteger(value) ? value : null;
  };
  const readResolvedNumberParam = (key: string) => {
    const value = resolvedConfig?.parameters[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const readResolvedBooleanParam = (key: string) => {
    const value = resolvedConfig?.parameters[key];
    return typeof value === "boolean" ? value : null;
  };

  const resolvedPromptBlocks = resolvedConfig?.promptBlocks ?? [];
  const usedResolvedBlockIndexes = new Set<number>();

  const initialBlocksFromRows: PromptBlockData[] = pos.sectionPromptBlocks.flatMap((b, index) => {
    const bindingKey = b.sectionBinding?.bindingKey ?? null;
    if (b.sectionBinding?.presetGroupId && !b.sectionBinding.presetId) return [];
    const bindingMatchedIndex = bindingKey
      ? resolvedPromptBlocks.findIndex((block) => block.bindingId === bindingKey)
      : -1;
    const identityMatchedIndex = resolvedPromptBlocks.findIndex((block, blockIndex) =>
      !usedResolvedBlockIndexes.has(blockIndex) &&
        block.sortOrder === b.sortOrder &&
        block.type === b.type &&
        block.positive === (b.customPositive ?? ""),
    );
    const indexMatchedIndex = usedResolvedBlockIndexes.has(index) ? -1 : index;
    const resolvedBlockIndex =
      bindingMatchedIndex >= 0
        ? bindingMatchedIndex
        : identityMatchedIndex >= 0
          ? identityMatchedIndex
          : indexMatchedIndex >= 0 && indexMatchedIndex < resolvedPromptBlocks.length
            ? indexMatchedIndex
            : -1;
    const resolvedBlock = resolvedBlockIndex >= 0 ? resolvedPromptBlocks[resolvedBlockIndex] : null;
    if (resolvedBlockIndex >= 0) usedResolvedBlockIndexes.add(resolvedBlockIndex);

    return [{
      id: b.id,
      type: resolvedBlock ? resolvedBlock.type : b.type,
      sourceId: resolvedBlock?.sourceId ?? null,
      variantId: resolvedBlock?.variantId ?? null,
      presetGroupId: resolvedBlock?.presetGroupId ?? null,
      categoryId: resolvedBlock?.categoryId ?? null,
      bindingId: resolvedBlock?.bindingId ?? bindingKey,
      groupBindingId: resolvedBlock?.groupBindingId ?? null,
      label: resolvedBlock?.label ?? b.customLabel ?? "Custom",
      positive: resolvedBlock?.positive ?? b.customPositive ?? "",
      negative: resolvedBlock?.negative ?? b.customNegative ?? null,
      sortOrder: resolvedBlockIndex >= 0 ? resolvedBlockIndex : b.sortOrder,
    }];
  });
  const resolverOnlyBlocks: PromptBlockData[] = resolvedPromptBlocks
    .map((block, index) => ({ block, index }))
    .filter(({ index }) => !usedResolvedBlockIndexes.has(index))
    .map(({ block, index }) => ({
      id: `${RESOLVED_ONLY_BLOCK_ID_PREFIX}${block.bindingId ?? block.sourceId ?? "block"}:${index}`,
      type: block.type,
      sourceId: block.sourceId,
      variantId: block.variantId,
      presetGroupId: block.presetGroupId ?? null,
      categoryId: block.categoryId,
      bindingId: block.bindingId,
      groupBindingId: block.groupBindingId,
      label: block.label,
      positive: block.positive,
      negative: block.negative,
      sortOrder: index,
    }));
  const initialBlocks = [...initialBlocksFromRows, ...resolverOnlyBlocks]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  const sectionParams = resolvedConfig
    ? {
          batchSize: readResolvedIntegerParam("batchSize"),
          aspectRatio: readResolvedStringParam("aspectRatio"),
          aspectRatios: readResolvedStringArrayParam("aspectRatios"),
          shortSidePx: readResolvedIntegerParam("shortSidePx"),
        seedPolicy1: readResolvedStringParam("seedPolicy1"),
        seedPolicy2: readResolvedStringParam("seedPolicy2"),
        ksampler1: resolvedConfig.ksampler1 ?? null,
        ksampler2: resolvedConfig.ksampler2 ?? null,
        upscaleFactor: readResolvedNumberParam("upscaleFactor"),
        useTwoStageKSampler: readResolvedBooleanParam("useTwoStageKSampler"),
        checkpointName: pos.checkpointName ?? null,
        projectCheckpointName: readResolvedStringParam("checkpointName"),
      }
    : {
          batchSize: pos.batchSize ?? null,
          aspectRatio: pos.aspectRatio ?? null,
          aspectRatios: Array.isArray(pos.aspectRatios)
            ? pos.aspectRatios.filter((item): item is string => typeof item === "string")
            : null,
          shortSidePx: pos.shortSidePx ?? null,
        seedPolicy1: pos.seedPolicy1 ?? null,
        seedPolicy2: pos.seedPolicy2 ?? null,
        ksampler1: pos.ksampler1 ?? null,
        ksampler2: pos.ksampler2 ?? null,
        upscaleFactor: pos.upscaleFactor ?? null,
        useTwoStageKSampler: pos.useTwoStageKSampler ?? true,
        checkpointName: pos.checkpointName ?? null,
        projectCheckpointName: pos.project.checkpointName ?? null,
      };

  const loraConfig = resolvedConfig?.loraConfig ?? { lora1: [], lora2: [] };

  // Server action to save LoRA config (2-partition: lora1, lora2)
  async function handleLoraChange(config: SectionLoraConfig) {
    "use server";
    await saveSectionLoraConfigAction(projectId, sectionId, config);
  }

  return (
    <div className="-mx-5 -mt-4 min-h-[calc(100dvh-5rem)] bg-[var(--panel)] px-5 pt-4 sm:-mx-6 sm:px-6">
      <SectionSwitchScrollRestorer projectId={projectId} sectionId={sectionId} />
      <SectionKeyboardShortcuts
        projectId={projectId}
        sectionId={sectionId}
        prevSectionId={prevSection?.id ?? null}
        nextSectionId={nextSection?.id ?? null}
      />
      <div className="min-w-0 space-y-4">
        <div className="sticky top-0 z-20 -mx-5 -mt-4 border-b border-white/[0.08] bg-[var(--panel)]/95 px-5 pb-3 pt-4 shadow-[0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <HardNavigationLink
                href={returnHref}
                className="inline-flex items-center gap-2 text-sm text-zinc-300"
              >
                <ArrowLeft className="size-4" /> 返回
              </HardNavigationLink>
              <NeighborNavigation
                previousHref={prevSection ? `/projects/${projectId}/sections/${prevSection.id}` : null}
                nextHref={nextSection ? `/projects/${projectId}/sections/${nextSection.id}` : null}
                previousLabel="上一节"
                nextLabel="下一节"
                renderLink={({ href, className, children }) => (
                  <SectionSwitchHeaderLink
                    projectId={projectId}
                    href={href}
                    className={className}
                  >
                    {children}
                  </SectionSwitchHeaderLink>
                )}
              />
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

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
            <ImageIcon className="size-3.5" />
            <span>
              最近结果
              {latestRun ? ` · Run #${latestRun.runIndex} · ${latestRun._count.images} 张` : ""}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {latestRun && (
                <HardNavigationLink
                  href={`/projects/${projectId}/sections/${sectionId}/results`}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <ImageIcon className="size-3" /> 查看全部
                </HardNavigationLink>
              )}
              <WorkflowDownloadMenu
                originalHref={`/api/projects/${projectId}/section-workflow/${sectionId}`}
                debugHref={`/api/projects/${projectId}/section-workflow/${sectionId}`}
                label="下载 workflow"
                buttonClassName="rounded-lg border border-sky-500/20 bg-sky-500/[0.08] px-2 py-1 text-xs text-sky-200 transition hover:bg-sky-500/15 hover:text-sky-100"
              />
            </div>
          </div>
          {latestResultImages.length > 0 ? (
            <div className="flex h-24 gap-1.5 overflow-x-auto scrollbar-none sm:h-28">
              {latestResultImages.map((img) => (
                <HardNavigationLink
                  key={img.id}
                  href={`/projects/${projectId}/sections/${sectionId}/results`}
                  className={`relative h-full w-20 shrink-0 overflow-hidden rounded-lg border bg-[var(--panel-soft)] transition hover:border-sky-500/40 sm:w-24 ${
                    img.status === "kept"
                      ? "border-emerald-500/30"
                      : img.status === "trashed"
                        ? "border-rose-500/20 opacity-45"
                        : "border-white/10"
                  }`}
                >
                  <Image
                    src={img.src}
                    alt=""
                    width={96}
                    height={112}
                    loading="lazy"
                    unoptimized
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                </HardNavigationLink>
              ))}
              {(latestRun?._count.images ?? 0) > latestResultImages.length && (
                <HardNavigationLink
                  href={`/projects/${projectId}/sections/${sectionId}/results`}
                  className="flex h-full w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs text-zinc-400 transition hover:border-sky-500/30 hover:text-zinc-200"
                >
                  +{(latestRun?._count.images ?? 0) - latestResultImages.length}
                </HardNavigationLink>
              )}
            </div>
          ) : (
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] text-xs text-zinc-600">
              暂无最近结果
            </div>
          )}
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
                  const { renameSection } = await import("@/lib/actions/section");
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

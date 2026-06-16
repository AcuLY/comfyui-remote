import type {
  LoraTrainingDatasetRevision,
  LoraTrainingDatasetRevisionItem,
  LoraTrainingData,
  LoraTrainingImageResult,
  LoraTrainingPreset,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingRun,
  LoraTrainingSection,
  LoraTrainingTemplate,
  TrainingImage,
  TrainingImageStatus,
} from "@/features/training/types";
import { toImageUrl } from "@/lib/image-url";
import { listTrainingSceneDescriptionPresetRows } from "@/server/repositories/training/scene-description-presets";
import {
  getTrainingGenerationRun,
  getTrainingProjectOverview,
  listTrainingCandidateImages,
  listTrainingDatasetRevisions,
  listTrainingProjectSections,
  listTrainingPromptCardVersions,
  listTrainingProductionProjects,
  listTrainingReferenceImages,
  listTrainingRuns,
} from "@/server/repositories/training/snapshot";
import { listTrainingTemplateRows } from "@/server/repositories/training/templates";

function formatTimestamp(value: string | Date | null | undefined, prefix: "完成于" | "开始于" | "创建于" | "失败于" = "创建于") {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${hh}:${mm}`;
}

function formatUpdatedAt(value: string | Date | null | undefined) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapReviewStatusToImageStatus(reviewStatus: string): TrainingImageStatus {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "trashed";
  return "pending";
}

function mapReviewStatus(reviewStatus: string): LoraTrainingImageResult["reviewStatus"] {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "rejected";
  return "pending";
}

function mapTrainingScenePreset(row: Awaited<ReturnType<typeof listTrainingSceneDescriptionPresetRows>>[number]): LoraTrainingPreset {
  return {
    id: row.id,
    title: row.name,
    category: row.category.name,
    folder: row.folder?.name ?? "未归档",
    status: row.isActive ? "active" : "inactive",
    updatedAt: formatUpdatedAt(row.updatedAt),
    sceneDescriptionText: row.sceneDescriptionText,
    projectUsage: [],
    templateUsage: [],
  };
}

function mapTrainingTemplate(row: Awaited<ReturnType<typeof listTrainingTemplateRows>>[number]): LoraTrainingTemplate {
  return {
    id: row.id,
    title: row.name,
    status: row.isActive ? "active" : "archived",
    updatedAt: formatUpdatedAt(row.updatedAt),
    description: row.description ?? "",
    imageGuidance: row.imagePromptGuidance,
    captionGuidance: row.captioningGuidance,
    sectionCount: row.sections.length,
    sections: row.sections.map((section) => {
      const blocks = section.blocks
        .filter((block) => block.enabled)
        .map((block) => ({
          id: block.id,
          source: block.sourceType === "preset" ? "预制" as const : "本地" as const,
          title: block.title,
          text: block.localText ?? block.title,
        }));
      const resolvedScene = blocks.map((block) => block.text).filter(Boolean).join("\n\n") || section.name || "未填写场景描述";

      return {
        id: section.id,
        title: section.name ?? "未命名小节",
        enabled: section.enabled,
        blockCount: blocks.length,
        blocks,
        resolvedScene,
        scenePreview: blocks[0]?.text ?? section.name ?? "未填写场景摘要",
      };
    }),
  };
}

function mapProjectStatus(input: {
  archived?: boolean;
  latestTrainingStatus?: string | null;
  missingItems?: Array<{ blocking?: boolean }> | null;
}): LoraTrainingProject["status"] {
  if (input.archived) return "archived";
  if (input.latestTrainingStatus === "queued" || input.latestTrainingStatus === "running") return "training";
  if (input.missingItems?.some((item) => item.blocking)) return "draft";
  return "ready";
}

function buildTrainingImage(relativePath: string, label: string, status: TrainingImageStatus, index: number): TrainingImage | null {
  const url = toImageUrl(relativePath);
  if (!url) return null;
  return {
    id: `${relativePath}-${index}`,
    src: url,
    full: url,
    label,
    status,
    featured: index === 0,
    featured2: false,
    cover: index === 0,
    width: null,
    height: null,
  };
}

function buildReferenceImages(sourceImages: Awaited<ReturnType<typeof listTrainingReferenceImages>>): LoraTrainingReferenceImage[] {
  return sourceImages
    .map((image, index) => {
      const trainingImage = buildTrainingImage(image.relativePath, String(index + 1).padStart(2, "0"), "pending", index);
      if (!trainingImage) return null;
      const provenance = image.provenance && typeof image.provenance === "object" && !Array.isArray(image.provenance)
        ? image.provenance as Record<string, unknown>
        : null;
      const provenanceKind = typeof provenance?.kind === "string" ? provenance.kind : null;
      const provenanceLabel = typeof provenance?.label === "string" && provenance.label.trim() ? provenance.label.trim() : null;
      const provenanceNote = typeof provenance?.note === "string" && provenance.note.trim() ? provenance.note.trim() : null;
      return {
        id: image.id,
        kind: provenanceKind === "original" || provenanceKind === "generated" || provenanceKind === "auxiliary"
          ? provenanceKind
          : index === 0 ? "original" : "auxiliary",
        label: provenanceLabel ?? `参考图 ${index + 1}`,
        note: provenanceNote ?? image.role,
        image: trainingImage,
      } satisfies LoraTrainingReferenceImage;
    })
    .filter((image): image is LoraTrainingReferenceImage => Boolean(image));
}

function buildResultPool(input: {
  candidateImages: Awaited<ReturnType<typeof listTrainingCandidateImages>>;
  sectionNames: Map<string, string>;
}): LoraTrainingImageResult[] {
  return input.candidateImages
    .map((image, index) => {
      const trainingImage = buildTrainingImage(image.relativePath, String(index + 1).padStart(2, "0"), mapReviewStatusToImageStatus(image.reviewStatus), index);
      if (!trainingImage) return null;
      const sectionTitle = image.sectionId ? input.sectionNames.get(image.sectionId) ?? "训练小节" : "未分组";
      return {
        id: image.id,
        sectionId: image.sectionId ?? "ungrouped",
        sectionTitle,
        image: trainingImage,
        reviewStatus: mapReviewStatus(image.reviewStatus),
        caption: image.captionDraft ?? "未填写说明文本",
        sourceLabel: `${sectionTitle} · ${String(index + 1).padStart(2, "0")}`,
      } satisfies LoraTrainingImageResult;
    })
    .filter((image): image is LoraTrainingImageResult => Boolean(image));
}

function buildDatasetRevisionSamples(
  revisionId: string,
  resultPool: LoraTrainingImageResult[],
  includedIds: Set<string>,
): LoraTrainingDatasetRevisionItem[] {
  return resultPool
    .filter((image) => includedIds.has(image.id))
    .slice(0, 8)
    .map((image, index) => ({
      id: `${revisionId}-sample-${index + 1}`,
      label: String(index + 1).padStart(3, "0"),
      sectionTitle: image.sectionTitle,
      image: image.image,
      captionSnapshot: image.caption,
      filePathSnapshot: image.image.full,
    }));
}

function buildGenerationInputImages(
  inputImages: Array<{
    relativePath: string;
    role: string;
  }>,
) {
  return inputImages
    .map((inputImage, index) => {
      const roleLabel = inputImage.role === "canonical"
        ? "主体"
        : inputImage.role === "source"
          ? "参考"
          : inputImage.role === "setting"
            ? "场景"
            : inputImage.role === "local_reference"
            ? "补充"
            : "历史";
      return buildTrainingImage(
        inputImage.relativePath,
        `${String(index + 1).padStart(2, "0")} · ${roleLabel}`,
        "pending",
        index,
      );
    })
    .filter((image): image is TrainingImage => Boolean(image));
}

function normalizeGenerationInputImages(value: unknown): Array<{
  relativePath: string;
  role: string;
}> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const relativePath = typeof record.relativePath === "string" ? record.relativePath : "";
    if (!relativePath) return [];
    return [{
      relativePath,
      role: typeof record.role === "string" ? record.role : "history",
    }];
  });
}

function buildTrainingRuns(
  project: { id: string; title: string },
  resultPool: LoraTrainingImageResult[],
  trainingRuns: Awaited<ReturnType<typeof listTrainingRuns>>,
  revisionMap: Map<string, Set<string>>,
): LoraTrainingRun[] {
  return trainingRuns.map((run) => ({
    id: run.id,
    kind: "training" as const,
    status: run.status === "done" ? "completed" : run.status === "running" ? "running" : run.status === "queued" ? "queued" : "failed",
    projectId: project.id,
    projectTitle: project.title,
    title: `LoRA 训练 v${run.datasetRevisionId ? "?" : "?"}`,
    summary: run.datasetRevisionId ? `数据集 ${run.datasetRevisionId}` : "训练任务",
    timestamp: run.finishedAt
      ? formatTimestamp(run.finishedAt, run.status === "failed" ? "失败于" : "完成于")
      : run.startedAt
        ? formatTimestamp(run.startedAt, "开始于")
        : formatTimestamp(run.createdAt, "创建于"),
    provider: "本地训练",
    datasetRevisionId: run.datasetRevisionId,
    artifactName: run.finalSafetensorsArtifactId ?? undefined,
    finalLoraArtifactId: run.finalSafetensorsArtifactId ?? undefined,
    finalInput: run.resolvedConfig ? JSON.stringify(run.resolvedConfig, null, 2) : undefined,
    schedulerMessage: run.metadataSummary ? JSON.stringify(run.metadataSummary) : undefined,
    trainingLogArtifactName: run.logArtifactId ?? undefined,
    datasetSamples: resultPool
      .filter((image) => revisionMap.get(run.datasetRevisionId)?.has(image.id))
      .slice(0, 4)
      .map((image, index) => ({
        id: `${run.id}-dataset-sample-${index + 1}`,
        label: String(index + 1).padStart(3, "0"),
        sectionTitle: image.sectionTitle,
        image: image.image,
        caption: image.caption,
        status: image.reviewStatus,
      })),
  }));
}

async function buildGenerationRuns(input: {
  candidateImages: Awaited<ReturnType<typeof listTrainingCandidateImages>>;
  jobId: string;
  projectTitle: string;
  sectionNames: Map<string, string>;
}): Promise<LoraTrainingRun[]> {
  const grouped = new Map<string, typeof input.candidateImages>();
  for (const image of input.candidateImages) {
    if (!image.generationRunId) continue;
    if (!grouped.has(image.generationRunId)) grouped.set(image.generationRunId, []);
    grouped.get(image.generationRunId)!.push(image);
  }

  const runs: Array<LoraTrainingRun | null> = await Promise.all(
    [...grouped.entries()].map(async ([generationRunId, images]) => {
      const run = await getTrainingGenerationRun(generationRunId);
      if (!run) return null;
      const sectionTitle = images[0]?.sectionId ? input.sectionNames.get(images[0].sectionId) ?? "训练小节" : "未分组";
      return {
        id: generationRunId,
        kind: "generation" as const,
        status: run.status === "done" ? "completed" : run.status === "running" ? "running" : run.status === "queued" ? "queued" : "failed",
        projectId: input.jobId,
        sectionId: images[0]?.sectionId ?? undefined,
        projectTitle: input.projectTitle,
        title: images[0]?.sectionId ? `${sectionTitle} 图片生成` : "训练图片生成",
        summary: `图片 · 小节 ${sectionTitle}`,
        timestamp: run.finishedAt
          ? formatTimestamp(run.finishedAt, run.status === "failed" ? "失败于" : "完成于")
          : run.startedAt
            ? formatTimestamp(run.startedAt, "开始于")
            : formatTimestamp(run.createdAt, "创建于"),
        provider: run.imageModel ?? run.hostModel ?? run.provider ?? undefined,
        finalInput: run.visualPrompt ?? run.hostInstruction ?? undefined,
        inputImages: buildGenerationInputImages(normalizeGenerationInputImages(run.inputImages)),
        errorMessage: typeof run.errorSummary === "string" ? run.errorSummary : run.errorSummary ? JSON.stringify(run.errorSummary) : undefined,
        outputLabel: `输出 ${images.length} 张图片`,
        outputResultIds: images.map((image) => image.id),
      } satisfies LoraTrainingRun;
    }),
  );

  return runs.filter((run): run is LoraTrainingRun => Boolean(run));
}

async function mapRealTrainingProjects(): Promise<LoraTrainingData> {
  const jobs = await listTrainingProductionProjects({ page: 1, pageSize: 20 });
  const [presetRows, templateRows] = await Promise.all([
    listTrainingSceneDescriptionPresetRows(),
    listTrainingTemplateRows(),
  ]);

  const projects = await Promise.all(jobs.jobs.map(async (job) => {
    const [overview, sourceImages, promptCardVersions, sections, candidateImages, revisions, trainingRuns] = await Promise.all([
      getTrainingProjectOverview(job.id),
      listTrainingReferenceImages(job.id),
      listTrainingPromptCardVersions(job.id),
      listTrainingProjectSections(job.id),
      listTrainingCandidateImages(job.id, {}),
      listTrainingDatasetRevisions(job.id),
      listTrainingRuns(job.id),
    ]);

    const latestPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    const resultPool = buildResultPool({ candidateImages, sectionNames });
    const keptResults = resultPool.filter((image) => image.reviewStatus === "kept");
    const revisionMap = new Map<string, Set<string>>();
    for (const revision of revisions) {
      revisionMap.set(
        revision.id,
        new Set(candidateImages.filter((image) => image.includedDatasetRevisionId === revision.id).map((image) => image.id)),
      );
    }

    const mappedSections: LoraTrainingSection[] = sections.map((section) => {
      const baseResolvedScene = section.template?.description ?? section.name;
      const baseImagePrompt = latestPromptCard?.finalPromptDraft ?? job.triggerToken;
      return {
        id: section.id,
        title: section.name,
        enabled: section.status !== "paused",
        updatedAt: formatUpdatedAt(section.updatedAt),
        blocks: [
          {
            id: `${section.id}-scene-block`,
            source: "本地",
            title: "训练场景说明",
            text: baseResolvedScene,
          },
        ],
        resolvedScene: baseResolvedScene,
        imagePrompt: baseImagePrompt,
        images: resultPool.filter((image) => image.sectionId === section.id).map((image) => image.image).slice(0, 5),
        resultStatus: section.pendingCount > 0 ? "pending" : section.keepCount > 0 ? "kept" : "rejected",
      };
    });

    const mappedRevisions: LoraTrainingDatasetRevision[] = revisions.map((revision) => {
      const includedIds = revisionMap.get(revision.id) ?? new Set<string>();
      const samples = buildDatasetRevisionSamples(revision.id, resultPool, includedIds);
      return {
        id: revision.id,
        version: `v${revision.version}`,
        status: revision.status === "frozen" ? "ready" : revision.status === "freezing" ? "training" : "draft",
        createdAt: formatUpdatedAt(revision.createdAt),
        itemCount: revision.itemCount,
        captionMissingCount: samples.filter((sample) => !sample.captionSnapshot).length,
        manifestName: revision.selectedManifestArtifactId ?? `dataset_v${revision.version}.jsonl`,
        samples,
        manifestRows: samples.map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
        relatedTrainingRunIds: trainingRuns.filter((run) => run.datasetRevisionId === revision.id).map((run) => run.id),
      };
    });

    const latestRevision = mappedRevisions[0] ?? null;
    const latestTrainingRun = trainingRuns[0] ?? null;
    const referenceImages = buildReferenceImages(sourceImages);

    return {
      id: job.id,
      title: job.characterName,
      status: mapProjectStatus({
        archived: job.status === "archived",
        latestTrainingStatus: latestTrainingRun?.status ?? null,
        missingItems: overview.missingItems ?? null,
      }),
      updatedAt: formatUpdatedAt(job.updatedAt),
      sectionCount: mappedSections.length,
      imageCount: resultPool.length,
      datasetVersion: latestRevision?.version ?? "草稿",
      recentTraining: latestTrainingRun
        ? `${latestTrainingRun.status === "done" ? "已完成" : latestTrainingRun.status === "running" ? "训练中" : latestTrainingRun.status === "queued" ? "排队中" : "失败"} · ${latestTrainingRun.finalSafetensorsArtifactId ?? latestTrainingRun.id}`
        : "待启动训练",
      profileSummary: `${job.characterName} · trigger ${job.triggerToken} · 源图 ${sourceImages.length} 张`,
      usagePrompt: latestPromptCard?.finalPromptDraft ?? job.triggerToken,
      detailPrompt: JSON.stringify(
        {
          identityTraits: latestPromptCard?.identityTraits ?? {},
          outfitTraits: latestPromptCard?.outfitTraits ?? {},
          negativeTraits: latestPromptCard?.negativeTraits ?? [],
        },
        null,
        2,
      ),
      readiness: overview.missingItems?.some((item) => item.blocking) ? "待补" : "完整",
      keptCount: keptResults.length,
      captionMissingCount: keptResults.filter((image) => !image.caption).length,
      images: resultPool.map((image) => image.image).slice(0, 8),
      referenceImages,
      resultPool,
      sections: mappedSections,
      datasetRevisions: mappedRevisions,
    } satisfies LoraTrainingProject;
  }));

  const runsByProject = await Promise.all(projects.map(async (project) => {
    const [candidateImages, trainingRuns] = await Promise.all([
      listTrainingCandidateImages(project.id, {}),
      listTrainingRuns(project.id),
    ]);
    const sectionNames = new Map(project.sections.map((section) => [section.id, section.title]));
    const resultPool = project.resultPool;
    const revisionMap = new Map(
      project.datasetRevisions.map((revision) => [
        revision.id,
        new Set(
          candidateImages
            .filter((image) => image.includedDatasetRevisionId === revision.id)
            .map((image) => image.id),
        ),
      ]),
    );

    const generationRuns = await buildGenerationRuns({
      candidateImages,
      jobId: project.id,
      projectTitle: project.title,
      sectionNames,
    });
    const mappedTrainingRuns = buildTrainingRuns(
      { id: project.id, title: project.title },
      resultPool,
      trainingRuns,
      revisionMap,
    );

    return [...generationRuns, ...mappedTrainingRuns];
  }));

  return {
    projects,
    runs: runsByProject.flat().sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
    presets: presetRows.map(mapTrainingScenePreset),
    templates: templateRows.map(mapTrainingTemplate),
  };
}

export async function loadTrainingSnapshot(): Promise<LoraTrainingData> {
  return mapRealTrainingProjects();
}

import { buildLoraTrainingDemoData } from "@/app/design-demos/data/lora-training";
import type {
  LoraTrainingDatasetRevision,
  LoraTrainingDatasetRevisionItem,
  LoraTrainingDemoData,
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingRun,
  LoraTrainingSection,
} from "@/app/design-demos/data/lora-training-types";
import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import type { DemoData, DemoImage } from "@/app/design-demos/data/types";
import { toImageUrl } from "@/lib/image-url";
import { getCharacterLoraGenerationRun } from "@/server/repositories/character-lora-training";
import {
  listCharacterLoraPromptCardVersions,
} from "@/server/services/character-lora-training/prompt-card-service";
import {
  getCharacterLoraTrainingJobOverview,
  listCharacterLoraTrainingJobs,
} from "@/server/services/character-lora-training/job-service";
import {
  getCharacterLoraTrainingTemplateSnapshot,
  listCharacterLoraTrainingTemplates,
} from "@/server/services/character-lora-training/section-template-service";
import {
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
} from "@/server/services/character-lora-training/phase3-service";
import { listCharacterLoraJobSections } from "@/server/services/character-lora-training/section-template-service";
import { listCharacterLoraSourceImages } from "@/server/services/character-lora-training/source-image-service";
import { listCharacterLoraTrainingRuns } from "@/server/services/character-lora-training/training-service";

type ImageStatus = DemoImage["status"];

function formatTimestamp(value: string | null | undefined, prefix: "完成于" | "开始于" | "创建于" | "失败于" = "创建于") {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${prefix} ${hh}:${mm}`;
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function mapReviewStatusToImageStatus(reviewStatus: string): ImageStatus {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "trashed";
  return "pending";
}

function mapReviewStatus(reviewStatus: string): LoraTrainingImageResult["reviewStatus"] {
  if (reviewStatus === "keep" || reviewStatus === "included_in_training") return "kept";
  if (reviewStatus === "reject" || reviewStatus === "excluded") return "rejected";
  return "pending";
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

function buildDemoImage(relativePath: string, label: string, status: ImageStatus, index: number): DemoImage | null {
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

function buildReferenceImages(sourceImages: Awaited<ReturnType<typeof listCharacterLoraSourceImages>>): LoraTrainingReferenceImage[] {
  return sourceImages
    .map((image, index) => {
      const demoImage = buildDemoImage(image.relativePath, String(index + 1).padStart(2, "0"), "pending", index);
      if (!demoImage) return null;
      return {
        id: image.id,
        kind: index === 0 ? "original" : "auxiliary",
        label: `参考图 ${index + 1}`,
        note: image.role,
        image: demoImage,
      } satisfies LoraTrainingReferenceImage;
    })
    .filter((image): image is LoraTrainingReferenceImage => Boolean(image));
}

function readTemplateGuidance(value: unknown, key: string, fallback: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : fallback;
}

function buildResultPool(input: {
  candidateImages: Awaited<ReturnType<typeof listCharacterLoraCandidateImages>>;
  sectionNames: Map<string, string>;
}): LoraTrainingImageResult[] {
  return input.candidateImages
    .map((image, index) => {
      const demoImage = buildDemoImage(image.relativePath, String(index + 1).padStart(2, "0"), mapReviewStatusToImageStatus(image.reviewStatus), index);
      if (!demoImage) return null;
      const sectionTitle = image.sectionId ? input.sectionNames.get(image.sectionId) ?? "训练小节" : "未分组";
      return {
        id: image.id,
        sectionId: image.sectionId ?? "ungrouped",
        sectionTitle,
        image: demoImage,
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

function buildTrainingRuns(
  project: { id: string; title: string },
  resultPool: LoraTrainingImageResult[],
  trainingRuns: Awaited<ReturnType<typeof listCharacterLoraTrainingRuns>>,
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
  candidateImages: Awaited<ReturnType<typeof listCharacterLoraCandidateImages>>;
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

  const runs = await Promise.all(
    [...grouped.entries()].map(async ([generationRunId, images]) => {
      const run = await getCharacterLoraGenerationRun(generationRunId);
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
        provider: run.imageModel ?? run.hostModel ?? run.provider,
        finalInput: run.visualPrompt ?? run.hostInstruction,
        errorMessage: typeof run.errorSummary === "string" ? run.errorSummary : run.errorSummary ? JSON.stringify(run.errorSummary) : undefined,
        outputLabel: `输出 ${images.length} 张图片`,
        outputResultIds: images.map((image) => image.id),
      } satisfies LoraTrainingRun;
    }),
  );

  return runs.filter((run): run is LoraTrainingRun => Boolean(run));
}

async function mapRealTrainingProjects(baseData: DemoData): Promise<LoraTrainingDemoData | null> {
  const jobs = await listCharacterLoraTrainingJobs({ page: 1, pageSize: 20 });
  if (!jobs.jobs.length) return null;

  const baseTraining = buildLoraTrainingDemoData(baseData);
  const realTemplates = await listCharacterLoraTrainingTemplates();

  const projects = await Promise.all(jobs.jobs.map(async (job) => {
    const [overview, sourceImages, promptCardVersions, sections, candidateImages, revisions, trainingRuns] = await Promise.all([
      getCharacterLoraTrainingJobOverview(job.id),
      listCharacterLoraSourceImages(job.id),
      listCharacterLoraPromptCardVersions(job.id),
      listCharacterLoraJobSections(job.id),
      listCharacterLoraCandidateImages(job.id, {}),
      listCharacterLoraDatasetRevisions(job.id),
      listCharacterLoraTrainingRuns(job.id),
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

    const mappedSections: LoraTrainingSection[] = sections.map((section) => ({
      id: section.id,
      title: section.name,
      enabled: section.status !== "paused",
      updatedAt: formatUpdatedAt(section.updatedAt),
      blocks: [
        {
          id: `${section.id}-legacy-block`,
          source: "本地",
          title: "旧训练小节映射",
          text: section.template?.description ?? `旧训练小节 ${section.key} 的数据已映射到新训练模块。`,
        },
      ],
      resolvedScene: section.template?.description ?? section.name,
      imagePrompt: latestPromptCard?.finalPromptDraft ?? job.triggerToken,
      images: resultPool.filter((image) => image.sectionId === section.id).map((image) => image.image).slice(0, 5),
      resultStatus: section.pendingCount > 0 ? "pending" : section.keepCount > 0 ? "kept" : "rejected",
    }));

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
      listCharacterLoraCandidateImages(project.id, {}),
      listCharacterLoraTrainingRuns(project.id),
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

  const templates = await Promise.all(
    realTemplates.map(async (template) => {
      const snapshot = await getCharacterLoraTrainingTemplateSnapshot({ id: template.id });
      return {
        id: template.id,
        title: template.name,
        status: template.isActive ? "active" : "archived",
        updatedAt: formatUpdatedAt(template.updatedAt),
        description: template.description ?? "",
        imageGuidance: readTemplateGuidance(snapshot.trainingDefaults, "imageGuidance", "每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。"),
        captionGuidance: readTemplateGuidance(snapshot.promptCardDefaults, "captionGuidance", "先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。"),
        sectionCount: snapshot.sectionTemplates.length,
        sections: snapshot.sectionTemplates.map((section) => ({
          id: section.id,
          title: section.name,
          enabled: section.isActive,
          blockCount: 1,
          blocks: [
            {
              id: `${section.id}-prompt-template`,
              source: "本地" as const,
              title: section.angleTag || "模板提示词",
              text: section.promptTemplate || section.description || section.name,
            },
          ],
          resolvedScene: section.description || section.promptTemplate || section.name,
          scenePreview: section.description || section.name,
        })),
      };
    }),
  );

  return {
    projects,
    runs: runsByProject.flat().sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))),
    presets: baseTraining.presets,
    templates: templates.length ? templates : baseTraining.templates,
  };
}

export async function loadTrainingRouteData(): Promise<DemoData> {
  const baseData = await loadDesignDemoData();

  try {
    const loraTraining = await mapRealTrainingProjects(baseData);
    if (!loraTraining) return baseData;
    return {
      ...baseData,
      loraTraining,
      metrics: {
        ...baseData.metrics,
        projects: loraTraining.projects.length,
        runs: loraTraining.runs.length,
      },
    };
  } catch {
    return baseData;
  }
}

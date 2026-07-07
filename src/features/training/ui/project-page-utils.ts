import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData, TrainingModelOption } from "@/features/training/data";
import type {
  LoraTrainingImageResult,
  LoraTrainingProject,
  LoraTrainingReferenceImage,
  LoraTrainingSection,
  LoraTrainingSectionBlock,
  LoraTrainingTaskStatus,
  LoraTrainingTemplate,
} from "@/features/training/types";

export type LoraTrainingTemplateSeedSection = LoraTrainingTemplate["sections"][number];

export type ProjectSectionDraftState = {
  blockCount: number;
  firstBlock: string;
  imagePrompt: string;
  projectTitle: string;
  projectId: string;
  scenePreview: string;
  sectionId: string;
  sectionTitle: string;
};

export type NewProjectTemplateHints = {
  sections: string;
  templateId: string;
  templateTitle: string;
};

export type TrainingProfileRevisionField = "loraUsagePrompt" | "characterDetailPrompt" | "profileSummary";
export type TrainingProfileFormField = "detailPrompt" | "profileSummary" | "usagePrompt";
export type TrainingTextRevisionItem = {
  id: string;
  fieldName: string;
  textValue: string;
  reason: string;
  sourceTaskId: string | null;
  sourceRunId: string | null;
  createdAt: string;
};

export const PROFILE_REVISION_FIELDS: Array<{
  fieldName: TrainingProfileRevisionField;
  formField: TrainingProfileFormField;
  label: string;
}> = [
  { fieldName: "loraUsagePrompt", formField: "usagePrompt", label: "LoRA 使用提示词" },
  { fieldName: "characterDetailPrompt", formField: "detailPrompt", label: "角色细节描述" },
  { fieldName: "profileSummary", formField: "profileSummary", label: "资料备注" },
];

export const PROFILE_REVISION_REASON_LABELS: Record<string, string> = {
  ai_generation: "AI 生成",
  before_overwrite: "覆盖前快照",
  idle_checkpoint: "空闲快照",
  run_snapshot: "任务快照",
  dataset_freeze: "冻结数据集",
  start_training: "开始训练",
};

export function isTrainingModelOption(value: unknown): value is TrainingModelOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.modelType === "checkpoint"
    && typeof record.name === "string"
    && typeof record.relativePath === "string";
}

export function isTrainingTextRevisionItem(value: unknown): value is TrainingTextRevisionItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.fieldName === "string"
    && typeof record.textValue === "string"
    && typeof record.reason === "string"
    && typeof record.createdAt === "string";
}

export function profileRevisionFieldConfig(fieldName: TrainingProfileRevisionField) {
  return PROFILE_REVISION_FIELDS.find((field) => field.fieldName === fieldName) ?? PROFILE_REVISION_FIELDS[0];
}

export function formatProfileRevisionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function findProject(data: TrainingAppData, projectId?: string) {
  if (!projectId) return undefined;
  const training = buildLoraTrainingData(data);
  return training.projects.find((project) => project.id === projectId);
}

export function findSection(project: LoraTrainingProject | undefined, sectionId?: string) {
  if (!project || !sectionId) return undefined;
  return project.sections.find((section) => section.id === sectionId);
}

export function buildProjectSectionStateKey(projectId: string, sectionId: string) {
  return `${projectId}:${sectionId}`;
}

export function moveSceneBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

export function nextSceneBlockOrdinal(blocks: LoraTrainingSectionBlock[], prefix: string) {
  const ordinals = blocks
    .map((block) => (block.id.startsWith(prefix) ? Number(block.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function buildSeedSectionCopy(section: LoraTrainingTemplateSeedSection, copyNumber: number): LoraTrainingTemplateSeedSection {
  return {
    ...section,
    id: `${section.id}-copy-${copyNumber}`,
    title: `${section.title} 副本 ${copyNumber}`,
  };
}

export function nextSeedSectionCopyNumber(sections: LoraTrainingTemplateSeedSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextProjectSectionCopyNumber(sections: LoraTrainingSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextProjectSectionDraftNumber(sections: LoraTrainingSection[]) {
  const draftPrefix = "new-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function readNewProjectTemplateHints(search: string): NewProjectTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    sections: searchParams.get("sections") ?? "",
    templateId: searchParams.get("templateId") ?? "",
    templateTitle: searchParams.get("template") ?? "",
  };
}

export function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

export function buildTrainingProjectTriggerToken(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");
  return normalized || "training_project";
}

export function toTrainingImageReviewApiStatus(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
  if (reviewStatus === "kept") return "keep";
  if (reviewStatus === "rejected") return "reject";
  return "pending";
}

export function reviewResultToastTitle(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
  return reviewStatus === "kept" ? "图片已保留" : reviewStatus === "rejected" ? "图片已拒绝" : "图片已标记为待审核";
}

export function reviewStatusLabel(status: LoraTrainingImageResult["reviewStatus"]) {
  if (status === "kept") return "保留";
  if (status === "rejected") return "拒绝";
  return "待审";
}

export function reviewStatusTone(status: LoraTrainingImageResult["reviewStatus"]) {
  if (status === "kept") return "kept";
  if (status === "rejected") return "failed";
  return "pending";
}

export function referenceKindLabel(kind: LoraTrainingReferenceImage["kind"]) {
  if (kind === "original") return "原始";
  if (kind === "generated") return "生成";
  return "辅助";
}

export function nextDatasetVersionLabel(currentVersion: string) {
  const match = /^v(\d+)$/i.exec(currentVersion.trim());
  if (!match) return "v1";
  return `v${Number(match[1]) + 1}`;
}

export function normalizeGenerationDraftReferenceId(referenceId: string) {
  if (referenceId.startsWith("reference-")) return referenceId.slice("reference-".length);
  if (referenceId.startsWith("result-")) return referenceId.slice("result-".length);
  return referenceId;
}

export function captionMissing(caption: string) {
  const normalized = caption.trim();
  return normalized.length === 0 || normalized === "未填写说明文本";
}

export function deriveDatasetCaption(result: LoraTrainingImageResult) {
  if (!captionMissing(result.caption)) return result.caption;
  return `${result.sourceLabel}，训练说明`;
}

export function buildLocalDatasetRevision(projectId: string, results: LoraTrainingImageResult[], version: string) {
  const keptResults = results.filter((result) => result.reviewStatus === "kept");
  const samples = keptResults.slice(0, 6).map((result, index) => ({
    id: `${projectId}-dataset-${version}-${index + 1}`,
    label: String(index + 1).padStart(3, "0"),
    sectionTitle: result.sectionTitle,
    image: result.image,
    captionSnapshot: result.caption,
    filePathSnapshot: `datasets/${projectId}/${version}/${String(index + 1).padStart(3, "0")}.png`,
  }));

  return {
    id: `${projectId}-dataset-${version}`,
    version,
    status: keptResults.some((result) => captionMissing(result.caption)) ? "draft" as const : "ready" as const,
    createdAt: "刚刚",
    itemCount: keptResults.length,
    captionMissingCount: keptResults.filter((result) => captionMissing(result.caption)).length,
    manifestName: `dataset_${version}.jsonl`,
    samples,
    manifestRows: samples.slice(0, 4).map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
    relatedTrainingRunIds: [],
  };
}

export function projectRunStatusLabel(status: LoraTrainingTaskStatus) {
  if (status === "completed") return "完成";
  if (status === "running") return "进行中";
  if (status === "queued") return "排队";
  return "失败";
}

export function sceneBlockPreviewText(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "无";
}

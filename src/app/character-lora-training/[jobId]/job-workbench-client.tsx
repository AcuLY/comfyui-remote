"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  FileText,
  FlaskConical,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Square,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import {
  cancelCharacterLoraTrainingRun,
  createCharacterLoraPromptCardVersion,
  createCharacterLoraPromotionDecision,
  ensureCharacterLoraBenchmarkTemplate,
  enqueueCharacterLoraBenchmarkRun,
  enqueueCharacterLoraCanonicalGenerationRun,
  enqueueCharacterLoraSectionGenerationRun,
  enqueueCharacterLoraTrainingRun,
  freezeCharacterLoraDataset,
  instantiateCharacterLoraJobSections,
  mockCompleteCharacterLoraBenchmarkRun,
  mockCompleteCharacterLoraCanonicalGenerationRun,
  persistCharacterLoraJobReport,
  promoteCharacterLoraSectionInstructionToPromptCardVersion,
  promoteCharacterLoraPreset,
  registerCharacterLoraSourceImageAsCandidate,
  registerManualCharacterLoraCanonicalVersion,
  reviewCharacterLoraImages,
  selectCharacterLoraCanonicalVersion,
  updateCharacterLoraImageCaption,
  uploadCharacterLoraSourceImage,
} from "@/lib/actions/character-lora-training";
import type {
  CharacterLoraBenchmarkRun,
  CharacterLoraBenchmarkTemplateStatus,
  CharacterLoraCandidateImage,
  CharacterLoraDatasetRevision,
  CharacterLoraGpuLock,
  CharacterLoraJob,
  CharacterLoraJobReport,
  CharacterLoraPromptCard,
  CharacterLoraPromotionDecision,
  CharacterLoraSection,
  CharacterLoraSectionTemplate,
  CharacterLoraSourceImage,
  CharacterLoraTrainingRun,
} from "../types";

type Props = {
  job: CharacterLoraJob;
  sourceImages: CharacterLoraSourceImage[];
  promptCards: CharacterLoraPromptCard[];
  sectionTemplates: CharacterLoraSectionTemplate[];
  sections: CharacterLoraSection[];
  candidateImages: CharacterLoraCandidateImage[];
  datasetRevisions: CharacterLoraDatasetRevision[];
  trainingRuns: CharacterLoraTrainingRun[];
  benchmarkRuns: CharacterLoraBenchmarkRun[];
  benchmarkTemplateStatus: CharacterLoraBenchmarkTemplateStatus;
  promotionDecisions: CharacterLoraPromotionDecision[];
  report: CharacterLoraJobReport;
  gpuLock: CharacterLoraGpuLock;
};

const DEFAULT_BENCHMARK_WEIGHT_MATRIX = [0.65, 0.85, 1] as const;
const DEFAULT_BENCHMARK_WEIGHT_MATRIX_TEXT = DEFAULT_BENCHMARK_WEIGHT_MATRIX.join(",");
const MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT = 7;

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  canonical_pending: "标准图",
  prompt_pending: "提示词",
  section_generating: "分镜生成",
  reviewing: "审核",
  dataset_ready: "数据集",
  training_queued: "训练排队",
  training_running: "训练中",
  trained: "已训练",
  benchmarking: "基准测试",
  benchmark_review: "基准审核",
  promotion_ready: "待发布",
  promoted: "已发布",
  failed: "失败",
  cancelled: "已取消",
  archived: "归档",
  queued: "排队",
  running: "运行中",
  done: "完成",
  keep: "保留",
  reject: "拒绝",
  excluded: "排除",
  pending: "待审",
  included_in_training: "入集",
  approved: "通过",
  rejected: "驳回",
};

const REVIEW_STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待审" },
  { value: "keep", label: "保留" },
  { value: "reject", label: "拒绝" },
  { value: "excluded", label: "排除" },
  { value: "included_in_training", label: "已入集" },
] as const;

const REJECT_REASON_OPTIONS = [
  { value: "identity_wrong", label: "身份不符", suggestion: "重跑时提高 canonical 权重，并补充脸型、发型、标志物约束。" },
  { value: "hair_wrong", label: "发型错误", suggestion: "重跑时明确发型、发量、发色和刘海边界。" },
  { value: "bangs_wrong", label: "刘海错误", suggestion: "重跑时单独描述刘海形状，加入局部参考图。" },
  { value: "eye_wrong", label: "眼睛错误", suggestion: "重跑时补充眼型、瞳色、神态，避免泛化脸。" },
  { value: "face_wrong", label: "脸型错误", suggestion: "重跑时强化脸型、年龄感和五官比例描述。" },
  { value: "outfit_wrong", label: "服装错误", suggestion: "重跑时拆分上装、下装、配饰，并锁定颜色材质。" },
  { value: "shoe_wrong", label: "鞋子错误", suggestion: "重跑时加入鞋型和可见脚部构图要求。" },
  { value: "accessory_missing", label: "饰品缺失", suggestion: "重跑时单独列出必须保留的饰品、装饰和局部参考图。" },
  { value: "pose_wrong", label: "姿势错误", suggestion: "重跑时用更具体姿势和镜头角度，减少自由发挥。" },
  { value: "composition_wrong", label: "构图错误", suggestion: "重跑时指定半身/全身、留白、主体位置和裁切边界。" },
  { value: "hands_wrong", label: "手部问题", suggestion: "重跑时降低复杂手势，改用简单可控姿势。" },
  { value: "anatomy_wrong", label: "结构问题", suggestion: "重跑时加入解剖正确、四肢比例和镜头限制。" },
  { value: "multi_character", label: "多角色", suggestion: "重跑时强调单人、无附加人物，并移除群体/合影描述。" },
  { value: "background_pollution", label: "背景污染", suggestion: "重跑时强制白底、无道具、无 logo，并在 caption 中清理背景 tag。" },
  { value: "style_wrong", label: "画风不符", suggestion: "重跑时锁定目标画风，删除冲突风格词。" },
  { value: "watermark_text", label: "水印/文字", suggestion: "重跑时明确禁止文字、UI、logo、署名和生成器噪声 tag。" },
  { value: "quality_low", label: "质量过低", suggestion: "重跑时提高质量档或减少复杂背景干扰。" },
  { value: "duplicate", label: "重复图", suggestion: "重跑时换 seed 或要求不同角度/动作。" },
  { value: "unsafe", label: "不安全", suggestion: "重跑时加强安全约束并替换敏感动作/服装。" },
  { value: "other", label: "其他", suggestion: "在备注里写明问题，再把备注转成下一轮 userInstruction。" },
] as const;

type ReviewWritableStatus = "pending" | "keep" | "reject" | "excluded";
type RejectReason = (typeof REJECT_REASON_OPTIONS)[number]["value"];
type ImageProvider = "mock-local" | "openai-codex";

const IMAGE_PROVIDERS: Array<{ value: ImageProvider; label: string }> = [
  { value: "openai-codex", label: "openai-codex" },
  { value: "mock-local", label: "mock-local (debug)" },
];

const IMAGE_SIZE_OPTIONS = ["1024x1536", "1024x1024", "1536x1024"] as const;
const IMAGE_QUALITY_OPTIONS = ["high", "medium", "low"] as const;
const TRAINING_PRECISION_OPTIONS = ["", "bf16", "fp16", "fp32"] as const;
const PROMOTION_RETURN_POINTS = ["benchmark_review", "dataset_ready", "trained"] as const;
const PROMOTION_VARIANTS = [
  { slug: "default", label: "default" },
  { slug: "underwear", label: "underwear" },
  { slug: "underwear-shoes-off", label: "underwear no shoes" },
  { slug: "half-undressed", label: "half undressed" },
  { slug: "half-undressed-upper", label: "half undressed upperbody" },
  { slug: "half-undressed-shoes-off", label: "half undressed no shoes" },
  { slug: "naked", label: "naked" },
] as const;

type TrainingPrecision = Exclude<(typeof TRAINING_PRECISION_OPTIONS)[number], "">;
type PromotionDecisionStatus = "approved" | "rejected";
type TrainingOrdinaryOverrides = Partial<{
  rank: number;
  alpha: number;
  resolution: number;
  bucket: boolean;
  precision: TrainingPrecision;
  batchSize: number;
  gradientAccumulation: number;
  targetSteps: number;
  saveInterval: number;
}>;
type TrainingAdvancedOverrides = Partial<{
  unetLearningRate: number;
  textEncoderLearningRate: number | null;
  trainTextEncoder: boolean;
  networkModule: string;
  optimizer: string;
  lrScheduler: string;
  minBucketResolution: number;
  maxBucketResolution: number;
  seed: number;
}>;
type TrainingOverrides = {
  ordinary?: TrainingOrdinaryOverrides;
  advanced?: TrainingAdvancedOverrides;
  expert?: Record<string, unknown>;
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

function parseJsonObject(value: string, fallback: Record<string, unknown>) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 必须是 object");
  }

  return parsed as Record<string, unknown>;
}

function readOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseWeights(value: string) {
  const weights = parseCsv(value).map((item) => Number(item));
  if (weights.some((item) => !Number.isFinite(item) || item <= 0)) {
    throw new Error("权重矩阵必须是正数");
  }
  return weights.length > 0 ? weights : [...DEFAULT_BENCHMARK_WEIGHT_MATRIX];
}

function readOptionalNumber(
  formData: FormData,
  key: string,
  label: string,
  options: { integer?: boolean; min?: number; minInclusive?: boolean } = {},
) {
  const raw = readOptionalString(formData, key);
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  const minInclusive = options.minInclusive ?? true;
  const isTooSmall = options.min === undefined ? false : minInclusive ? value < options.min : value <= options.min;
  if (!Number.isFinite(value) || isTooSmall || (options.integer && !Number.isInteger(value))) {
    const kind = options.integer ? "integer" : "number";
    throw new Error(`${label} must be a valid ${kind}`);
  }

  return value;
}

function readRequiredPositiveNumber(formData: FormData, key: string, label: string) {
  const raw = readOptionalString(formData, key);
  if (!raw) {
    throw new Error(`${label} is required`);
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number`);
  }

  return value;
}

function readOptionalBooleanChoice(formData: FormData, key: string, label: string) {
  const value = readOptionalString(formData, key);
  if (!value) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${label} must be true or false`);
}

function readOptionalPrecision(formData: FormData) {
  const value = readOptionalString(formData, "precision");
  if (!value) {
    return undefined;
  }
  if (value === "bf16" || value === "fp16" || value === "fp32") {
    return value;
  }
  throw new Error("precision must be bf16, fp16, or fp32");
}

function compactTrainingOverrides(overrides: TrainingOverrides) {
  const result: TrainingOverrides = {};
  if (overrides.ordinary && Object.keys(overrides.ordinary).length > 0) {
    result.ordinary = overrides.ordinary;
  }
  if (overrides.advanced && Object.keys(overrides.advanced).length > 0) {
    result.advanced = overrides.advanced;
  }
  if (overrides.expert && Object.keys(overrides.expert).length > 0) {
    result.expert = overrides.expert;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function buildTrainingOverrides(formData: FormData) {
  const ordinary: TrainingOrdinaryOverrides = {};
  const advanced: TrainingAdvancedOverrides = {};
  const expert: Record<string, unknown> = {};
  const trainTextEncoder = readOptionalBooleanChoice(formData, "trainTextEncoder", "trainTextEncoder");

  if (trainTextEncoder !== undefined) advanced.trainTextEncoder = trainTextEncoder;

  if (formData.get("enableAdvancedOverrides") === "on") {
    const targetSteps = readOptionalNumber(formData, "targetSteps", "targetSteps", {
      integer: true,
      min: 0,
      minInclusive: false,
    });
    const rank = readOptionalNumber(formData, "rank", "rank", { integer: true, min: 0, minInclusive: false });
    const alpha = readOptionalNumber(formData, "alpha", "alpha", { integer: true, min: 0, minInclusive: false });
    const resolution = readOptionalNumber(formData, "resolution", "resolution", { integer: true, min: 0, minInclusive: false });
    const batchSize = readOptionalNumber(formData, "batchSize", "batchSize", { integer: true, min: 0, minInclusive: false });
    const gradientAccumulation = readOptionalNumber(formData, "gradientAccumulation", "gradient accumulation", {
      integer: true,
      min: 0,
      minInclusive: false,
    });
    const saveInterval = readOptionalNumber(formData, "saveInterval", "saveInterval", { integer: true, min: 0, minInclusive: false });
    const precision = readOptionalPrecision(formData);
    const bucket = readOptionalBooleanChoice(formData, "bucket", "bucket");
    const unetLearningRate = readOptionalNumber(formData, "unetLearningRate", "UNet LR", { min: 0, minInclusive: false });
    const textEncoderLearningRate = readOptionalNumber(formData, "textEncoderLearningRate", "text encoder LR", {
      min: 0,
      minInclusive: false,
    });

    if (targetSteps !== undefined) ordinary.targetSteps = targetSteps;
    if (rank !== undefined) ordinary.rank = rank;
    if (alpha !== undefined) ordinary.alpha = alpha;
    if (resolution !== undefined) ordinary.resolution = resolution;
    if (batchSize !== undefined) ordinary.batchSize = batchSize;
    if (gradientAccumulation !== undefined) ordinary.gradientAccumulation = gradientAccumulation;
    if (saveInterval !== undefined) ordinary.saveInterval = saveInterval;
    if (precision !== undefined) ordinary.precision = precision;
    if (bucket !== undefined) ordinary.bucket = bucket;
    if (unetLearningRate !== undefined) advanced.unetLearningRate = unetLearningRate;
    if (textEncoderLearningRate !== undefined) advanced.textEncoderLearningRate = textEncoderLearningRate;
  }

  if (formData.get("enableExpertOverrides") === "on") {
    const networkModule = readOptionalString(formData, "networkModule");
    const optimizer = readOptionalString(formData, "optimizer");
    const lrScheduler = readOptionalString(formData, "lrScheduler");
    const seed = readOptionalNumber(formData, "seed", "seed", { integer: true, min: 0 });
    const minBucketResolution = readOptionalNumber(formData, "minBucketResolution", "min bucket resolution", {
      integer: true,
      min: 0,
      minInclusive: false,
    });
    const maxBucketResolution = readOptionalNumber(formData, "maxBucketResolution", "max bucket resolution", {
      integer: true,
      min: 0,
      minInclusive: false,
    });
    const minSnrGamma = readOptionalNumber(formData, "minSnrGamma", "minSNR gamma", { min: 0, minInclusive: false });
    const noiseOffset = readOptionalNumber(formData, "noiseOffset", "noise offset", { min: 0 });
    const clipSkip = readOptionalNumber(formData, "clipSkip", "clip skip", { integer: true, min: 0, minInclusive: false });
    const cacheLatents = readOptionalBooleanChoice(formData, "cacheLatents", "cache latents");
    const cacheTextEncoderOutputs = readOptionalBooleanChoice(
      formData,
      "cacheTextEncoderOutputs",
      "cache text encoder outputs",
    );
    const expertJson = parseJsonObject(String(formData.get("expertJson") ?? ""), {});

    if (networkModule) advanced.networkModule = networkModule;
    if (optimizer) advanced.optimizer = optimizer;
    if (lrScheduler) advanced.lrScheduler = lrScheduler;
    if (seed !== undefined) advanced.seed = seed;
    if (minBucketResolution !== undefined) advanced.minBucketResolution = minBucketResolution;
    if (maxBucketResolution !== undefined) advanced.maxBucketResolution = maxBucketResolution;
    if (minSnrGamma !== undefined) expert.minSnrGamma = minSnrGamma;
    if (noiseOffset !== undefined) expert.noiseOffset = noiseOffset;
    if (clipSkip !== undefined) expert.clipSkip = clipSkip;
    if (cacheLatents !== undefined) expert.cacheLatents = cacheLatents;
    if (cacheTextEncoderOutputs !== undefined) expert.cacheTextEncoderOutputs = cacheTextEncoderOutputs;
    Object.assign(expert, expertJson);
  }

  return compactTrainingOverrides({ ordinary, advanced, expert });
}

function buildPostTrainingBenchmarkConfig(formData: FormData) {
  const enabled = formData.get("postTrainingBenchmarkEnabled") === "on";
  if (!enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    checkpointMatrix: parseCsv(String(formData.get("postTrainingBenchmarkCheckpointMatrix") ?? "")),
    weightMatrix: parseWeights(String(formData.get("postTrainingBenchmarkWeightMatrix") ?? DEFAULT_BENCHMARK_WEIGHT_MATRIX_TEXT)),
    templateId: readOptionalString(formData, "postTrainingBenchmarkTemplateId"),
    registerLoraAsset: formData.get("postTrainingBenchmarkRegisterLoraAsset") === "on",
    copyToCharacterDir: formData.get("postTrainingBenchmarkCopyToCharacterDir") === "on",
    loraAssetName: readOptionalString(formData, "postTrainingBenchmarkLoraAssetName"),
    queuePolicy: String(formData.get("postTrainingBenchmarkQueuePolicy") ?? "queue_when_busy"),
    dryRun: formData.get("postTrainingBenchmarkDryRun") === "on",
    skipQueue: formData.get("postTrainingBenchmarkSkipQueue") === "on",
  };
}

function buildImageToolParams(size: string, quality: string) {
  return {
    size,
    quality,
    outputFormat: "png" as const,
    background: "opaque" as const,
  };
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

function compactId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
}

function getBenchmarkDefaultCheckpoint(benchmark: CharacterLoraBenchmarkRun | null | undefined, job: CharacterLoraJob) {
  const checkpointMatrix = Array.isArray(benchmark?.checkpointMatrix) ? benchmark.checkpointMatrix : [];
  const firstCheckpoint = checkpointMatrix.find((item): item is string => typeof item === "string" && item.trim().length > 0);

  return firstCheckpoint ?? job.baseCheckpointName ?? "";
}

function getBenchmarkRecommendedWeight(benchmark: CharacterLoraBenchmarkRun | null | undefined) {
  return typeof benchmark?.recommendedWeight === "number" && Number.isFinite(benchmark.recommendedWeight) && benchmark.recommendedWeight > 0
    ? benchmark.recommendedWeight
    : 1;
}

function getBenchmarkApprovalState(benchmark: CharacterLoraBenchmarkRun, selectedCheckpoint: string | undefined) {
  const summary = readBenchmarkRecord(benchmark.resultSummary);
  const counts = readBenchmarkRecord(summary?.counts);
  const matrixExpansion = readBenchmarkRecord(summary?.matrixExpansion);
  const sections = Array.isArray(summary?.sections) ? summary.sections : [];
  const runIds = readBenchmarkStringArray(summary?.runIds);
  const blockers: string[] = [];

  if (!selectedCheckpoint?.trim()) {
    blockers.push("missing checkpoint");
  }
  if (!summary) {
    blockers.push("missing benchmark result");
  }
  if (summary?.mocked === true || summary?.dryRun === true || summary?.skipQueue === true || summary?.skipWait === true) {
    blockers.push("mock/dryRun/skip result");
  }
  if (!counts) {
    blockers.push("missing run counts");
  } else {
    const failed = readBenchmarkNumber(counts.failed) ?? 0;
    const missing = readBenchmarkNumber(counts.missing) ?? 0;
    const queued = readBenchmarkNumber(counts.queued) ?? 0;
    const running = readBenchmarkNumber(counts.running) ?? 0;
    const totalRuns = readBenchmarkNumber(counts.totalRuns);
    const done = readBenchmarkNumber(counts.done);

    if (failed > 0 || missing > 0 || queued > 0 || running > 0) {
      blockers.push("unfinished or failed runs");
    }
    if (totalRuns === null || done === null || done < totalRuns) {
      blockers.push("runs not complete");
    }
    if (totalRuns !== null && totalRuns < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT) {
      blockers.push("not enough run evidence");
    }
  }
  if (!matrixExpansion) {
    blockers.push("missing matrix evidence");
  } else {
    const expectedSectionCount = readBenchmarkNumber(matrixExpansion.expectedSectionCount);
    const actualSectionCount = readBenchmarkNumber(matrixExpansion.actualSectionCount);
    if (expectedSectionCount === null || actualSectionCount === null || actualSectionCount < expectedSectionCount) {
      blockers.push("matrix incomplete");
    }
  }
  if (countBenchmarkSectionEvidence(sections) < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT || runIds.length < MIN_APPROVAL_BENCHMARK_EVIDENCE_COUNT) {
    blockers.push("need 7 section/run evidence");
  }

  return {
    canApprove: blockers.length === 0,
    blocker: blockers[0] ?? null,
  };
}

function readBenchmarkRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readBenchmarkNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBenchmarkStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function countBenchmarkSectionEvidence(sections: unknown[]) {
  return sections.filter((section) => {
    const sectionRecord = readBenchmarkRecord(section);
    if (!sectionRecord || typeof sectionRecord.sectionId !== "string" || !sectionRecord.sectionId.trim()) {
      return false;
    }

    const latestRun = readBenchmarkRecord(sectionRecord.latestRun);
    return (
      typeof latestRun?.id === "string" &&
      latestRun.id.trim().length > 0 &&
      latestRun.status === "done"
    );
  }).length;
}

export function JobWorkbenchClient({
  job,
  sourceImages,
  promptCards,
  sectionTemplates,
  sections,
  candidateImages,
  datasetRevisions,
  trainingRuns,
  benchmarkRuns,
  benchmarkTemplateStatus,
  promotionDecisions,
  report,
  gpuLock,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [latestCanonicalRunId, setLatestCanonicalRunId] = useState("");
  const [canonicalVersionId, setCanonicalVersionId] = useState(job.currentCanonicalVersionId ?? "");
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [reviewSectionFilter, setReviewSectionFilter] = useState("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const [rejectReason, setRejectReason] = useState<RejectReason>("identity_wrong");
  const [reviewNote, setReviewNote] = useState("");
  const [identityTraits, setIdentityTraits] = useState("{\n  \"face\": \"\",\n  \"hair\": \"\"\n}");
  const [outfitTraits, setOutfitTraits] = useState("{\n  \"outfit\": \"\"\n}");
  const [negativeTraits, setNegativeTraits] = useState("{\n  \"avoid\": \"wrong identity\"\n}");
  const [canonicalProvider, setCanonicalProvider] = useState<ImageProvider>("openai-codex");
  const [canonicalVisualPrompt, setCanonicalVisualPrompt] = useState("");
  const [canonicalSourceImageIds, setCanonicalSourceImageIds] = useState<string[]>(() => sourceImages.map((image) => image.id));
  const [manualCanonicalSourceImageId, setManualCanonicalSourceImageId] = useState(
    () => sourceImages.find((image) => image.role === "manual_canonical")?.id ?? "",
  );
  const [canonicalSize, setCanonicalSize] = useState("1024x1536");
  const [canonicalQuality, setCanonicalQuality] = useState("high");
  const [sectionProvider, setSectionProvider] = useState<ImageProvider>("openai-codex");
  const [sectionUserInstruction, setSectionUserInstruction] = useState("");
  const [sectionSourceImageIds, setSectionSourceImageIds] = useState<string[]>(() => sourceImages.map((image) => image.id));
  const [sectionSize, setSectionSize] = useState("1024x1536");
  const [sectionQuality, setSectionQuality] = useState("high");
  const [sectionParentRunIds, setSectionParentRunIds] = useState<Record<string, string>>({});
  const [promotionBenchmarkRunId, setPromotionBenchmarkRunId] = useState(
    () => benchmarkRuns.find((run) => run.status === "done" && run.loraAssetId)?.id ?? "",
  );
  const [promotionDecisionStatus, setPromotionDecisionStatus] = useState<PromotionDecisionStatus>("approved");
  const benchmarkTemplateDefaultId = benchmarkTemplateStatus.template?.id ?? "";
  const [postTrainingBenchmarkTemplateId, setPostTrainingBenchmarkTemplateId] = useState(benchmarkTemplateDefaultId);
  const [benchmarkTemplateId, setBenchmarkTemplateId] = useState(benchmarkTemplateDefaultId);

  const canonicalVersions = report.canonicalVersions;
  const manualCanonicalSourceImages = useMemo(
    () => sourceImages.filter((image) => image.role === "manual_canonical"),
    [sourceImages],
  );
  const selectedManualCanonicalSourceImageId = manualCanonicalSourceImages.some((image) => image.id === manualCanonicalSourceImageId)
    ? manualCanonicalSourceImageId
    : manualCanonicalSourceImages[0]?.id ?? "";
  const currentPrompt = promptCards.find((card) => card.id === job.currentPromptCardVersionId) ?? promptCards[0] ?? null;
  const canPromoteSectionInstruction = Boolean(sectionUserInstruction.trim() && currentPrompt);
  const latestFrozenRevision = datasetRevisions.find((revision) => revision.status === "frozen") ?? datasetRevisions[0] ?? null;
  const latestDoneTraining = trainingRuns.find((run) => run.status === "done" && run.finalSafetensorsArtifactId) ?? null;
  const pendingCanonicalRunId = latestCanonicalRunId.trim();
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const canonicalVersionById = useMemo(() => new Map(canonicalVersions.map((version) => [version.id, version])), [canonicalVersions]);
  const canonicalVersionByArtifactId = useMemo(
    () => new Map(canonicalVersions.map((version) => [version.imageArtifactId, version])),
    [canonicalVersions],
  );
  const promptCardById = useMemo(() => new Map(promptCards.map((card) => [card.id, card])), [promptCards]);
  const generationRunById = useMemo(() => new Map(report.generationRuns.map((run) => [run.id, run])), [report.generationRuns]);
  const generationRunsBySectionId = useMemo(() => {
    const runsBySection = new Map<string, CharacterLoraJobReport["generationRuns"]>();
    for (const run of report.generationRuns) {
      if (!run.sectionId) {
        continue;
      }

      const runs = runsBySection.get(run.sectionId) ?? [];
      runs.push(run);
      runsBySection.set(run.sectionId, runs);
    }

    return runsBySection;
  }, [report.generationRuns]);
  const candidateStatusCounts = useMemo(() => {
    return candidateImages.reduce<Record<string, number>>((acc, image) => {
      acc[image.reviewStatus] = (acc[image.reviewStatus] ?? 0) + 1;
      return acc;
    }, {});
  }, [candidateImages]);
  const filteredCandidateImages = useMemo(() => {
    return candidateImages.filter((image) => {
      const sectionMatches = reviewSectionFilter === "all" || image.sectionId === reviewSectionFilter;
      const statusMatches = reviewStatusFilter === "all" || image.reviewStatus === reviewStatusFilter;

      return sectionMatches && statusMatches;
    });
  }, [candidateImages, reviewSectionFilter, reviewStatusFilter]);
  const filteredSelectedImageIds = useMemo(() => {
    const visibleIds = new Set(filteredCandidateImages.map((image) => image.id));

    return selectedImageIds.filter((imageId) => visibleIds.has(imageId));
  }, [filteredCandidateImages, selectedImageIds]);
  const promotionBenchmarkOptions = useMemo(
    () => benchmarkRuns.filter((run) => run.status === "done" && run.loraAssetId),
    [benchmarkRuns],
  );
  const selectedPromotionBenchmark =
    promotionBenchmarkOptions.find((run) => run.id === promotionBenchmarkRunId) ?? promotionBenchmarkOptions[0] ?? null;
  const selectedPromotionCheckpoint = getBenchmarkDefaultCheckpoint(selectedPromotionBenchmark, job);
  const selectedPromotionApproval = selectedPromotionBenchmark
    ? getBenchmarkApprovalState(selectedPromotionBenchmark, selectedPromotionCheckpoint)
    : null;
  const isPromotionDraftApprovalBlocked =
    promotionDecisionStatus === "approved" && (!selectedPromotionApproval || !selectedPromotionApproval.canApprove);
  const rejectSuggestion = REJECT_REASON_OPTIONS.find((reason) => reason.value === rejectReason)?.suggestion ?? "";

  useEffect(() => {
    setPostTrainingBenchmarkTemplateId(benchmarkTemplateDefaultId);
    setBenchmarkTemplateId(benchmarkTemplateDefaultId);
  }, [benchmarkTemplateDefaultId]);

  function runAction(key: string, label: string, action: () => Promise<unknown>, refresh = true) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        await action();
        toast.success(label);
        if (refresh) {
          router.refresh();
        }
      } catch (error) {
        toast.error(`${label}失败`, { description: getErrorMessage(error) });
      } finally {
        setPendingKey(null);
      }
    });
  }

  function isBusy(key: string) {
    return isPending && pendingKey === key;
  }

  function handleUpload(formData: FormData) {
    runAction("source.upload", "Source 已上传", async () => {
      await uploadCharacterLoraSourceImage(job.id, formData);
    });
  }

  function handleRegisterSourceCandidate(sourceImageId: string) {
    runAction(`source.register.${sourceImageId}`, "Source candidate 已注册", async () => {
      await registerCharacterLoraSourceImageAsCandidate(job.id, {
        sourceImageId,
        reviewStatus: "pending",
      });
    });
  }

  function handleCanonicalGenerate() {
    const sourceImageIds = uniqueIds(canonicalSourceImageIds);
    if (sourceImageIds.length === 0) {
      toast.error("Canonical 至少选择一张 source/reference image");
      return;
    }

    runAction("canonical.generate", "Canonical 已入队", async () => {
      const run = await enqueueCharacterLoraCanonicalGenerationRun(job.id, {
        provider: canonicalProvider,
        visualPrompt: canonicalVisualPrompt.trim() || undefined,
        sourceImageIds,
        toolParams: buildImageToolParams(canonicalSize, canonicalQuality),
      });
      setLatestCanonicalRunId(run.id);
    });
  }

  function handleCanonicalMockComplete(formData: FormData) {
    const runId = readOptionalString(formData, "runId") ?? pendingCanonicalRunId;
    const sourceImageId = readOptionalString(formData, "sourceImageId") ?? null;
    if (!runId) {
      toast.error("缺少 canonical runId");
      return;
    }

    runAction("canonical.complete", "Canonical 已模拟完成", async () => {
      const result = await mockCompleteCharacterLoraCanonicalGenerationRun(runId, { sourceImageId });
      setCanonicalVersionId(result.canonicalVersion.id);
    });
  }

  function handleManualCanonicalRegister(formData: FormData) {
    const sourceImageId = readOptionalString(formData, "sourceImageId");
    if (!sourceImageId) {
      toast.error("缺少 manual_canonical source image");
      return;
    }

    runAction("canonical.manual", "Manual canonical 已注册", async () => {
      const version = await registerManualCharacterLoraCanonicalVersion(job.id, {
        sourceImageId,
        notes: readOptionalString(formData, "notes") ?? null,
      });
      setCanonicalVersionId(version.id);
    });
  }

  function handleCanonicalSelect(formData: FormData) {
    const versionId = readOptionalString(formData, "versionId") ?? canonicalVersionId.trim();
    if (!versionId) {
      toast.error("缺少 canonical versionId");
      return;
    }

    runAction("canonical.select", "Canonical 已选择", async () => {
      await selectCharacterLoraCanonicalVersion(job.id, versionId);
    });
  }

  function handlePromptCard(formData: FormData) {
    runAction("prompt.create", "Prompt Card 已保存", async () => {
      await createCharacterLoraPromptCardVersion(job.id, {
        canonicalVersionId: readOptionalString(formData, "canonicalVersionId") ?? null,
        triggerToken: readOptionalString(formData, "triggerToken"),
        identityTraits: parseJsonObject(identityTraits, {}),
        outfitTraits: parseJsonObject(outfitTraits, {}),
        negativeTraits: parseJsonObject(negativeTraits, {}),
        finalPromptDraft: String(formData.get("finalPromptDraft") ?? "").trim(),
        changeReason: readOptionalString(formData, "changeReason") ?? null,
      });
    });
  }

  function handleInstantiateSections(formData: FormData) {
    const keys = formData.getAll("templateKeys").map(String).filter(Boolean);
    runAction("sections.instantiate", "Sections 已实例化", async () => {
      await instantiateCharacterLoraJobSections(job.id, keys.length > 0 ? { templateKeys: keys } : {});
    });
  }

  function handleSectionRun(sectionId: string) {
    const sourceImageIds = uniqueIds(sectionSourceImageIds);
    const parentRunId = sectionParentRunIds[sectionId]?.trim();

    runAction(`section.${sectionId}`, "Section 已入队", async () => {
      await enqueueCharacterLoraSectionGenerationRun(sectionId, {
        provider: sectionProvider,
        userInstruction: sectionUserInstruction.trim() || undefined,
        parentRunId: parentRunId || undefined,
        sourceImageIds: sourceImageIds.length > 0 ? sourceImageIds : undefined,
        toolParams: buildImageToolParams(sectionSize, sectionQuality),
      });
    });
  }

  function handlePromoteSectionInstructionToPromptCard() {
    const sectionInstruction = sectionUserInstruction.trim();

    if (!sectionInstruction) {
      toast.error("先填写 section userInstruction");
      return;
    }

    if (!currentPrompt) {
      toast.error("缺少当前 Prompt Card");
      return;
    }

    runAction("section.promote-prompt-card", "全局 Prompt Card 修正已创建", async () => {
      await promoteCharacterLoraSectionInstructionToPromptCardVersion(job.id, {
        sectionUserInstruction: sectionInstruction,
      });
    });
  }

  function setSectionParentRunId(sectionId: string, parentRunId: string) {
    setSectionParentRunIds((prev) => ({ ...prev, [sectionId]: parentRunId }));
  }

  function setImageSelected(imageId: string, selected: boolean) {
    setSelectedImageIds((prev) =>
      selected ? Array.from(new Set([...prev, imageId])) : prev.filter((id) => id !== imageId),
    );
  }

  function setFilteredImagesSelected(selected: boolean) {
    const filteredIds = filteredCandidateImages.map((image) => image.id);
    setSelectedImageIds((prev) =>
      selected
        ? Array.from(new Set([...prev, ...filteredIds]))
        : prev.filter((imageId) => !filteredIds.includes(imageId)),
    );
  }

  function handleReview(imageIds: string[], reviewStatus: ReviewWritableStatus) {
    if (imageIds.length === 0) {
      toast.error("未选择图片");
      return;
    }

    runAction(`review.${reviewStatus}`, "审核状态已更新", async () => {
      await reviewCharacterLoraImages({
        images: imageIds.map((imageId) => ({
          imageId,
          reviewStatus,
          rejectReasons: reviewStatus === "reject" ? [rejectReason] : undefined,
          reviewNote: reviewStatus === "reject" ? reviewNote : undefined,
        })),
      });
      setSelectedImageIds([]);
    });
  }

  function handleCaption(imageId: string, formData: FormData) {
    runAction(`caption.${imageId}`, "Caption 已保存", async () => {
      await updateCharacterLoraImageCaption(imageId, {
        captionDraft: String(formData.get("captionDraft") ?? "").trim(),
      });
    });
  }

  function handleFreezeDataset(formData: FormData) {
    runAction("dataset.freeze", "Dataset 已冻结", async () => {
      const repeatCountRaw = readOptionalString(formData, "repeatCount");
      const sourceWeightRaw = readOptionalString(formData, "sourceWeight");
      await freezeCharacterLoraDataset(job.id, {
        captionStrategy: readOptionalString(formData, "captionStrategy"),
        repeatCount: repeatCountRaw ? Number(repeatCountRaw) : undefined,
        sourceWeight: sourceWeightRaw ? Number(sourceWeightRaw) : undefined,
      });
    });
  }

  function handleTrainingEnqueue(formData: FormData) {
    const datasetRevisionId = readOptionalString(formData, "datasetRevisionId") ?? latestFrozenRevision?.id;
    if (!datasetRevisionId) {
      toast.error("缺少 dataset revision");
      return;
    }

    runAction("training.enqueue", "训练已入队", async () => {
      const overrides = buildTrainingOverrides(formData);
      await enqueueCharacterLoraTrainingRun(datasetRevisionId, {
        launcher: String(formData.get("launcher") ?? "sd-scripts"),
        queuePolicy: String(formData.get("queuePolicy") ?? "reject_when_busy"),
        allowWhenComfyQueueBusy: formData.get("allowBusy") === "on",
        configProfile: String(formData.get("configProfile") ?? "standard"),
        postTrainingBenchmark: buildPostTrainingBenchmarkConfig(formData),
        ...(overrides ? { overrides } : {}),
      });
    });
  }

  function handleCancelTraining(trainingRunId: string) {
    runAction(`training.cancel.${trainingRunId}`, "训练已取消", async () => {
      await cancelCharacterLoraTrainingRun(trainingRunId, {
        reason: "cancelled from workbench",
        requestedBy: "character-lora-workbench",
      });
    });
  }

  function handleBenchmarkEnqueue(formData: FormData) {
    const trainingRunId = readOptionalString(formData, "trainingRunId") ?? latestDoneTraining?.id;
    if (!trainingRunId) {
      toast.error("缺少已完成训练 run");
      return;
    }

    runAction("benchmark.enqueue", "Benchmark 已入队", async () => {
      await enqueueCharacterLoraBenchmarkRun(trainingRunId, {
        checkpointMatrix: parseCsv(String(formData.get("checkpointMatrix") ?? "")),
        weightMatrix: parseWeights(String(formData.get("weightMatrix") ?? DEFAULT_BENCHMARK_WEIGHT_MATRIX_TEXT)),
        templateId: readOptionalString(formData, "templateId"),
        copyToCharacterDir: formData.get("copyToCharacterDir") === "on",
        dryRun: formData.get("dryRun") === "on",
        skipQueue: formData.get("skipQueue") === "on",
        queuePolicy: String(formData.get("queuePolicy") ?? "queue_when_busy"),
      });
    });
  }

  function handleEnsureBenchmarkTemplate() {
    runAction("benchmark.template.ensure", "Benchmark template 已就绪", async () => {
      const result = await ensureCharacterLoraBenchmarkTemplate({
        checkpointName: job.baseCheckpointName ?? null,
      });
      setPostTrainingBenchmarkTemplateId(result.template.id);
      setBenchmarkTemplateId(result.template.id);
    });
  }

  function handleBenchmarkMockComplete(benchmarkRunId: string) {
    runAction(`benchmark.complete.${benchmarkRunId}`, "Benchmark 已模拟完成", async () => {
      await mockCompleteCharacterLoraBenchmarkRun(benchmarkRunId, {});
    });
  }

  function handleDecision(benchmark: CharacterLoraBenchmarkRun, status: "approved" | "rejected") {
    if (!benchmark.loraAssetId) {
      toast.error("Benchmark 缺少 LoRA asset");
      return;
    }

    const selectedCheckpoint = getBenchmarkDefaultCheckpoint(benchmark, job) || undefined;
    const approval = getBenchmarkApprovalState(benchmark, selectedCheckpoint);
    if (status === "approved" && !approval.canApprove) {
      toast.error("Benchmark cannot be approved", { description: approval.blocker ?? "missing completed benchmark evidence" });
      return;
    }
    const defaultWeight = typeof benchmark.recommendedWeight === "number" ? benchmark.recommendedWeight : 1;

    runAction(`decision.${benchmark.id}.${status}`, "Promotion decision 已创建", async () => {
      await createCharacterLoraPromotionDecision(benchmark.id, {
        status,
        selectedLoraAssetId: benchmark.loraAssetId,
        selectedCheckpoint,
        defaultRecommendedWeight: defaultWeight,
        variantPromptDrafts: {},
        decisionReason: status === "approved" ? "approved from workbench" : "rejected from workbench",
        returnPoint: "benchmark_review",
      });
    });
  }

  function handleDecisionDraft(formData: FormData) {
    const benchmarkRunId = readOptionalString(formData, "benchmarkRunId") ?? selectedPromotionBenchmark?.id;
    const benchmark = benchmarkRuns.find((run) => run.id === benchmarkRunId);
    if (!benchmark) {
      toast.error("Select a benchmark run");
      return;
    }
    if (benchmark.status !== "done" || !benchmark.loraAssetId) {
      toast.error("Benchmark must be done and have a LoRA asset");
      return;
    }

    try {
      const statusRaw = String(formData.get("status") ?? "approved");
      if (statusRaw !== "approved" && statusRaw !== "rejected") {
        throw new Error("Status must be approved or rejected");
      }
      const status: PromotionDecisionStatus = statusRaw;
      const selectedCheckpoint = readOptionalString(formData, "selectedCheckpoint");
      if (status === "approved") {
        const approval = getBenchmarkApprovalState(benchmark, selectedCheckpoint);
        if (!approval.canApprove) {
          throw new Error(approval.blocker ?? "missing completed benchmark evidence");
        }
      }
      const defaultRecommendedWeight = readRequiredPositiveNumber(
        formData,
        "defaultRecommendedWeight",
        "Default recommended weight",
      );
      const variantPromptDrafts: Record<string, string> = {};
      const perVariantWeightOverrides: Record<string, number> = {};

      for (const variant of PROMOTION_VARIANTS) {
        const promptDraft = readOptionalString(formData, `variantPrompt.${variant.slug}`);
        if (promptDraft) {
          variantPromptDrafts[variant.slug] = promptDraft;
        }

        const weightOverride = readOptionalString(formData, `variantWeight.${variant.slug}`);
        if (weightOverride) {
          const value = Number(weightOverride);
          if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`${variant.label} weight must be a positive number`);
          }
          perVariantWeightOverrides[variant.slug] = value;
        }
      }

      runAction(`decision.draft.${benchmark.id}`, "Promotion decision 已创建", async () => {
        await createCharacterLoraPromotionDecision(benchmark.id, {
          status,
          selectedLoraAssetId: benchmark.loraAssetId,
          selectedCheckpoint,
          defaultRecommendedWeight,
          ...(Object.keys(perVariantWeightOverrides).length > 0 ? { perVariantWeightOverrides } : {}),
          variantPromptDrafts,
          decisionReason: readOptionalString(formData, "decisionReason"),
          returnPoint: readOptionalString(formData, "returnPoint"),
        });
      });
    } catch (error) {
      toast.error("Promotion decision invalid", { description: getErrorMessage(error) });
    }
  }

  function handlePromote(decisionId: string, dryRun: boolean) {
    if (!dryRun && !confirm("确认执行真实发布？")) {
      return;
    }

    runAction(`promote.${decisionId}.${dryRun ? "dry" : "real"}`, dryRun ? "发布预检已完成" : "已发布到预设", async () => {
      await promoteCharacterLoraPreset(decisionId, { dryRun, overwriteExisting: false });
    });
  }

  function handlePersistReport() {
    runAction("report.persist", "Report 已生成", async () => {
      await persistCharacterLoraJobReport(job.id);
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-5">
      <PageHeader
        title={job.characterName}
        description={`${job.triggerToken} / ${job.slug}`}
        actions={
          <Link
            href="/character-lora-training"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-zinc-300 hover:bg-white/5"
          >
            <ArrowLeft className="size-3.5" />
            返回
          </Link>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <StatChip label="状态" value={STATUS_LABEL[job.status] ?? job.status} tone="accent" />
        <StatChip label="Phase" value={job.phase ?? "-"} />
        <StatChip label="Source" value={sourceImages.length} />
        <StatChip label="Sections" value={sections.length} />
        <StatChip label="Keep" value={candidateStatusCounts.keep ?? 0} />
        <StatChip label="GPU" value={gpuLock.current ? "占用" : "空闲"} tone={gpuLock.current ? "warn" : "default"} />
      </div>

      <SectionCard title="Job 概览" subtitle="当前指针和产物根目录。">
        <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400 md:grid-cols-2">
          <Info label="Base checkpoint" value={job.baseCheckpointName ?? "-"} />
          <Info label="Base path" value={job.baseCheckpointPath ?? "-"} mono />
          <Info label="Canonical" value={compactId(job.currentCanonicalVersionId)} mono />
          <Info label="Prompt card" value={compactId(job.currentPromptCardVersionId)} mono />
          <Info label="Dataset" value={compactId(job.selectedDatasetRevisionId)} mono />
          <Info label="Artifact root" value={job.artifactRoot} mono />
        </div>
      </SectionCard>

      <SectionCard title="Source" subtitle="上传原始参考图。">
        <form action={handleUpload} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_150px_90px_auto]">
          <input
            name="file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300"
          />
          <select name="role" defaultValue="source" className="rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white">
            <option value="source">source</option>
            <option value="setting">setting</option>
            <option value="local_reference">local_reference</option>
            <option value="manual_canonical">manual_canonical</option>
            <option value="rerun_reference">rerun_reference</option>
          </select>
          <input name="sortOrder" type="number" defaultValue={sourceImages.length} className="rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white" />
          <ActionButton icon={Upload} label="上传" loading={isBusy("source.upload")} disabled={isPending} />
        </form>
        <SourceImageGrid
          jobId={job.id}
          images={sourceImages}
          disabled={isPending}
          registeringImageId={pendingKey?.startsWith("source.register.") ? pendingKey.replace("source.register.", "") : null}
          onRegisterCandidate={handleRegisterSourceCandidate}
        />
      </SectionCard>

      <SectionCard title="Canonical" subtitle="生成、注册和选择标准图版本。">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-zinc-400">
                provider
                <ProviderSelect value={canonicalProvider} onChange={setCanonicalProvider} disabled={isPending} />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                size
                <ToolParamSelect value={canonicalSize} options={IMAGE_SIZE_OPTIONS} onChange={setCanonicalSize} disabled={isPending} />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                quality
                <ToolParamSelect value={canonicalQuality} options={IMAGE_QUALITY_OPTIONS} onChange={setCanonicalQuality} disabled={isPending} />
              </label>
            </div>
            <label className="grid gap-1 text-xs text-zinc-400">
              visualPrompt
              <textarea
                value={canonicalVisualPrompt}
                onChange={(event) => setCanonicalVisualPrompt(event.target.value)}
                placeholder="本次 canonical 的视觉提示/修正说明，留空则使用默认 prompt"
                className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
              />
            </label>
            <SourceReferencePicker
              images={sourceImages}
              selectedIds={canonicalSourceImageIds}
              onChange={setCanonicalSourceImageIds}
              disabled={isPending}
              emptySelectionText="Canonical 必须至少选择一张参考图。"
            />
            <ActionButton
              type="button"
              icon={ImagePlus}
              label={`入队 ${canonicalProvider}`}
              loading={isBusy("canonical.generate")}
              disabled={isPending || sourceImages.length === 0 || canonicalSourceImageIds.length === 0}
              onClick={handleCanonicalGenerate}
            />
            <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">最近 run: {pendingCanonicalRunId || "-"}</p>
          </div>
          <form action={handleManualCanonicalRegister} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs font-medium text-zinc-200">Manual canonical</div>
            <select
              name="sourceImageId"
              value={selectedManualCanonicalSourceImageId}
              onChange={(event) => setManualCanonicalSourceImageId(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            >
              <option value="">选择 manual_canonical</option>
              {manualCanonicalSourceImages.map((image) => (
                <option key={image.id} value={image.id}>{image.role} / {compactId(image.id)}</option>
              ))}
            </select>
            <textarea
              name="notes"
              placeholder="可选备注，会写入 canonical notes"
              className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
            />
            <p className="text-[11px] text-zinc-500">只注册新版本，不自动设为当前。</p>
            <ActionButton icon={Upload} label="注册版本" loading={isBusy("canonical.manual")} disabled={isPending || !selectedManualCanonicalSourceImageId} />
          </form>
          <DebugPanel summary="Debug: 模拟完成 canonical">
            <form action={handleCanonicalMockComplete} className="grid gap-2">
              <input name="runId" defaultValue={pendingCanonicalRunId} placeholder="generation run id" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white" />
              <select name="sourceImageId" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                <option value="">自动 source</option>
                {sourceImages.map((image) => (
                  <option key={image.id} value={image.id}>{image.role} / {compactId(image.id)}</option>
                ))}
              </select>
              <ActionButton icon={Check} label="模拟完成" loading={isBusy("canonical.complete")} disabled={isPending} />
            </form>
          </DebugPanel>
          <form action={handleCanonicalSelect} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <select
              name="versionId"
              value={canonicalVersionId}
              onChange={(event) => setCanonicalVersionId(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            >
              <option value="">选择 canonical</option>
              {canonicalVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version} / {version.status} / {compactId(version.id)}
                </option>
              ))}
            </select>
            <ActionButton icon={ShieldCheck} label="设为当前" loading={isBusy("canonical.select")} disabled={isPending || !canonicalVersionId} />
          </form>
        </div>
        <CanonicalVersionGrid
          jobId={job.id}
          currentCanonicalVersionId={job.currentCanonicalVersionId}
          versions={canonicalVersions}
          selectedVersionId={canonicalVersionId}
          onSelectVersion={setCanonicalVersionId}
          onSetCurrent={(versionId) => {
            setCanonicalVersionId(versionId);
            runAction("canonical.select", "Canonical 已选择", async () => {
              await selectCharacterLoraCanonicalVersion(job.id, versionId);
            });
          }}
          disabled={isPending}
        />
      </SectionCard>

      <SectionCard title="Prompt Card" subtitle="保存角色特征和最终提示词草稿。">
        <form action={handlePromptCard} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-2">
          <label className="grid gap-1 text-xs text-zinc-400">
            Canonical version
            <select name="canonicalVersionId" defaultValue={job.currentCanonicalVersionId ?? canonicalVersionId} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
              <option value="">未选择</option>
              {canonicalVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version} / {compactId(version.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Trigger
            <input name="triggerToken" defaultValue={job.triggerToken} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          </label>
          <JsonBox label="identityTraits" value={identityTraits} onChange={setIdentityTraits} />
          <JsonBox label="outfitTraits" value={outfitTraits} onChange={setOutfitTraits} />
          <JsonBox label="negativeTraits" value={negativeTraits} onChange={setNegativeTraits} />
          <label className="grid gap-1 text-xs text-zinc-400">
            changeReason
            <input name="changeReason" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400 lg:col-span-2">
            finalPromptDraft
            <textarea name="finalPromptDraft" required defaultValue={currentPrompt?.finalPromptDraft ?? `${job.triggerToken}, ${job.characterName}`} className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          </label>
          <div className="lg:col-span-2">
            <ActionButton icon={Save} label="保存 Prompt Card" loading={isBusy("prompt.create")} disabled={isPending} />
          </div>
        </form>
        <CompactList
          empty="暂无 prompt card"
          items={promptCards.map((card) => `v${card.version} / ${compactId(card.id)} / ${formatDate(card.createdAt)}`)}
        />
      </SectionCard>

      <SectionCard title="Sections" subtitle="从模板实例化，并对单个 section 入队生成候选图。">
        <form action={handleInstantiateSections} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {sectionTemplates.map((template) => (
              <label key={template.key} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-300">
                <input name="templateKeys" type="checkbox" value={template.key} className="size-3.5 accent-sky-400" />
                <span className="min-w-0 truncate">{template.name}</span>
                <span className="ml-auto text-zinc-500">{template.targetKeepCount}/{template.targetCandidateCount}</span>
              </label>
            ))}
          </div>
          <div className="mt-3">
            <ActionButton icon={Database} label="实例化模板" loading={isBusy("sections.instantiate")} disabled={isPending} />
          </div>
        </form>
        <div className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-zinc-200">下一次入队设置</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                默认只影响下面 section 的下一次入队；提升为全局修正会新建 Prompt Card version。
              </div>
            </div>
            <span className="rounded-md border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200">
              {sectionProvider}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs text-zinc-400">
              provider
              <ProviderSelect value={sectionProvider} onChange={setSectionProvider} disabled={isPending} />
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              size
              <ToolParamSelect value={sectionSize} options={IMAGE_SIZE_OPTIONS} onChange={setSectionSize} disabled={isPending} />
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              quality
              <ToolParamSelect value={sectionQuality} options={IMAGE_QUALITY_OPTIONS} onChange={setSectionQuality} disabled={isPending} />
            </label>
          </div>
          <label className="grid gap-1 text-xs text-zinc-400">
            userInstruction
            <textarea
              value={sectionUserInstruction}
              onChange={(event) => setSectionUserInstruction(event.target.value)}
              placeholder="本轮 section 定向重跑说明，留空则使用默认 section prompt"
              className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              type="button"
              icon={FileText}
              label="提升为全局 Prompt Card 修正"
              loading={isBusy("section.promote-prompt-card")}
              disabled={isPending || !canPromoteSectionInstruction}
              onClick={handlePromoteSectionInstructionToPromptCard}
            />
            <span className="text-[11px] text-zinc-500">
              只创建新 Prompt Card version，只影响之后新生成 run，不会改已有 run/dataset。
            </span>
          </div>
          <SourceReferencePicker
            images={sourceImages}
            selectedIds={sectionSourceImageIds}
            onChange={setSectionSourceImageIds}
            disabled={isPending}
            emptySelectionText="未选择时入队请求会省略 sourceImageIds，由服务默认使用 canonical + all source。"
          />
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          {sections.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">暂无 sections</div>
          ) : (
            <div className="divide-y divide-white/10">
              {sections.map((section) => {
                const sectionRuns = generationRunsBySectionId.get(section.id) ?? [];
                const parentRunId = sectionParentRunIds[section.id] ?? "";
                const staleCanonical =
                  Boolean(job.currentCanonicalVersionId && section.canonicalVersionId) &&
                  section.canonicalVersionId !== job.currentCanonicalVersionId;
                const stalePromptCard =
                  Boolean(job.currentPromptCardVersionId && section.promptCardVersionId) &&
                  section.promptCardVersionId !== job.currentPromptCardVersionId;

                return (
                  <div key={section.id} className="grid gap-2 px-3 py-2 text-xs text-zinc-300 md:grid-cols-[1.1fr_0.7fr_1fr_1.15fr_auto] md:items-center">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">{section.name}</span>
                      {(staleCanonical || stalePromptCard) ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {staleCanonical ? (
                            <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                              old canonical
                            </span>
                          ) : null}
                          {stalePromptCard ? (
                            <span className="rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[10px] text-sky-200">
                              old prompt card
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <span>{STATUS_LABEL[section.status] ?? section.status}</span>
                    <span className="text-zinc-500">keep {section.keepCount} / reject {section.rejectCount} / pending {section.pendingCount}</span>
                    <label className="grid gap-1 text-[11px] text-zinc-500">
                      parentRunId
                      <select
                        value={parentRunId}
                        onChange={(event) => setSectionParentRunId(section.id, event.target.value)}
                        disabled={isPending || sectionRuns.length === 0}
                        className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white disabled:opacity-50"
                      >
                        <option value="">无 parent run</option>
                        {sectionRuns.map((run) => (
                          <option key={run.id} value={run.id}>
                            {compactId(run.id)} / {run.status} / {run.provider} / {formatDate(run.createdAt)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <ActionButton
                      type="button"
                      icon={Play}
                      label="入队"
                      loading={isBusy(`section.${section.id}`)}
                      disabled={isPending}
                      onClick={() => handleSectionRun(section.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Review / Dataset" subtitle="审核候选图、编辑 caption、冻结数据集。">
        <div className="mb-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[1fr_1fr_1.2fr]">
          <select value={reviewSectionFilter} onChange={(event) => setReviewSectionFilter(event.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="all">全部小节</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.key} / {section.name}
              </option>
            ))}
          </select>
          <select value={reviewStatusFilter} onChange={(event) => setReviewStatusFilter(event.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            {REVIEW_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <span>显示 {filteredCandidateImages.length} / 选中 {filteredSelectedImageIds.length}</span>
            <MiniButton label="选中当前" onClick={() => setFilteredImagesSelected(true)} disabled={isPending || filteredCandidateImages.length === 0} />
            <MiniButton label="清除当前" onClick={() => setFilteredImagesSelected(false)} disabled={isPending || filteredSelectedImageIds.length === 0} />
          </div>
          <select value={rejectReason} onChange={(event) => setRejectReason(event.target.value as RejectReason)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            {REJECT_REASON_OPTIONS.map((reason) => (
              <option key={reason.value} value={reason.value}>{reason.label}</option>
            ))}
          </select>
          <input
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="拒绝备注，可选"
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
          />
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            重跑建议：{rejectSuggestion}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <ActionButton type="button" icon={Check} label="批量 keep" loading={isBusy("review.keep")} disabled={isPending || filteredSelectedImageIds.length === 0} onClick={() => handleReview(filteredSelectedImageIds, "keep")} />
          <ActionButton type="button" icon={X} label="批量 reject" loading={isBusy("review.reject")} disabled={isPending || filteredSelectedImageIds.length === 0} onClick={() => handleReview(filteredSelectedImageIds, "reject")} />
          <ActionButton type="button" icon={Square} label="批量 excluded" loading={isBusy("review.excluded")} disabled={isPending || filteredSelectedImageIds.length === 0} onClick={() => handleReview(filteredSelectedImageIds, "excluded")} />
          <ActionButton type="button" icon={RefreshCw} label="批量 pending" loading={isBusy("review.pending")} disabled={isPending || filteredSelectedImageIds.length === 0} onClick={() => handleReview(filteredSelectedImageIds, "pending")} />
        </div>
        {candidateImages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">暂无候选图</div>
        ) : filteredCandidateImages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">当前过滤无结果</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCandidateImages.map((image) => (
              <CandidateImageCard
                key={image.id}
                jobId={job.id}
                image={image}
                section={image.sectionId ? sectionById.get(image.sectionId) : undefined}
                generationRun={generationRunById.get(image.generationRunId)}
                currentCanonicalVersionId={job.currentCanonicalVersionId}
                currentPromptCardVersionId={job.currentPromptCardVersionId}
                canonicalVersionById={canonicalVersionById}
                canonicalVersionByArtifactId={canonicalVersionByArtifactId}
                promptCardById={promptCardById}
                selected={selectedImageIds.includes(image.id)}
                defaultCaption={`${job.triggerToken}, ${job.characterName}`}
                isPending={isPending}
                captionLoading={isBusy(`caption.${image.id}`)}
                onSelectedChange={(selected) => setImageSelected(image.id, selected)}
                onCaption={(formData) => handleCaption(image.id, formData)}
                onReview={(status) => handleReview([image.id], status)}
              />
            ))}
          </div>
        )}
        <form action={handleFreezeDataset} className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_100px_120px_auto]">
          <input name="captionStrategy" defaultValue={job.captionStrategy} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <input name="repeatCount" type="number" min={1} defaultValue={1} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <input name="sourceWeight" type="number" min={1} step="0.1" placeholder="source weight" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <ActionButton icon={Database} label="冻结 Dataset" loading={isBusy("dataset.freeze")} disabled={isPending} />
        </form>
        <CompactList
          empty="暂无 dataset revision"
          items={datasetRevisions.map((revision) => {
            const lineage = [
              job.currentCanonicalVersionId &&
              revision.canonicalVersionId &&
              revision.canonicalVersionId !== job.currentCanonicalVersionId
                ? "old canonical"
                : null,
              job.currentPromptCardVersionId &&
              revision.promptCardVersionId &&
              revision.promptCardVersionId !== job.currentPromptCardVersionId
                ? "old prompt card"
                : null,
            ].filter(Boolean);
            return [
              `v${revision.version}`,
              revision.status,
              `item ${revision.itemCount}`,
              compactId(revision.id),
              ...lineage,
            ].join(" / ");
          })}
        />
      </SectionCard>

      <SectionCard title="Training" subtitle="用最新 frozen dataset 入队训练，可查看 GPU 锁并取消运行。">
        {gpuLock.current ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{gpuLock.current.taskType} / {gpuLock.current.ownerId}</span>
          </div>
        ) : null}
        <form action={handleTrainingEnqueue} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-3 lg:grid-cols-[1fr_130px_130px_160px_auto]">
          <select name="datasetRevisionId" defaultValue={latestFrozenRevision?.id ?? ""} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="">选择 dataset revision</option>
            {datasetRevisions.map((revision) => (
              <option key={revision.id} value={revision.id}>v{revision.version} / {revision.status}</option>
            ))}
          </select>
          <select name="launcher" defaultValue="sd-scripts" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="sd-scripts">sd-scripts</option>
            <option value="kohya">kohya</option>
          </select>
          <select name="configProfile" defaultValue="standard" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="conservative">conservative</option>
            <option value="standard">standard</option>
            <option value="strong">strong</option>
          </select>
          <select name="queuePolicy" defaultValue="reject_when_busy" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="reject_when_busy">reject busy</option>
            <option value="queue_when_busy">queue busy</option>
            <option value="ignore_busy">ignore busy</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input name="allowBusy" type="checkbox" className="size-3.5 accent-amber-400" />
            allow busy
          </label>
          <details open className="rounded-lg border border-white/10 bg-black/20 p-3 md:col-span-3 lg:col-span-5">
            <summary className="cursor-pointer text-xs font-medium text-zinc-200">Post-training Benchmark</summary>
            <BenchmarkTemplateStatusPanel
              status={benchmarkTemplateStatus}
              loading={isBusy("benchmark.template.ensure")}
              onEnsure={handleEnsureBenchmarkTemplate}
            />
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input name="postTrainingBenchmarkEnabled" type="checkbox" defaultChecked className="size-3.5 accent-emerald-400" />
                auto benchmark
              </label>
              <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">
                Checkpoints
                <input name="postTrainingBenchmarkCheckpointMatrix" defaultValue={job.baseCheckpointName ?? "default"} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Weights
                <input name="postTrainingBenchmarkWeightMatrix" defaultValue={DEFAULT_BENCHMARK_WEIGHT_MATRIX_TEXT} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Queue policy
                <select name="postTrainingBenchmarkQueuePolicy" defaultValue="queue_when_busy" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                  <option value="queue_when_busy">queue busy</option>
                  <option value="reject_when_busy">reject busy</option>
                  <option value="ignore_busy">ignore busy</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Template ID
                <input
                  name="postTrainingBenchmarkTemplateId"
                  value={postTrainingBenchmarkTemplateId}
                  onChange={(event) => setPostTrainingBenchmarkTemplateId(event.target.value)}
                  placeholder="optional"
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">
                LoRA asset name
                <input name="postTrainingBenchmarkLoraAssetName" defaultValue={`${job.characterName} LoRA`} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input name="postTrainingBenchmarkRegisterLoraAsset" type="checkbox" defaultChecked className="size-3.5 accent-emerald-400" />
                register asset
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input name="postTrainingBenchmarkCopyToCharacterDir" type="checkbox" defaultChecked className="size-3.5 accent-emerald-400" />
                copy file
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input name="postTrainingBenchmarkDryRun" type="checkbox" className="size-3.5 accent-sky-400" />
                dryRun
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input name="postTrainingBenchmarkSkipQueue" type="checkbox" className="size-3.5 accent-sky-400" />
                skipQueue
              </label>
            </div>
          </details>
          <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2 lg:col-span-3">
            Train text encoder
            <select name="trainTextEncoder" defaultValue="" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
              <option value="">Profile default</option>
              <option value="true">override: train text encoder</option>
              <option value="false">override: freeze text encoder</option>
            </select>
          </label>
          <details className="rounded-lg border border-white/10 bg-black/20 p-3 md:col-span-3 lg:col-span-5">
            <summary className="cursor-pointer text-xs font-medium text-zinc-200">Advanced optional overrides</summary>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
              <input name="enableAdvancedOverrides" type="checkbox" className="size-3.5 accent-sky-400" />
              Apply advanced fields below. Empty fields keep the selected profile defaults.
            </label>
            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <TrainingNumberInput name="targetSteps" label="Target steps" placeholder="2000" integer />
              <TrainingNumberInput name="rank" label="Rank" placeholder="32" integer />
              <TrainingNumberInput name="alpha" label="Alpha" placeholder="16" integer />
              <TrainingNumberInput name="resolution" label="Resolution" placeholder="1024" integer />
              <TrainingNumberInput name="batchSize" label="Batch size" placeholder="1" integer />
              <TrainingNumberInput name="gradientAccumulation" label="Grad accumulation" placeholder="1" integer />
              <TrainingNumberInput name="saveInterval" label="Save interval" placeholder="500" integer />
              <TrainingNumberInput name="unetLearningRate" label="UNet LR" placeholder="0.0001" step="0.000001" />
              <TrainingNumberInput name="textEncoderLearningRate" label="Text encoder LR" placeholder="0.00002" step="0.000001" />
              <label className="grid gap-1 text-xs text-zinc-400">
                Precision
                <select name="precision" defaultValue="" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                  {TRAINING_PRECISION_OPTIONS.map((option) => (
                    <option key={option || "default"} value={option}>{option || "Profile default"}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Bucket
                <select name="bucket" defaultValue="" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                  <option value="">Profile default</option>
                  <option value="true">override: enabled</option>
                  <option value="false">override: disabled</option>
                </select>
              </label>
            </div>
          </details>
          <details className="rounded-lg border border-white/10 bg-black/20 p-3 md:col-span-3 lg:col-span-5">
            <summary className="cursor-pointer text-xs font-medium text-zinc-200">Expert optional overrides</summary>
            <label className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
              <input name="enableExpertOverrides" type="checkbox" className="size-3.5 accent-rose-400" />
              Apply expert fields below. Use only when the launcher profile needs a precise override.
            </label>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <TrainingTextInput name="optimizer" label="Optimizer" placeholder="adamw8bit" />
              <TrainingTextInput name="lrScheduler" label="Scheduler" placeholder="cosine" />
              <TrainingTextInput name="networkModule" label="Network module" placeholder="networks.lora" />
              <TrainingNumberInput name="seed" label="Seed" placeholder="optional" integer min={0} />
              <TrainingNumberInput name="minBucketResolution" label="Min bucket" placeholder="512" integer />
              <TrainingNumberInput name="maxBucketResolution" label="Max bucket" placeholder="1536" integer />
              <TrainingNumberInput name="minSnrGamma" label="minSNR gamma" placeholder="5" step="0.1" />
              <TrainingNumberInput name="noiseOffset" label="Noise offset" placeholder="0.05" step="0.01" min={0} />
              <TrainingNumberInput name="clipSkip" label="Clip skip" placeholder="2" integer />
              <label className="grid gap-1 text-xs text-zinc-400">
                Cache latents
                <select name="cacheLatents" defaultValue="" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                  <option value="">Leave unset</option>
                  <option value="true">override: true</option>
                  <option value="false">override: false</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Cache text encoder
                <select name="cacheTextEncoderOutputs" defaultValue="" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
                  <option value="">Leave unset</option>
                  <option value="true">override: true</option>
                  <option value="false">override: false</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-zinc-400 md:col-span-3">
                Extra expert JSON
                <textarea name="expertJson" placeholder="{ }" className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white" />
              </label>
            </div>
          </details>
          <p className="text-xs text-zinc-500 md:col-span-3 lg:col-span-5">Profiles still produce a full resolved config. Optional layers only send fields you enable or fill.</p>
          <div className="md:col-span-3 lg:col-span-5">
            <ActionButton icon={FlaskConical} label="入队训练" loading={isBusy("training.enqueue")} disabled={isPending || !latestFrozenRevision} />
          </div>
        </form>
        <RunList
          runs={trainingRuns.map((run) => ({
            id: run.id,
            status: run.status,
            primary: `${run.launcher} / ${run.currentStep ?? 0}/${run.targetSteps ?? "-"}`,
            secondary: `${compactId(run.datasetRevisionId)} / ${run.outputDir}`,
            action: run.status === "queued" || run.status === "running"
              ? (
                  <ActionButton
                    type="button"
                    icon={X}
                    label="取消"
                    loading={isBusy(`training.cancel.${run.id}`)}
                    disabled={isPending}
                    onClick={() => handleCancelTraining(run.id)}
                  />
                )
              : null,
          }))}
          empty="暂无 training run"
        />
      </SectionCard>

      <SectionCard title="Benchmark / Promotion" subtitle="训练完成后做基准测试、创建发布决策并发布到预设。">
        <BenchmarkTemplateStatusPanel
          status={benchmarkTemplateStatus}
          loading={isBusy("benchmark.template.ensure")}
          onEnsure={handleEnsureBenchmarkTemplate}
        />
        <form action={handleBenchmarkEnqueue} className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_120px_120px_1fr_auto_auto_auto]">
          <select name="trainingRunId" defaultValue={latestDoneTraining?.id ?? ""} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="">选择 done training</option>
            {trainingRuns.map((run) => (
              <option key={run.id} value={run.id}>{compactId(run.id)} / {run.status}</option>
            ))}
          </select>
          <input name="checkpointMatrix" defaultValue={job.baseCheckpointName ?? "default"} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <input name="weightMatrix" defaultValue={DEFAULT_BENCHMARK_WEIGHT_MATRIX_TEXT} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <select name="queuePolicy" defaultValue="queue_when_busy" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="queue_when_busy">queue busy</option>
            <option value="reject_when_busy">reject busy</option>
            <option value="ignore_busy">ignore busy</option>
          </select>
          <input
            name="templateId"
            value={benchmarkTemplateId}
            onChange={(event) => setBenchmarkTemplateId(event.target.value)}
            placeholder="Template ID"
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input name="copyToCharacterDir" type="checkbox" defaultChecked className="size-3.5 accent-emerald-400" />
            copy file
          </label>
          <div className="md:col-span-2 lg:col-span-8">
            <DebugPanel summary="Debug: benchmark enqueue options">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input name="dryRun" type="checkbox" className="size-3.5 accent-sky-400" />
                  dryRun
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input name="skipQueue" type="checkbox" className="size-3.5 accent-sky-400" />
                  skipQueue
                </label>
              </div>
            </DebugPanel>
          </div>
          <div className="md:col-span-2 lg:col-span-8">
            <ActionButton icon={Send} label="入队 Benchmark" loading={isBusy("benchmark.enqueue")} disabled={isPending || !latestDoneTraining} />
          </div>
        </form>
        <RunList
          runs={benchmarkRuns.map((run) => {
            const selectedCheckpoint = getBenchmarkDefaultCheckpoint(run, job) || undefined;
            const approval = getBenchmarkApprovalState(run, selectedCheckpoint);
            const canCreateDecision = run.status === "done" && Boolean(run.loraAssetId);
            return {
              id: run.id,
              status: run.status,
              primary: `weight ${Array.isArray(run.weightMatrix) ? run.weightMatrix.join(",") : "-"} / rec ${run.recommendedWeight ?? "-"}`,
              secondary: `asset ${compactId(run.loraAssetId)} / training ${compactId(run.trainingRunId)}`,
              action: (
                <div className="flex flex-wrap gap-1">
                  {run.status !== "done" ? (
                    <DebugPanel summary="Debug: 模拟完成" compact>
                      <ActionButton type="button" icon={RefreshCw} label="模拟完成" loading={isBusy(`benchmark.complete.${run.id}`)} disabled={isPending} onClick={() => handleBenchmarkMockComplete(run.id)} />
                    </DebugPanel>
                  ) : null}
                  <MiniButton
                    label="approved"
                    onClick={() => handleDecision(run, "approved")}
                    disabled={isPending || !canCreateDecision || !approval.canApprove}
                    title={approval.blocker ?? undefined}
                  />
                  <MiniButton label="rejected" onClick={() => handleDecision(run, "rejected")} disabled={isPending || !canCreateDecision} />
                  {canCreateDecision && !approval.canApprove ? (
                    <div className="basis-full text-[11px] text-amber-300">approved blocked: {approval.blocker}</div>
                  ) : null}
                </div>
              ),
            };
          })}
          empty="暂无 benchmark run"
        />
        <form
          key={selectedPromotionBenchmark?.id ?? "empty-promotion-draft"}
          action={handleDecisionDraft}
          className="mt-3 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-zinc-100">Promotion decision draft</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Use a done benchmark with a LoRA asset, then review checkpoint, weight, prompts, and overrides.
              </div>
            </div>
            <ActionButton
              icon={ShieldCheck}
              label="Create decision"
              loading={selectedPromotionBenchmark ? isBusy(`decision.draft.${selectedPromotionBenchmark.id}`) : false}
              disabled={isPending || !selectedPromotionBenchmark || isPromotionDraftApprovalBlocked}
            />
          </div>
          <div className="grid gap-2 lg:grid-cols-[1.4fr_120px_1fr_160px_150px]">
            <label className="grid gap-1 text-xs text-zinc-400">
              Benchmark run
              <select
                name="benchmarkRunId"
                value={selectedPromotionBenchmark?.id ?? ""}
                onChange={(event) => setPromotionBenchmarkRunId(event.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                <option value="">Select done run with asset</option>
                {promotionBenchmarkOptions.map((run) => (
                  <option key={run.id} value={run.id}>
                    {compactId(run.id)} / rec {run.recommendedWeight ?? "-"} / asset {compactId(run.loraAssetId)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              Status
              <select
                name="status"
                value={promotionDecisionStatus}
                onChange={(event) => setPromotionDecisionStatus(event.target.value as PromotionDecisionStatus)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              Checkpoint
              <input
                name="selectedCheckpoint"
                defaultValue={selectedPromotionCheckpoint}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              Default weight
              <input
                name="defaultRecommendedWeight"
                type="number"
                min="0.0001"
                step="any"
                required
                defaultValue={getBenchmarkRecommendedWeight(selectedPromotionBenchmark)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              />
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              Return point
              <select
                name="returnPoint"
                defaultValue="benchmark_review"
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
              >
                {PROMOTION_RETURN_POINTS.map((point) => (
                  <option key={point} value={point}>
                    {point}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!selectedPromotionBenchmark ? (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              No eligible benchmark yet. Complete a benchmark and register/carry a LoRA asset before creating a promotion decision.
            </div>
          ) : null}
          {selectedPromotionBenchmark && isPromotionDraftApprovalBlocked ? (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Approved decision blocked: {selectedPromotionApproval?.blocker ?? "missing completed benchmark evidence"}. Rejected remains available.
            </div>
          ) : null}
          <label className="grid gap-1 text-xs text-zinc-400">
            Decision reason
            <textarea
              name="decisionReason"
              placeholder="Optional manual review note"
              className="min-h-16 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
            />
          </label>
          <div className="grid gap-2">
            <div className="text-xs font-medium text-zinc-200">Variant prompt / weight review</div>
            <div className="grid gap-2">
              {PROMOTION_VARIANTS.map((variant) => (
                <div key={variant.slug} className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-2 md:grid-cols-[180px_1fr_140px] md:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-zinc-200">{variant.label}</div>
                    <div className="truncate font-mono text-[11px] text-zinc-500">{variant.slug}</div>
                  </div>
                  <input
                    name={`variantPrompt.${variant.slug}`}
                    placeholder="Prompt draft override (optional)"
                    className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                  />
                  <input
                    name={`variantWeight.${variant.slug}`}
                    type="number"
                    min="0.0001"
                    step="any"
                    placeholder="Weight override"
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
                  />
                </div>
              ))}
            </div>
          </div>
        </form>
        <RunList
          runs={promotionDecisions.map((decision) => ({
            id: decision.id,
            status: decision.status,
            primary: `weight ${decision.defaultRecommendedWeight} / asset ${compactId(decision.selectedLoraAssetId)}`,
            secondary: `benchmark ${compactId(decision.benchmarkRunId)} / preset ${compactId(decision.promotedPresetId)}`,
            action: (
              <div className="flex flex-wrap gap-1">
                <MiniButton label="dryRun" onClick={() => handlePromote(decision.id, true)} disabled={isPending} />
                <MiniButton label="真实发布" onClick={() => handlePromote(decision.id, false)} disabled={isPending || decision.status !== "approved"} />
              </div>
            ),
          }))}
          empty="暂无 promotion decision"
        />
      </SectionCard>

      <SectionCard title="Report / Diagnostics" subtitle="Job 级全链路 report 与诊断入口。">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="grid gap-2 text-xs text-zinc-400">
              <Info label="Return point" value={report.diagnosticSummary.recommendedReturnPoint} />
              <Info label="Risk" value={report.diagnosticSummary.risk} />
              <Info label="Latest report" value={report.latestReportArtifacts[0]?.relativePath ?? "-"} mono />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                type="button"
                icon={FileText}
                label="生成 report"
                loading={isBusy("report.persist")}
                disabled={isPending}
                onClick={handlePersistReport}
              />
              <Link
                href={`/api/character-lora-training/jobs/${job.id}/report`}
                target="_blank"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
              >
                JSON
              </Link>
              <Link
                href={`/api/character-lora-training/jobs/${job.id}/report?format=markdown`}
                target="_blank"
                className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
              >
                Markdown
              </Link>
            </div>
          </div>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400 sm:grid-cols-2">
            <Info label="Source" value={String(report.diagnosticSummary.coverage.sourceImages)} />
            <Info label="Canonical" value={String(report.diagnosticSummary.coverage.canonicalVersions)} />
            <Info label="Prompt cards" value={String(report.diagnosticSummary.coverage.promptCardVersions)} />
            <Info label="Candidates" value={String(report.diagnosticSummary.coverage.candidateImages)} />
            <Info label="Dataset items" value={String(report.diagnosticSummary.coverage.datasetItems)} />
            <Info label="Training runs" value={String(report.diagnosticSummary.coverage.trainingRuns)} />
            <Info label="Benchmarks" value={String(report.diagnosticSummary.coverage.benchmarkRuns)} />
            <Info label="Promotions" value={String(report.diagnosticSummary.coverage.promotionDecisions)} />
          </div>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <DiagnosticList title="Reasons" items={report.diagnosticSummary.reasons} />
          <DiagnosticList title="Evidence" items={report.diagnosticSummary.evidence} />
          <DiagnosticList title="Actions" items={report.diagnosticSummary.actions} />
        </div>
      </SectionCard>
    </div>
  );
}

function TrainingNumberInput({
  name,
  label,
  placeholder,
  integer = false,
  min,
  step,
}: {
  name: string;
  label: string;
  placeholder: string;
  integer?: boolean;
  min?: number;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-zinc-400">
      {label}
      <input
        name={name}
        type="number"
        min={min ?? (integer ? 1 : undefined)}
        step={integer ? 1 : step ?? "any"}
        placeholder={placeholder}
        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
      />
    </label>
  );
}

function TrainingTextInput({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1 text-xs text-zinc-400">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
      />
    </label>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={`mt-1 truncate text-zinc-200 ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function JsonBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-xs text-zinc-400">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white"
      />
    </label>
  );
}

function ProviderSelect({
  value,
  onChange,
  disabled,
}: {
  value: ImageProvider;
  onChange: (value: ImageProvider) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ImageProvider)}
      disabled={disabled}
      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white disabled:opacity-50"
    >
      {IMAGE_PROVIDERS.map((provider) => (
        <option key={provider.value} value={provider.value}>
          {provider.label}
        </option>
      ))}
    </select>
  );
}

function ToolParamSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      disabled={disabled}
      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function SourceReferencePicker({
  images,
  selectedIds,
  onChange,
  disabled,
  emptySelectionText,
}: {
  images: CharacterLoraSourceImage[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  emptySelectionText: string;
}) {
  const selectedSet = new Set(selectedIds);
  const allIds = images.map((image) => image.id);

  function setSelected(imageId: string, selected: boolean) {
    onChange(selected ? uniqueIds([...selectedIds, imageId]) : selectedIds.filter((id) => id !== imageId));
  }

  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-200">source/reference images</span>
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span>{selectedIds.length}/{images.length}</span>
          <MiniButton label="全选" onClick={() => onChange(allIds)} disabled={disabled || images.length === 0} />
          <MiniButton label="清空" onClick={() => onChange([])} disabled={disabled || selectedIds.length === 0} />
        </div>
      </div>
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 py-4 text-center text-xs text-zinc-500">暂无 source image</div>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2">
          {images.map((image) => (
            <label key={image.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={selectedSet.has(image.id)}
                onChange={(event) => setSelected(image.id, event.target.checked)}
                disabled={disabled}
                className="size-3.5 accent-sky-400"
              />
              <span className="min-w-0 truncate">{image.role}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-500">{compactId(image.id)}</span>
            </label>
          ))}
        </div>
      )}
      {selectedIds.length === 0 ? <div className="text-[11px] text-amber-200">{emptySelectionText}</div> : null}
    </div>
  );
}

function SourceImageGrid({
  jobId,
  images,
  disabled,
  registeringImageId,
  onRegisterCandidate,
}: {
  jobId: string;
  images: CharacterLoraSourceImage[];
  disabled: boolean;
  registeringImageId: string | null;
  onRegisterCandidate: (sourceImageId: string) => void;
}) {
  if (images.length === 0) {
    return <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">暂无 source image</div>;
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {images.map((image) => (
        <div key={image.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
          <ArtifactThumb jobId={jobId} relativePath={image.relativePath} alt={image.role} />
          <div className="space-y-1 p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-100">{image.role}</span>
              <span className="font-mono text-zinc-500">{compactId(image.id)}</span>
            </div>
            <div className="text-zinc-500">{image.width ?? "?"}x{image.height ?? "?"}</div>
            <div className="truncate font-mono text-[11px] text-zinc-500">{image.relativePath}</div>
            <ActionButton
              type="button"
              icon={ImagePlus}
              label="注册为 candidate"
              loading={registeringImageId === image.id}
              disabled={disabled}
              onClick={() => onRegisterCandidate(image.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CanonicalVersionGrid({
  jobId,
  currentCanonicalVersionId,
  versions,
  selectedVersionId,
  disabled,
  onSelectVersion,
  onSetCurrent,
}: {
  jobId: string;
  currentCanonicalVersionId: string | null;
  versions: CharacterLoraJobReport["canonicalVersions"];
  selectedVersionId: string;
  disabled: boolean;
  onSelectVersion: (versionId: string) => void;
  onSetCurrent: (versionId: string) => void;
}) {
  if (versions.length === 0) {
    return <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">暂无 canonical version</div>;
  }

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {versions.map((version) => {
        const relativePath = version.artifact?.relativePath ?? null;
        const isCurrent = version.id === currentCanonicalVersionId;
        const isSelected = version.id === selectedVersionId;

        return (
          <div key={version.id} className={`overflow-hidden rounded-lg border bg-white/[0.03] ${isCurrent ? "border-sky-400/60" : isSelected ? "border-white/25" : "border-white/10"}`}>
            <ArtifactThumb jobId={jobId} relativePath={relativePath} alt={`canonical v${version.version}`} />
            <div className="space-y-2 p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-zinc-100">v{version.version}</span>
                <span className={isCurrent ? "text-sky-300" : "text-zinc-500"}>{isCurrent ? "当前" : STATUS_LABEL[version.status] ?? version.status}</span>
              </div>
              <div className="truncate font-mono text-[11px] text-zinc-500">{compactId(version.id)} / {formatDate(version.createdAt)}</div>
              {version.notes ? <div className="line-clamp-2 text-zinc-500">{version.notes}</div> : null}
              <div className="flex flex-wrap gap-1">
                <MiniButton label="选择" onClick={() => onSelectVersion(version.id)} disabled={disabled} />
                <MiniButton label="设当前" onClick={() => onSetCurrent(version.id)} disabled={disabled || isCurrent} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CandidateImageCard({
  jobId,
  image,
  section,
  generationRun,
  currentCanonicalVersionId,
  currentPromptCardVersionId,
  canonicalVersionById,
  canonicalVersionByArtifactId,
  promptCardById,
  selected,
  defaultCaption,
  isPending,
  captionLoading,
  onSelectedChange,
  onCaption,
  onReview,
}: {
  jobId: string;
  image: CharacterLoraCandidateImage;
  section?: CharacterLoraSection;
  generationRun?: CharacterLoraJobReport["generationRuns"][number];
  currentCanonicalVersionId: string | null;
  currentPromptCardVersionId: string | null;
  canonicalVersionById: Map<string, CharacterLoraJobReport["canonicalVersions"][number]>;
  canonicalVersionByArtifactId: Map<string, CharacterLoraJobReport["canonicalVersions"][number]>;
  promptCardById: Map<string, CharacterLoraPromptCard>;
  selected: boolean;
  defaultCaption: string;
  isPending: boolean;
  captionLoading: boolean;
  onSelectedChange: (selected: boolean) => void;
  onCaption: (formData: FormData) => void;
  onReview: (status: ReviewWritableStatus) => void;
}) {
  const rejectReasons = extractRejectReasons(image.rejectReasons);
  const sectionCanonicalVersion = section ? canonicalVersionById.get(section.canonicalVersionId) : null;
  const runCanonicalVersion = generationRun
    ? canonicalVersionByArtifactId.get(getRunCanonicalArtifactId(generationRun.inputImages) ?? "")
    : null;
  const lineageCanonicalVersion = runCanonicalVersion ?? sectionCanonicalVersion;
  const sectionPromptCard = section ? promptCardById.get(section.promptCardVersionId) : null;
  const staleCanonical = Boolean(
    lineageCanonicalVersion?.id &&
    currentCanonicalVersionId &&
    lineageCanonicalVersion.id !== currentCanonicalVersionId,
  );
  const stalePromptCard = Boolean(
    section?.promptCardVersionId &&
    currentPromptCardVersionId &&
    section.promptCardVersionId !== currentPromptCardVersionId,
  );
  const lineageChips = [
    lineageCanonicalVersion
      ? {
          label: `${staleCanonical ? "old " : ""}${runCanonicalVersion ? "run" : "section"} canonical v${lineageCanonicalVersion.version}`,
          className: staleCanonical
            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        }
      : null,
    sectionPromptCard
      ? {
          label: `${stalePromptCard ? "old " : ""}prompt v${sectionPromptCard.version}`,
          className: stalePromptCard
            ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
            : "border-white/10 bg-white/[0.04] text-zinc-300",
        }
      : null,
    generationRun?.parentRunId
      ? {
          label: `parent ${compactId(generationRun.parentRunId)}`,
          className: "border-violet-400/25 bg-violet-500/10 text-violet-200",
        }
      : null,
  ].filter((chip): chip is { label: string; className: string } => Boolean(chip));

  return (
    <div className={`overflow-hidden rounded-lg border bg-white/[0.03] ${selected ? "border-sky-400/60" : "border-white/10"}`}>
      <div className="relative">
        <ArtifactThumb jobId={jobId} relativePath={image.relativePath} alt={image.id} />
        <label className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border border-black/40 bg-black/70 px-2 py-1 text-[11px] text-white">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectedChange(event.target.checked)}
            className="size-3.5 accent-sky-400"
          />
          选中
        </label>
        <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[11px] text-white">
          {STATUS_LABEL[image.reviewStatus] ?? image.reviewStatus}
        </span>
      </div>
      <div className="space-y-2 p-3 text-xs">
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-100">{section ? `${section.key} / ${section.name}` : "Source candidate"}</div>
          <div className="truncate font-mono text-[11px] text-zinc-500">{compactId(image.id)} / {image.width ?? "?"}x{image.height ?? "?"}</div>
          <div className="truncate font-mono text-[11px] text-zinc-500">
            run {compactId(image.generationRunId)} / {generationRun?.kind ?? "unknown"} / {generationRun?.provider ?? "unknown"} / {generationRun?.status ?? "unknown"}
          </div>
          <div className="truncate font-mono text-[11px] text-zinc-500">{image.relativePath}</div>
        </div>
        {lineageChips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {lineageChips.map((chip) => (
              <span key={chip.label} className={`rounded border px-1.5 py-0.5 text-[10px] ${chip.className}`}>
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
        {lineageCanonicalVersion?.artifact?.relativePath ? (
          <a
            href={buildArtifactImageUrl(jobId, lineageCanonicalVersion.artifact.relativePath)}
            target="_blank"
            rel="noreferrer"
            className="grid grid-cols-[44px_1fr] items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- compact compare thumb uses the same artifact route as the main thumbnail. */}
            <img
              src={buildArtifactImageUrl(jobId, lineageCanonicalVersion.artifact.relativePath, { w: 96, q: 60 })}
              alt={`canonical v${lineageCanonicalVersion.version}`}
              loading="lazy"
              className="size-11 rounded-md bg-black/30 object-cover"
            />
            <span className="min-w-0">
              <span className="block text-[11px] text-zinc-300">{runCanonicalVersion ? "run" : "section"} canonical v{lineageCanonicalVersion.version}</span>
              <span className="block truncate font-mono text-[10px] text-zinc-500">{lineageCanonicalVersion.artifact.relativePath}</span>
            </span>
          </a>
        ) : null}
        {rejectReasons.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {rejectReasons.map((reason) => (
              <span key={reason} className="rounded-md border border-rose-400/20 bg-rose-500/10 px-1.5 py-0.5 text-[11px] text-rose-200">
                {formatRejectReason(reason)}
              </span>
            ))}
          </div>
        ) : null}
        <form action={onCaption} className="grid gap-2">
          <input
            name="captionDraft"
            defaultValue={image.captionDraft ?? defaultCaption}
            className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white"
          />
          <ActionButton icon={Save} label="Caption" loading={captionLoading} disabled={isPending} />
        </form>
        <div className="grid grid-cols-2 gap-1">
          <MiniButton label="keep" onClick={() => onReview("keep")} disabled={isPending} />
          <MiniButton label="reject" onClick={() => onReview("reject")} disabled={isPending} />
          <MiniButton label="exclude" onClick={() => onReview("excluded")} disabled={isPending} />
          <MiniButton label="pending" onClick={() => onReview("pending")} disabled={isPending} />
        </div>
      </div>
    </div>
  );
}

function ArtifactThumb({
  jobId,
  relativePath,
  alt,
}: {
  jobId: string;
  relativePath: string | null | undefined;
  alt: string;
}) {
  if (!relativePath) {
    return (
      <div className="flex aspect-square items-center justify-center bg-black/30 text-xs text-zinc-600">
        无图片
      </div>
    );
  }

  return (
    <a href={buildArtifactImageUrl(jobId, relativePath)} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails are served by the artifact route with sharp resizing. */}
      <img
        src={buildArtifactImageUrl(jobId, relativePath, { w: 360, q: 72 })}
        alt={alt}
        loading="lazy"
        className="aspect-square w-full bg-black/30 object-cover"
      />
    </a>
  );
}

function buildArtifactImageUrl(jobId: string, relativePath: string, options?: { w?: number; q?: number }) {
  const params = new URLSearchParams({ path: relativePath });
  if (options?.w) params.set("w", String(options.w));
  if (options?.q) params.set("q", String(options.q));

  return `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/artifacts/image?${params.toString()}`;
}

function extractRejectReasons(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getRunCanonicalArtifactId(inputImages: unknown) {
  if (!Array.isArray(inputImages)) return null;
  const canonicalInput = inputImages.find((image) => {
    if (!image || typeof image !== "object" || Array.isArray(image)) return false;
    return (image as { role?: unknown }).role === "canonical";
  }) as { artifactId?: unknown } | undefined;

  return typeof canonicalInput?.artifactId === "string" ? canonicalInput.artifactId : null;
}

function formatRejectReason(value: string) {
  return REJECT_REASON_OPTIONS.find((reason) => reason.value === value)?.label ?? value;
}

function BenchmarkTemplateStatusPanel({
  status,
  loading,
  onEnsure,
}: {
  status: CharacterLoraBenchmarkTemplateStatus;
  loading?: boolean;
  onEnsure: () => void;
}) {
  const template = status.template;
  const ready = Boolean(template?.isUsable);

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-300 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={ready ? "text-emerald-300" : "text-amber-300"}>
            {ready ? "Benchmark template ready" : template ? "Benchmark template needs review" : "Benchmark template missing"}
          </span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
            sections {template?.sectionCount ?? 0}/{status.requiredSectionCount}
          </span>
        </div>
        <div className="truncate font-mono text-[11px] text-zinc-500">
          {template ? `${template.name} / ${template.id}` : status.requiredTemplateNames.join(" / ")}
        </div>
      </div>
      <ActionButton
        type="button"
        icon={Database}
        label={template ? "确保模板" : "创建模板"}
        loading={loading}
        disabled={loading}
        onClick={onEnsure}
      />
    </div>
  );
}

function DebugPanel({ summary, children, compact }: { summary: string; children: ReactNode; compact?: boolean }) {
  return (
    <details className={`basis-full rounded-lg border border-amber-400/20 bg-amber-500/[0.06] ${compact ? "px-2 py-1.5" : "p-3"}`}>
      <summary className={`${compact ? "text-[11px]" : "text-xs"} cursor-pointer select-none font-medium text-amber-100`}>
        {summary}
      </summary>
      <div className={compact ? "mt-2" : "mt-3"}>
        {children}
      </div>
    </details>
  );
}

function ActionButton({
  label,
  icon: Icon,
  loading,
  disabled,
  type = "submit",
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}
      {label}
    </button>
  );
}

function MiniButton({ label, onClick, disabled, title }: { label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 rounded-md border border-white/10 px-2 text-[11px] text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function CompactList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">{empty}</div>;
  }

  return (
    <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
      {items.map((item) => (
        <div key={item} className="truncate px-3 py-2 text-xs text-zinc-400">
          {item}
        </div>
      ))}
    </div>
  );
}

function DiagnosticList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-xs font-medium text-zinc-200">{title}</div>
      <ul className="space-y-1 text-xs text-zinc-400">
        {(items.length > 0 ? items : ["-"]).map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunList({
  runs,
  empty,
}: {
  runs: Array<{ id: string; status: string; primary: string; secondary: string; action?: ReactNode }>;
  empty: string;
}) {
  if (runs.length === 0) {
    return <div className="mt-3 rounded-lg border border-dashed border-white/10 py-6 text-center text-sm text-zinc-500">{empty}</div>;
  }

  return (
    <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10">
      {runs.map((run) => (
        <div key={run.id} className="grid gap-2 px-3 py-3 text-xs text-zinc-300 md:grid-cols-[0.7fr_1fr_1.4fr_auto] md:items-center">
          <span className="font-mono">{compactId(run.id)}</span>
          <span>{STATUS_LABEL[run.status] ?? run.status}</span>
          <span className="min-w-0">
            <span className="block truncate text-zinc-200">{run.primary}</span>
            <span className="block truncate text-zinc-500">{run.secondary}</span>
          </span>
          {run.action}
        </div>
      ))}
    </div>
  );
}

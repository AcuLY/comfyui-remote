"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
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
  enqueueCharacterLoraBenchmarkRun,
  enqueueCharacterLoraCanonicalGenerationRun,
  enqueueCharacterLoraSectionGenerationRun,
  enqueueCharacterLoraTrainingRun,
  freezeCharacterLoraDataset,
  instantiateCharacterLoraJobSections,
  mockCompleteCharacterLoraBenchmarkRun,
  mockCompleteCharacterLoraCanonicalGenerationRun,
  promoteCharacterLoraPreset,
  reviewCharacterLoraImages,
  selectCharacterLoraCanonicalVersion,
  updateCharacterLoraImageCaption,
  uploadCharacterLoraSourceImage,
} from "@/lib/actions/character-lora-training";
import type {
  CharacterLoraBenchmarkRun,
  CharacterLoraCandidateImage,
  CharacterLoraDatasetRevision,
  CharacterLoraGpuLock,
  CharacterLoraJob,
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
  promotionDecisions: CharacterLoraPromotionDecision[];
  gpuLock: CharacterLoraGpuLock;
};

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
  return weights.length > 0 ? weights : [1];
}

function compactId(value: string | null | undefined) {
  return value ? value.slice(0, 8) : "-";
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
  promotionDecisions,
  gpuLock,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [latestCanonicalRunId, setLatestCanonicalRunId] = useState("");
  const [canonicalVersionId, setCanonicalVersionId] = useState(job.currentCanonicalVersionId ?? "");
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [identityTraits, setIdentityTraits] = useState("{\n  \"face\": \"\",\n  \"hair\": \"\"\n}");
  const [outfitTraits, setOutfitTraits] = useState("{\n  \"outfit\": \"\"\n}");
  const [negativeTraits, setNegativeTraits] = useState("{\n  \"avoid\": \"wrong identity\"\n}");

  const currentPrompt = promptCards.find((card) => card.id === job.currentPromptCardVersionId) ?? promptCards[0] ?? null;
  const latestFrozenRevision = datasetRevisions.find((revision) => revision.status === "frozen") ?? datasetRevisions[0] ?? null;
  const latestDoneTraining = trainingRuns.find((run) => run.status === "done" && run.finalSafetensorsArtifactId) ?? null;
  const pendingCanonicalRunId = latestCanonicalRunId.trim();
  const candidateStatusCounts = useMemo(() => {
    return candidateImages.reduce<Record<string, number>>((acc, image) => {
      acc[image.reviewStatus] = (acc[image.reviewStatus] ?? 0) + 1;
      return acc;
    }, {});
  }, [candidateImages]);

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

  function handleCanonicalGenerate() {
    runAction("canonical.generate", "Canonical 已入队", async () => {
      const run = await enqueueCharacterLoraCanonicalGenerationRun(job.id, {
        provider: "mock-local",
        sourceImageIds: sourceImages.map((image) => image.id),
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
    runAction(`section.${sectionId}`, "Section 已入队", async () => {
      await enqueueCharacterLoraSectionGenerationRun(sectionId, { provider: "mock-local" });
    });
  }

  function setImageSelected(imageId: string, selected: boolean) {
    setSelectedImageIds((prev) =>
      selected ? Array.from(new Set([...prev, imageId])) : prev.filter((id) => id !== imageId),
    );
  }

  function handleReview(imageIds: string[], reviewStatus: "keep" | "reject" | "excluded" | "pending") {
    if (imageIds.length === 0) {
      toast.error("未选择图片");
      return;
    }

    runAction(`review.${reviewStatus}`, "审核状态已更新", async () => {
      await reviewCharacterLoraImages({
        images: imageIds.map((imageId) => ({
          imageId,
          reviewStatus,
          rejectReasons: reviewStatus === "reject" ? ["other"] : undefined,
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
      await freezeCharacterLoraDataset(job.id, {
        force: formData.get("force") === "on",
        captionStrategy: readOptionalString(formData, "captionStrategy"),
        repeatCount: repeatCountRaw ? Number(repeatCountRaw) : undefined,
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
      await enqueueCharacterLoraTrainingRun(datasetRevisionId, {
        launcher: String(formData.get("launcher") ?? "sd-scripts"),
        queuePolicy: String(formData.get("queuePolicy") ?? "reject_when_busy"),
        allowWhenComfyQueueBusy: formData.get("allowBusy") === "on",
        configProfile: String(formData.get("configProfile") ?? "standard"),
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
        weightMatrix: parseWeights(String(formData.get("weightMatrix") ?? "1")),
        dryRun: formData.get("dryRun") === "on",
        skipQueue: formData.get("skipQueue") === "on",
        queuePolicy: String(formData.get("queuePolicy") ?? "queue_when_busy"),
      });
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

    const checkpointMatrix = Array.isArray(benchmark.checkpointMatrix) ? benchmark.checkpointMatrix : [];
    const selectedCheckpoint = typeof checkpointMatrix[0] === "string" ? checkpointMatrix[0] : undefined;
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

  function handlePromote(decisionId: string, dryRun: boolean) {
    if (!dryRun && !confirm("确认执行真实发布？")) {
      return;
    }

    runAction(`promote.${decisionId}.${dryRun ? "dry" : "real"}`, dryRun ? "发布预检已完成" : "已发布到预设", async () => {
      await promoteCharacterLoraPreset(decisionId, { dryRun, overwriteExisting: false });
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
        <CompactList
          empty="暂无 source image"
          items={sourceImages.map((image) => `${image.role} / ${image.width ?? "?"}x${image.height ?? "?"} / ${image.relativePath}`)}
        />
      </SectionCard>

      <SectionCard title="Canonical" subtitle="生成、模拟完成和选择标准图版本。">
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <ActionButton
              type="button"
              icon={ImagePlus}
              label="入队 mock-local"
              loading={isBusy("canonical.generate")}
              disabled={isPending || sourceImages.length === 0}
              onClick={handleCanonicalGenerate}
            />
            <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">最近 run: {pendingCanonicalRunId || "-"}</p>
          </div>
          <form action={handleCanonicalMockComplete} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <input name="runId" defaultValue={pendingCanonicalRunId} placeholder="generation run id" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white" />
            <select name="sourceImageId" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
              <option value="">自动 source</option>
              {sourceImages.map((image) => (
                <option key={image.id} value={image.id}>{image.role} / {compactId(image.id)}</option>
              ))}
            </select>
            <ActionButton icon={Check} label="模拟完成" loading={isBusy("canonical.complete")} disabled={isPending} />
          </form>
          <form action={handleCanonicalSelect} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <input
              name="versionId"
              value={canonicalVersionId}
              onChange={(event) => setCanonicalVersionId(event.target.value)}
              placeholder="canonical version id"
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white"
            />
            <ActionButton icon={ShieldCheck} label="设为当前" loading={isBusy("canonical.select")} disabled={isPending} />
          </form>
        </div>
      </SectionCard>

      <SectionCard title="Prompt Card" subtitle="保存角色特征和最终提示词草稿。">
        <form action={handlePromptCard} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-2">
          <label className="grid gap-1 text-xs text-zinc-400">
            Canonical version
            <input name="canonicalVersionId" defaultValue={job.currentCanonicalVersionId ?? canonicalVersionId} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-white" />
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
        <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
          {sections.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">暂无 sections</div>
          ) : (
            <div className="divide-y divide-white/10">
              {sections.map((section) => (
                <div key={section.id} className="grid gap-2 px-3 py-2 text-xs text-zinc-300 md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-center">
                  <span className="min-w-0 truncate font-medium text-white">{section.name}</span>
                  <span>{STATUS_LABEL[section.status] ?? section.status}</span>
                  <span className="text-zinc-500">keep {section.keepCount} / reject {section.rejectCount} / pending {section.pendingCount}</span>
                  <ActionButton
                    type="button"
                    icon={Play}
                    label="入队"
                    loading={isBusy(`section.${section.id}`)}
                    disabled={isPending}
                    onClick={() => handleSectionRun(section.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Review / Dataset" subtitle="审核候选图、编辑 caption、冻结数据集。">
        <div className="mb-3 flex flex-wrap gap-2">
          <ActionButton type="button" icon={Check} label="批量 keep" loading={isBusy("review.keep")} disabled={isPending || selectedImageIds.length === 0} onClick={() => handleReview(selectedImageIds, "keep")} />
          <ActionButton type="button" icon={X} label="批量 reject" loading={isBusy("review.reject")} disabled={isPending || selectedImageIds.length === 0} onClick={() => handleReview(selectedImageIds, "reject")} />
          <ActionButton type="button" icon={Square} label="批量 excluded" loading={isBusy("review.excluded")} disabled={isPending || selectedImageIds.length === 0} onClick={() => handleReview(selectedImageIds, "excluded")} />
        </div>
        <div className="overflow-hidden rounded-lg border border-white/10">
          {candidateImages.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">暂无候选图</div>
          ) : (
            <div className="divide-y divide-white/10">
              {candidateImages.map((image) => (
                <div key={image.id} className="grid gap-2 px-3 py-3 text-xs text-zinc-300 lg:grid-cols-[28px_1.1fr_0.8fr_1.4fr_auto] lg:items-center">
                  <input
                    type="checkbox"
                    checked={selectedImageIds.includes(image.id)}
                    onChange={(event) => setImageSelected(image.id, event.target.checked)}
                    className="size-3.5 accent-sky-400"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-zinc-200">{compactId(image.id)} / {image.width ?? "?"}x{image.height ?? "?"}</span>
                    <span className="block truncate text-zinc-500">{image.relativePath}</span>
                  </span>
                  <span>{STATUS_LABEL[image.reviewStatus] ?? image.reviewStatus}</span>
                  <form action={(formData) => handleCaption(image.id, formData)} className="flex min-w-0 gap-2">
                    <input name="captionDraft" defaultValue={image.captionDraft ?? `${job.triggerToken}, ${job.characterName}`} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
                    <ActionButton icon={Save} label="Caption" loading={isBusy(`caption.${image.id}`)} disabled={isPending} />
                  </form>
                  <div className="flex flex-wrap gap-1">
                    <MiniButton label="keep" onClick={() => handleReview([image.id], "keep")} disabled={isPending} />
                    <MiniButton label="reject" onClick={() => handleReview([image.id], "reject")} disabled={isPending} />
                    <MiniButton label="exclude" onClick={() => handleReview([image.id], "excluded")} disabled={isPending} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <form action={handleFreezeDataset} className="mt-3 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_100px_auto_auto]">
          <input name="captionStrategy" defaultValue={job.captionStrategy} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <input name="repeatCount" type="number" min={1} defaultValue={1} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input name="force" type="checkbox" className="size-3.5 accent-amber-400" />
            force
          </label>
          <ActionButton icon={Database} label="冻结 Dataset" loading={isBusy("dataset.freeze")} disabled={isPending} />
        </form>
        <CompactList
          empty="暂无 dataset revision"
          items={datasetRevisions.map((revision) => `v${revision.version} / ${revision.status} / item ${revision.itemCount} / ${compactId(revision.id)}`)}
        />
      </SectionCard>

      <SectionCard title="Training" subtitle="用最新 frozen dataset 入队训练，可查看 GPU 锁并取消运行。">
        {gpuLock.current ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{gpuLock.current.taskType} / {gpuLock.current.ownerId}</span>
          </div>
        ) : null}
        <form action={handleTrainingEnqueue} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-3 lg:grid-cols-[1fr_130px_130px_160px_auto]">
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
        <form action={handleBenchmarkEnqueue} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-[1fr_1fr_100px_120px_auto_auto]">
          <select name="trainingRunId" defaultValue={latestDoneTraining?.id ?? ""} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="">选择 done training</option>
            {trainingRuns.map((run) => (
              <option key={run.id} value={run.id}>{compactId(run.id)} / {run.status}</option>
            ))}
          </select>
          <input name="checkpointMatrix" defaultValue={job.baseCheckpointName ?? "default"} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <input name="weightMatrix" defaultValue="0.7,1" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white" />
          <select name="queuePolicy" defaultValue="queue_when_busy" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white">
            <option value="queue_when_busy">queue busy</option>
            <option value="reject_when_busy">reject busy</option>
            <option value="ignore_busy">ignore busy</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input name="dryRun" type="checkbox" className="size-3.5 accent-sky-400" />
            dryRun
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input name="skipQueue" type="checkbox" className="size-3.5 accent-sky-400" />
            skipQueue
          </label>
          <div className="lg:col-span-6">
            <ActionButton icon={Send} label="入队 Benchmark" loading={isBusy("benchmark.enqueue")} disabled={isPending || !latestDoneTraining} />
          </div>
        </form>
        <RunList
          runs={benchmarkRuns.map((run) => ({
            id: run.id,
            status: run.status,
            primary: `weight ${Array.isArray(run.weightMatrix) ? run.weightMatrix.join(",") : "-"} / rec ${run.recommendedWeight ?? "-"}`,
            secondary: `asset ${compactId(run.loraAssetId)} / training ${compactId(run.trainingRunId)}`,
            action: (
              <div className="flex flex-wrap gap-1">
                {run.status !== "done" ? (
                  <ActionButton type="button" icon={RefreshCw} label="模拟完成" loading={isBusy(`benchmark.complete.${run.id}`)} disabled={isPending} onClick={() => handleBenchmarkMockComplete(run.id)} />
                ) : null}
                <MiniButton label="approved" onClick={() => handleDecision(run, "approved")} disabled={isPending || run.status !== "done" || !run.loraAssetId} />
                <MiniButton label="rejected" onClick={() => handleDecision(run, "rejected")} disabled={isPending || run.status !== "done" || !run.loraAssetId} />
              </div>
            ),
          }))}
          empty="暂无 benchmark run"
        />
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
    </div>
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

function MiniButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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

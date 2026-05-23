"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import {
  createCharacterLoraTrainingJob,
  uploadCharacterLoraSourceImage,
} from "@/lib/actions/character-lora-training";
import type { CharacterLoraGpuLock, CharacterLoraJobList, CharacterLoraJobSummary } from "./types";

type Props = {
  jobList: CharacterLoraJobList;
  gpuLock: CharacterLoraGpuLock;
};

type DerivedStateInput = {
  state: string;
  includeInTraining: boolean;
  advancedExperiment?: boolean;
  captionTag?: string;
  ratioLimit?: number;
  riskNote?: string;
  note?: string;
};

type ModelBrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
};

type ModelBrowseResult = {
  currentPath: string;
  parentPath: string | null;
  items: ModelBrowseItem[];
};

type ModelHashResult = {
  name: string;
  path: string;
  absolutePath?: string;
  size: number;
  sha256: string;
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string } };

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

async function fetchApiData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null) as ApiResult<T> | null;
  if (!response.ok || !json) {
    throw new Error(`HTTP ${response.status}`);
  }
  if (!json.ok) {
    throw new Error(json.error?.message ?? `HTTP ${response.status}`);
  }
  return json.data;
}

function basenameFromPath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

const DEFAULT_DERIVED_STATES: DerivedStateInput[] = [
  { state: "underwear", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "underwear_shoes", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "semi_undressed", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "semi_undressed_upper_body", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "semi_undressed_shoes", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "nude", includeInTraining: false, note: "默认不进入训练，仅用于后续基准/发布变体。" },
  { state: "default_outfit", includeInTraining: false, note: "主体训练由主要服装/形态字段约束。" },
];

function readDerivedStates(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_DERIVED_STATES;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("派生状态必须是 JSON array");
  }

  return parsed as DerivedStateInput[];
}

function readUploadFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

export function CharacterLoraTrainingClient({ jobList, gpuLock }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [purpose, setPurpose] = useState("character_identity");
  const [primaryOutfitOrForm, setPrimaryOutfitOrForm] = useState("");
  const [scopeNote, setScopeNote] = useState("默认只训练一个角色身份与一个主要服装/形态，内裤/半脱/裸等派生状态不进入训练。");
  const [blockMixedCharacters, setBlockMixedCharacters] = useState(true);
  const [blockMultipleOfficialOutfits, setBlockMultipleOfficialOutfits] = useState(true);
  const [advancedExperiment, setAdvancedExperiment] = useState(false);
  const [derivedStatesJson, setDerivedStatesJson] = useState(JSON.stringify(DEFAULT_DERIVED_STATES, null, 2));
  const [checkpointFiles, setCheckpointFiles] = useState<ModelBrowseItem[]>([]);
  const [checkpointLoading, setCheckpointLoading] = useState(true);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [selectedCheckpointPath, setSelectedCheckpointPath] = useState("");
  const [baseCheckpointName, setBaseCheckpointName] = useState("");
  const [baseCheckpointPath, setBaseCheckpointPath] = useState("");
  const [baseCheckpointHash, setBaseCheckpointHash] = useState("");
  const [hashLoading, setHashLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCheckpointFiles() {
      setCheckpointLoading(true);
      setCheckpointError(null);
      try {
        const data = await fetchApiData<ModelBrowseResult>(
          "/api/models/browse?kind=checkpoint&recursive=1",
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const files = data.items
          .filter((item) => item.type === "file")
          .sort((a, b) => a.path.localeCompare(b.path));
        setCheckpointFiles(files);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCheckpointFiles([]);
        setCheckpointError(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) {
          setCheckpointLoading(false);
        }
      }
    }

    void loadCheckpointFiles();
    return () => controller.abort();
  }, []);

  const visibleJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return jobList.jobs;
    }

    return jobList.jobs.filter((job) =>
      [job.characterName, job.triggerToken, job.slug, job.baseCheckpointName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [jobList.jobs, query]);

  const statusCounts = useMemo(() => {
    return jobList.jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [jobList.jobs]);

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function handleSelectCheckpoint(pathValue: string) {
    setSelectedCheckpointPath(pathValue);
    if (!pathValue) return;

    const checkpoint = checkpointFiles.find((item) => item.path === pathValue);
    setBaseCheckpointPath(checkpoint?.path ?? pathValue);
    setBaseCheckpointName(checkpoint?.name ?? basenameFromPath(pathValue));
    setBaseCheckpointHash("");
  }

  function handleBaseCheckpointPathChange(pathValue: string) {
    setBaseCheckpointPath(pathValue);
    if (pathValue !== selectedCheckpointPath) {
      setSelectedCheckpointPath("");
    }
    setBaseCheckpointHash("");
  }

  async function handleHashCheckpoint() {
    const relativePath = baseCheckpointPath.trim();
    if (!relativePath) {
      toast.error("请先填写 checkpoint 路径");
      return;
    }

    setHashLoading(true);
    try {
      const params = new URLSearchParams({ kind: "checkpoint", path: relativePath });
      const data = await fetchApiData<ModelHashResult>(`/api/models/hash?${params.toString()}`);
      setBaseCheckpointPath(data.absolutePath ?? data.path);
      setBaseCheckpointName((current) => current.trim() || data.name);
      setBaseCheckpointHash(data.sha256);
      if (checkpointFiles.some((item) => item.path === data.path)) {
        setSelectedCheckpointPath(data.path);
      }
      toast.success("checkpoint hash 已计算", { description: data.name });
    } catch (error) {
      toast.error("hash 计算失败", { description: getErrorMessage(error) });
    } finally {
      setHashLoading(false);
    }
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        const characterName = String(formData.get("characterName") ?? "").trim();
        const triggerToken = String(formData.get("triggerToken") ?? "").trim();
        const baseCheckpointName = String(formData.get("baseCheckpointName") ?? "").trim();
        const baseCheckpointPath = String(formData.get("baseCheckpointPath") ?? "").trim();
        const baseCheckpointHash = String(formData.get("baseCheckpointHash") ?? "").trim();
        const baseFamily = String(formData.get("baseFamily") ?? "").trim();
        const initialSourceRole = String(formData.get("initialSourceRole") ?? "source").trim() || "source";
        const initialSourceFiles = readUploadFiles(formData, "sourceFiles");
        const normalizedPurpose = purpose.trim() || "character_identity";
        const normalizedPrimaryOutfitOrForm = primaryOutfitOrForm.trim();
        const normalizedScopeNote = scopeNote.trim();

        const job = await createCharacterLoraTrainingJob({
          characterName,
          triggerToken,
          trainingScope: {
            purpose: normalizedPurpose,
            primaryOutfitOrForm: normalizedPrimaryOutfitOrForm,
            scopeNote: normalizedScopeNote || undefined,
            advancedExperiment,
            mixingPolicy: {
              allowMixedCharacters: !blockMixedCharacters,
              allowMultipleOfficialOutfits: !blockMultipleOfficialOutfits,
              note: normalizedScopeNote || undefined,
              reason: advancedExperiment ? normalizedScopeNote || undefined : undefined,
            },
            derivedStates: advancedExperiment ? readDerivedStates(derivedStatesJson) : DEFAULT_DERIVED_STATES,
          },
          captionStrategy: String(formData.get("captionStrategy") ?? "controllable_identity").trim(),
          phase: "setup",
          baseCheckpointName: baseCheckpointName || null,
          baseCheckpointPath,
          baseCheckpointHash,
          baseFamily,
          createdBy: null,
        });

        for (const [index, file] of initialSourceFiles.entries()) {
          const uploadForm = new FormData();
          uploadForm.set("file", file);
          uploadForm.set("role", initialSourceRole);
          uploadForm.set("sortOrder", String(index));
          uploadForm.set("provenance", JSON.stringify({
            uploadedDuringJobCreation: true,
            originalName: file.name,
          }));
          await uploadCharacterLoraSourceImage(job.id, uploadForm);
        }

        toast.success("训练任务已创建", {
          description: initialSourceFiles.length > 0
            ? `${job.characterName} / source ${initialSourceFiles.length}`
            : job.characterName,
        });
        router.push(`/character-lora-training/${job.id}`);
        router.refresh();
      } catch (error) {
        toast.error("创建失败", { description: getErrorMessage(error) });
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatChip label="任务" value={jobList.total} tone="accent" />
        <StatChip label="草稿" value={statusCounts.draft ?? 0} />
        <StatChip label="训练中" value={(statusCounts.training_queued ?? 0) + (statusCounts.training_running ?? 0)} tone="warn" />
        <StatChip label="已发布" value={statusCounts.promoted ?? 0} />
        <StatChip label="GPU 锁" value={gpuLock.current ? "占用" : "空闲"} tone={gpuLock.current ? "warn" : "default"} />
      </div>

      {gpuLock.current ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 truncate">
            当前锁定：{gpuLock.current.taskType} / {gpuLock.current.ownerId}
          </span>
        </div>
      ) : null}

      <SectionCard title="新建训练任务" subtitle="建立角色任务并可先上传参考图，详情页继续补 canonical、prompt、section。">
        <form action={handleCreate} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 lg:grid-cols-2">
          <label className="grid gap-1 text-xs text-zinc-400">
            角色名
            <input
              name="characterName"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：Tangtang"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Trigger
            <input
              name="triggerToken"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：tangtang"
            />
          </label>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">Checkpoint browser</span>
              <span className="text-[11px] text-zinc-500">
                {checkpointLoading ? "加载中" : `${checkpointFiles.length} files`}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={selectedCheckpointPath}
                onChange={(event) => handleSelectCheckpoint(event.target.value)}
                disabled={checkpointLoading || checkpointFiles.length === 0}
                className="h-9 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-xs text-white outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {checkpointLoading ? "正在加载 checkpoint..." : "从已有 checkpoint 选择..."}
                </option>
                {checkpointFiles.map((checkpoint) => (
                  <option key={checkpoint.path} value={checkpoint.path}>
                    {checkpoint.path}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleHashCheckpoint}
                disabled={hashLoading || !baseCheckpointPath.trim()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {hashLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                计算 hash
              </button>
            </div>
            {selectedCheckpointPath ? (
              <div className="truncate font-mono text-[11px] text-zinc-500">
                selected: {selectedCheckpointPath}
              </div>
            ) : null}
            {checkpointError ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                Checkpoint browser 加载失败：{checkpointError}，仍可手填。
              </div>
            ) : null}
          </div>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base checkpoint 名称
            <input
              name="baseCheckpointName"
              value={baseCheckpointName}
              onChange={(event) => setBaseCheckpointName(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="可选"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base checkpoint 路径
            <input
              name="baseCheckpointPath"
              required
              value={baseCheckpointPath}
              onChange={(event) => handleBaseCheckpointPathChange(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sky-400"
              placeholder="model.safetensors 或完整 checkpoint 路径"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base checkpoint hash
            <input
              name="baseCheckpointHash"
              required
              value={baseCheckpointHash}
              onChange={(event) => setBaseCheckpointHash(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sky-400"
              placeholder="sha256 或可用 hash"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Base family
            <input
              name="baseFamily"
              required
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：illustrious / sd15"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Caption 策略
            <input
              name="captionStrategy"
              defaultValue="controllable_identity"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400 lg:col-span-2">
            <div className="text-xs font-medium text-zinc-300">初始参考图</div>
            <div className="grid gap-2 md:grid-cols-[160px_1fr]">
              <label className="grid gap-1">
                role
                <select name="initialSourceRole" defaultValue="source" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400">
                  <option value="source">source</option>
                  <option value="setting">setting</option>
                  <option value="local_reference">local_reference</option>
                  <option value="manual_canonical">manual_canonical</option>
                </select>
              </label>
              <label className="grid gap-1">
                files
                <input
                  name="sourceFiles"
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
                />
              </label>
            </div>
          </div>
          <label className="grid gap-1 text-xs text-zinc-400">
            训练目的
            <input
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="character_identity"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            主要服装 / 形态
            <input
              required
              value={primaryOutfitOrForm}
              onChange={(event) => setPrimaryOutfitOrForm(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：白色外套、黑色短靴、默认发型"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400 lg:col-span-2">
            范围说明
            <textarea
              value={scopeNote}
              onChange={(event) => setScopeNote(event.target.value)}
              className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-300 lg:col-span-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={blockMixedCharacters}
                  onChange={(event) => setBlockMixedCharacters(event.target.checked)}
                  className="size-4 rounded border-white/20 bg-black/40"
                />
                禁止混入其他角色
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={blockMultipleOfficialOutfits}
                  onChange={(event) => setBlockMultipleOfficialOutfits(event.target.checked)}
                  className="size-4 rounded border-white/20 bg-black/40"
                />
                禁止混入多套官方服装
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={advancedExperiment}
                onChange={(event) => setAdvancedExperiment(event.target.checked)}
                className="size-4 rounded border-white/20 bg-black/40"
              />
              高级实验：允许显式声明混训或派生状态训练
            </label>
            {advancedExperiment ? (
              <label className="grid gap-1 text-xs text-zinc-400">
                派生状态 JSON
                <textarea
                  value={derivedStatesJson}
                  onChange={(event) => setDerivedStatesJson(event.target.value)}
                  className="min-h-36 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-sky-400"
                />
              </label>
            ) : null}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建并进入
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="任务列表"
        subtitle={`${visibleJobs.length} / ${jobList.total}`}
        actions={
          <div className="flex min-w-0 flex-wrap gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-48 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-sky-400"
              placeholder="过滤角色 / trigger / checkpoint"
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
              刷新
            </button>
          </div>
        }
      >
        {visibleJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
            暂无训练任务
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/10">
            <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-500">
              <span>角色</span>
              <span>状态</span>
              <span>素材</span>
              <span>更新时间</span>
              <span />
            </div>
            <div className="divide-y divide-white/10">
              {visibleJobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function JobRow({ job }: { job: CharacterLoraJobSummary }) {
  return (
    <Link
      href={`/character-lora-training/${job.id}`}
      className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1fr_44px] items-center gap-2 px-3 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.04]"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-white">{job.characterName}</span>
        <span className="mt-1 block truncate font-mono text-[11px] text-zinc-500">{job.triggerToken} / {job.slug}</span>
      </span>
      <span className="min-w-0">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300">
          {STATUS_LABEL[job.status] ?? job.status}
        </span>
        <span className="mt-1 block truncate text-[11px] text-zinc-500">{job.phase ?? "-"}</span>
      </span>
      <span className="text-xs text-zinc-400">
        src {job.counts.sourceImages} / img {job.counts.candidateImages}
      </span>
      <span className="min-w-0 truncate text-xs text-zinc-500">
        {formatDate(job.updatedAt)}
      </span>
      <span className="flex justify-end text-zinc-500">
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}

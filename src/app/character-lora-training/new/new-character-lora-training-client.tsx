"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ArrowLeft, ImagePlus, Loader2, Plus, RefreshCw, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/section-card";
import {
  createCharacterLoraTrainingProject,
  uploadCharacterLoraSourceImage,
} from "@/lib/actions/character-lora-training";

type ModelBrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
  notes?: string;
};

type ModelBrowseResult = {
  currentPath: string;
  parentPath: string | null;
  items: ModelBrowseItem[];
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string } };

async function fetchApiData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!response.ok || !json) throw new Error(`HTTP ${response.status}`);
  if (!json.ok) throw new Error(json.error?.message ?? `HTTP ${response.status}`);
  return json.data;
}

function formatBytes(value: number | undefined) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

type CreateStage =
  | "idle"
  | "validating"
  | "creating_project"
  | "uploading_references"
  | "redirecting"
  | "failed";

const CREATE_STAGE_LABEL: Record<CreateStage, string> = {
  idle: "等待输入",
  validating: "正在校验输入",
  creating_project: "正在创建项目",
  uploading_references: "正在上传参考图",
  redirecting: "正在跳转",
  failed: "创建失败",
};

export function NewCharacterLoraTrainingClient() {
  const router = useRouter();
  const [checkpointFiles, setCheckpointFiles] = useState<ModelBrowseItem[]>([]);
  const [checkpointLoading, setCheckpointLoading] = useState(true);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [selectedCheckpointPath, setSelectedCheckpointPath] = useState("");
  const [selectedSourceFiles, setSelectedSourceFiles] = useState<File[]>([]);
  const [createStage, setCreateStage] = useState<CreateStage>("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdJobHref, setCreatedJobHref] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadCheckpointFiles(controller.signal);
    return () => controller.abort();
  }, []);

  const selectedCheckpoint = useMemo(
    () => checkpointFiles.find((item) => item.path === selectedCheckpointPath) ?? null,
    [checkpointFiles, selectedCheckpointPath],
  );

  async function loadCheckpointFiles(signal?: AbortSignal) {
    setCheckpointLoading(true);
    setCheckpointError(null);
    try {
      const data = await fetchApiData<ModelBrowseResult>(
        "/api/models/browse?kind=checkpoint&recursive=1",
        { signal },
      );
      if (signal?.aborted) return;
      setCheckpointFiles(
        data.items
          .filter((item) => item.type === "file")
          .sort((a, b) => a.path.localeCompare(b.path)),
      );
    } catch (error) {
      if (signal?.aborted) return;
      setCheckpointFiles([]);
      setCheckpointError(getErrorMessage(error));
    } finally {
      if (!signal?.aborted) setCheckpointLoading(false);
    }
  }

  const isCreating = createStage !== "idle" && createStage !== "failed";

  function setFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    setSelectedSourceFiles(imageFiles);
    setCreateError(null);
    setCreatedJobHref(null);
    if (files.length > 0 && imageFiles.length === 0) {
      setCreateError("请选择 PNG / JPEG / WebP 图片。");
    } else if (imageFiles.length < files.length) {
      setCreateError(`已忽略 ${files.length - imageFiles.length} 个非图片文件。`);
    }
  }

  function handleFilePickerChange(files: FileList | null) {
    setFiles(Array.from(files ?? []));
  }

  function clearSelectedSourceFiles() {
    setFiles([]);
    setUploadProgress({ done: 0, total: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (isCreating) return;
    setFiles(Array.from(event.dataTransfer.files));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    const formData = new FormData(event.currentTarget);
    const initialSourceFiles = selectedSourceFiles;
    let createdHref: string | null = null;

    try {
      setCreateError(null);
      setCreatedJobHref(null);
      setUploadProgress({ done: 0, total: initialSourceFiles.length });
      setCreateStage("validating");

      const characterName = String(formData.get("characterName") ?? "").trim();
      const triggerToken = String(formData.get("triggerToken") ?? "").trim();
      const checkpointPath = selectedCheckpointPath.trim();

      if (!checkpointPath) {
        throw new Error("请选择 checkpoint 文件");
      }

      setCreateStage("creating_project");
      const job = await createCharacterLoraTrainingProject({
        characterName,
        triggerToken,
        checkpointRelativePath: checkpointPath,
        actor: "human",
        source: "character-lora-training/new",
      });
      createdHref = `/character-lora-training/${job.id}`;
      setCreatedJobHref(createdHref);

      if (initialSourceFiles.length > 0) {
        setCreateStage("uploading_references");
      }

      for (const [index, file] of initialSourceFiles.entries()) {
        const uploadForm = new FormData();
        uploadForm.set("file", file);
        uploadForm.set("role", "source");
        uploadForm.set("sortOrder", String(index));
        uploadForm.set("provenance", JSON.stringify({
          uploadedDuringJobCreation: true,
          originalName: file.name,
          actor: "human",
          source: "character-lora-training/new",
        }));
        await uploadCharacterLoraSourceImage(job.id, uploadForm);
        setUploadProgress({ done: index + 1, total: initialSourceFiles.length });
      }

      setCreateStage("redirecting");
      toast.success("训练项目已创建", {
        description: initialSourceFiles.length > 0
          ? `${job.characterName} / 参考图 ${initialSourceFiles.length}`
          : `${job.characterName} / 未上传参考图`,
      });
      router.push(createdHref);
      router.refresh();
    } catch (error) {
      const message = createdHref
        ? `项目已创建，但后续步骤失败：${getErrorMessage(error)}`
        : getErrorMessage(error);
      setCreateStage("failed");
      setCreateError(message);
      setCreatedJobHref(createdHref);
      toast.error("创建失败", { description: message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/character-lora-training"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
        >
          <ArrowLeft className="size-3.5" />
          返回列表
        </Link>
      </div>

      <SectionCard title="项目输入" subtitle="高级 checkpoint 元数据、caption 策略和训练参数由系统模板与模型管理记录提供。">
        <form onSubmit={handleCreate} className="grid min-w-0 gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs text-zinc-400">
            项目名
            <input
              name="characterName"
              required
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：Tangtang"
            />
          </label>

          <label className="grid gap-1 text-xs text-zinc-400">
            触发词
            <input
              name="triggerToken"
              required
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none focus:border-sky-400"
              placeholder="如：tangtang"
            />
          </label>

          <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">训练基底 checkpoint</span>
              <button
                type="button"
                onClick={() => void loadCheckpointFiles()}
                disabled={checkpointLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
              >
                <RefreshCw className={`size-3 ${checkpointLoading ? "animate-spin" : ""}`} />
                刷新
              </button>
            </div>
            <select
              value={selectedCheckpointPath}
              onChange={(event) => setSelectedCheckpointPath(event.target.value)}
              disabled={checkpointLoading || checkpointFiles.length === 0}
              required
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-xs text-white outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {checkpointLoading ? "正在加载 checkpoint..." : "从模型管理选择 checkpoint..."}
              </option>
              {checkpointFiles.map((checkpoint) => (
                <option key={checkpoint.path} value={checkpoint.path}>
                  {checkpoint.path}
                </option>
              ))}
            </select>
            {selectedCheckpoint ? (
              <div className="grid gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-500 sm:grid-cols-[1fr_auto]">
                <span className="break-all font-mono sm:truncate">{selectedCheckpoint.path}</span>
                <span>{formatBytes(selectedCheckpoint.size)}</span>
              </div>
            ) : null}
            {checkpointError ? (
              <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
                Checkpoint 列表加载失败：{checkpointError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 text-xs text-zinc-400 md:col-span-2">
            <span>初始参考图</span>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="grid gap-3 rounded-lg border border-dashed border-white/15 bg-black/20 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-zinc-300">
                    <UploadCloud className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-200">拖入参考图，或从文件中选择</div>
                    <div className="mt-1 text-[11px] text-zinc-500">支持 PNG / JPEG / WebP。也可以不上传图片直接创建项目。</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImagePlus className="size-3.5" />
                  选择图片
                </button>
              </div>
              <input
                ref={fileInputRef}
                name="sourceFiles"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => handleFilePickerChange(event.currentTarget.files)}
                className="sr-only"
              />
              {selectedSourceFiles.length > 0 ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <span>已选择 {selectedSourceFiles.length} 张</span>
                    <button
                      type="button"
                      onClick={clearSelectedSourceFiles}
                      disabled={isCreating}
                      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
                    >
                      <X className="size-3" />
                      清空
                    </button>
                  </div>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-white/10 bg-black/20">
                    {selectedSourceFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-2 py-1.5 last:border-b-0">
                        <span className="min-w-0 truncate text-[11px] text-zinc-300">{file.name}</span>
                        <span className="shrink-0 text-[11px] text-zinc-500">{formatBytes(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2 text-[11px] text-zinc-500">
                  未选择参考图；创建后可在概览或人设参考图页继续上传。
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400 md:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-zinc-300">创建进度</span>
              <span className={createStage === "failed" ? "text-rose-300" : "text-zinc-400"}>
                {CREATE_STAGE_LABEL[createStage]}
              </span>
            </div>
            {createStage === "uploading_references" || uploadProgress.total > 0 ? (
              <div className="grid gap-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-sky-400 transition-all"
                    style={{ width: `${uploadProgress.total ? Math.round((uploadProgress.done / uploadProgress.total) * 100) : 0}%` }}
                  />
                </div>
                <div className="text-[11px] text-zinc-500">
                  参考图 {uploadProgress.done} / {uploadProgress.total}
                </div>
              </div>
            ) : null}
            {createError ? (
              <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                {createError}
                {createdJobHref ? (
                  <Link href={createdJobHref} className="ml-2 underline underline-offset-2">
                    打开已创建项目
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="submit"
              disabled={isCreating || checkpointLoading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建项目
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, Loader2, Plus, RefreshCw } from "lucide-react";
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

function readUploadFiles(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function formatBytes(value: number | undefined) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败";
}

export function NewCharacterLoraTrainingClient() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkpointFiles, setCheckpointFiles] = useState<ModelBrowseItem[]>([]);
  const [checkpointLoading, setCheckpointLoading] = useState(true);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [selectedCheckpointPath, setSelectedCheckpointPath] = useState("");

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

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      try {
        const characterName = String(formData.get("characterName") ?? "").trim();
        const triggerToken = String(formData.get("triggerToken") ?? "").trim();
        const checkpointPath = selectedCheckpointPath.trim();
        const initialSourceFiles = readUploadFiles(formData, "sourceFiles");

        if (!checkpointPath) {
          toast.error("请选择 checkpoint 文件");
          return;
        }

        const job = await createCharacterLoraTrainingProject({
          characterName,
          triggerToken,
          checkpointRelativePath: checkpointPath,
          actor: "human",
          source: "character-lora-training/new",
        });

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
        }

        toast.success("训练项目已创建", {
          description: initialSourceFiles.length > 0
            ? `${job.characterName} / 参考图 ${initialSourceFiles.length}`
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
        <form action={handleCreate} className="grid min-w-0 gap-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-2">
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

          <label className="grid gap-1 text-xs text-zinc-400 md:col-span-2">
            初始参考图
            <input
              name="sourceFiles"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="max-w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-zinc-200"
            />
          </label>

          <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="submit"
              disabled={isPending || checkpointLoading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              创建项目
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

function formatBytes(value: number | undefined) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

async function readApiError(response: Response) {
  const json = (await response.json().catch(() => null)) as { error?: { message?: string }; ok?: boolean } | null;
  return json?.error?.message ?? `HTTP ${response.status}`;
}

export function OverviewSourceUpload({
  jobId,
  sourceImageCount,
}: {
  jobId: string;
  sourceImageCount: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function setImageFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => file.type.startsWith("image/"));
    setFiles(imageFiles);
    setError(null);
    setSuccess(null);
    if (nextFiles.length > 0 && imageFiles.length === 0) {
      setError("请选择 PNG / JPEG / WebP 图片。");
    } else if (imageFiles.length < nextFiles.length) {
      setError(`已忽略 ${nextFiles.length - imageFiles.length} 个非图片文件。`);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploading) return;
    setImageFiles(Array.from(event.dataTransfer.files));
  }

  async function handleUpload() {
    if (files.length === 0 || uploading) return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress({ done: 0, total: files.length });
    try {
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("role", "source");
        formData.set("sortOrder", String(sourceImageCount + index));
        formData.set("provenance", JSON.stringify({
          uploadedFromOverview: true,
          originalName: file.name,
          actor: "human",
          source: "character-lora-training/overview",
        }));

        const response = await fetch(`/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/source-images`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error(await readApiError(response));
        }
        const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
        if (json && json.ok === false) {
          throw new Error(json.error?.message ?? `HTTP ${response.status}`);
        }
        setProgress({ done: index + 1, total: files.length });
      }

      toast.success("参考图已上传", { description: `${files.length} 张` });
      setSuccess(`已上传 ${files.length} 张参考图。`);
      setFiles([]);
      router.refresh();
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "上传失败";
      setError(message);
      toast.error("上传失败", { description: message });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-3">
      {sourceImageCount === 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          当前项目还没有初始参考图。可以先上传参考图，再继续人设图和提示词流程。
        </div>
      ) : null}

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
              <div className="text-sm font-medium text-zinc-200">上传参考图</div>
              <div className="mt-1 text-xs text-zinc-500">拖入图片或从文件选择，上传后会进入 source image 列表。</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs text-zinc-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ImagePlus className="size-3.5" />
            选择图片
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setImageFiles(Array.from(event.currentTarget.files ?? []))}
          className="sr-only"
        />

        {files.length > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
              <span>已选择 {files.length} 张</span>
              <button
                type="button"
                onClick={() => setImageFiles([])}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
              >
                <X className="size-3" />
                清空
              </button>
            </div>
            <div className="max-h-32 overflow-y-auto rounded-md border border-white/10 bg-black/20">
              {files.map((file, index) => (
                <div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 items-center justify-between gap-3 border-b border-white/10 px-2 py-1.5 last:border-b-0">
                  <span className="min-w-0 truncate text-[11px] text-zinc-300">{file.name}</span>
                  <span className="shrink-0 text-[11px] text-zinc-500">{formatBytes(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {progress.total > 0 ? (
          <div className="grid gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500">上传 {progress.done} / {progress.total}</div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || files.length === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            上传参考图
          </button>
        </div>
      </div>
    </div>
  );
}

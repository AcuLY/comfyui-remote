"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { WorkflowActionResult } from "./workflow-actions";

export function SourceImageUploader({
  uploadAction,
}: {
  uploadAction: (formData: FormData) => Promise<WorkflowActionResult>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState("source");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [selectedFileNames, setSelectedFileNames] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [isPending, startTransition] = useTransition();

  function submitFiles(files: FileList | File[]) {
    const allFiles = Array.from(files).filter((file) => file.size > 0);
    const selected = allFiles.filter((file) => file.type.startsWith("image/"));
    setSelectedFileNames(selected.map((file) => file.name));
    setProgress({ done: 0, total: selected.length });
    if (selected.length === 0) {
      setMessage("请选择 png / jpg / webp 图片。");
      setIsError(true);
      return;
    }

    startTransition(async () => {
      setMessage(`正在上传 ${selected.length} 张图片...`);
      setIsError(false);
      for (const [index, file] of selected.entries()) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("role", role);
        const result = await uploadAction(formData);
        if (!result.ok) {
          setMessage(result.message);
          setIsError(true);
          return;
        }
        setProgress({ done: index + 1, total: selected.length });
      }
      setMessage(`已上传 ${selected.length} 张图片。`);
      setIsError(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-xs text-zinc-400">
          图片用途
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="ml-2 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-200 outline-none transition focus:border-sky-400"
          >
            <option value="source">source</option>
            <option value="setting">setting</option>
            <option value="local_reference">local_reference</option>
            <option value="manual_canonical">manual_canonical</option>
            <option value="rerun_reference">rerun_reference</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="size-3.5" />
          选择文件
        </button>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          submitFiles(event.dataTransfer.files);
        }}
        disabled={isPending}
        className="flex min-h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 px-4 text-center transition hover:border-sky-400/60 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="mb-2 size-7 text-sky-300" />
        <span className="text-sm font-medium text-zinc-200">拖入图片或点击上传</span>
        <span className="mt-1 text-xs text-zinc-500">支持 png / jpg / jpeg / webp，单张最大 50MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.currentTarget.files) submitFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      {selectedFileNames.length > 0 ? (
        <div className="mt-3 max-h-28 overflow-y-auto rounded-md border border-white/10 bg-black/20">
          {selectedFileNames.map((name, index) => (
            <div key={`${name}-${index}`} className="truncate border-b border-white/10 px-2 py-1.5 text-[11px] text-zinc-300 last:border-b-0">
              {name}
            </div>
          ))}
        </div>
      ) : null}

      {progress.total > 0 ? (
        <div className="mt-3 grid gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-zinc-500">上传 {progress.done} / {progress.total}</div>
        </div>
      ) : null}

      {message ? (
        <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${isError ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {message}
        </div>
      ) : null}
    </div>
  );
}

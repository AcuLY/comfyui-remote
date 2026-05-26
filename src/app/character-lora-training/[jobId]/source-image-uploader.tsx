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
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          submitFiles(event.dataTransfer.files);
        }}
        disabled={isPending}
        className="flex h-16 w-full cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-white/15 bg-black/20 px-4 transition hover:border-sky-400/60 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="size-5 text-sky-300" />
        <div className="text-left">
          <span className="text-xs font-medium text-zinc-200">拖入图片或点击上传</span>
          <span className="ml-2 text-[11px] text-zinc-500">png / jpg / webp</span>
        </div>
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

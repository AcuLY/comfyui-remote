"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { WorkflowActionResult } from "./workflow-actions";

type UploadTarget = "source" | "front" | "back" | "left" | "right";

type UploadActionResult = WorkflowActionResult & { sourceImageId?: string };

const TARGET_OPTIONS: { value: UploadTarget; label: string }[] = [
  { value: "source", label: "源图" },
  { value: "front", label: "正面候选" },
  { value: "back", label: "背面候选" },
  { value: "left", label: "左侧候选" },
  { value: "right", label: "右侧候选" },
];

export function SourceImageUploader({
  uploadAction,
  registerCanonicalAction,
}: {
  uploadAction: (formData: FormData) => Promise<UploadActionResult>;
  registerCanonicalAction?: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<UploadTarget>("source");
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [isPending, startTransition] = useTransition();

  function submitFiles(files: FileList | File[]) {
    const allFiles = Array.from(files).filter((file) => file.size > 0);
    const selected = allFiles.filter((file) => file.type.startsWith("image/"));
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
        // If target is a canonical view, register the uploaded source image
        if (target !== "source" && registerCanonicalAction && result.sourceImageId) {
          const regForm = new FormData();
          regForm.set("sourceImageId", result.sourceImageId);
          regForm.set("canonicalView", target);
          await registerCanonicalAction(regForm);
        }
        setProgress({ done: index + 1, total: selected.length });
      }
      const targetLabel = TARGET_OPTIONS.find((o) => o.value === target)?.label ?? "源图";
      setMessage(`已上传 ${selected.length} 张图片至「${targetLabel}」。`);
      setIsError(false);
      toast.success(`上传完成：${selected.length} 张 → ${targetLabel}`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <div className="flex items-center gap-2">
        {/* Target selector */}
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value as UploadTarget)}
          disabled={isPending}
          className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] text-zinc-200 outline-none transition focus:border-sky-400 disabled:opacity-50"
        >
          {TARGET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Upload drop zone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            submitFiles(event.dataTransfer.files);
          }}
          disabled={isPending}
          className="flex h-8 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/15 bg-black/20 px-3 transition hover:border-sky-400/60 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UploadCloud className="size-3.5 text-sky-300" />
          <span className="text-[11px] text-zinc-300">拖入或点击上传</span>
        </button>
      </div>

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

      {progress.total > 0 && (
        <div className="mt-2 grid gap-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-sky-400 transition-all"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-zinc-500">上传 {progress.done} / {progress.total}</div>
        </div>
      )}

      {message && (
        <div className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] ${isError ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {message}
        </div>
      )}
    </div>
  );
}

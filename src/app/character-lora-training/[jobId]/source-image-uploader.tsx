"use client";

import { UploadCloud } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { WorkflowActionResult } from "./workflow-actions";

type UploadActionResult = WorkflowActionResult & { sourceImageId?: string };

export function InlineUploadButton({
  label,
  uploadAction,
  registerCanonicalAction,
  canonicalView,
}: {
  label?: string;
  uploadAction: (formData: FormData) => Promise<UploadActionResult>;
  registerCanonicalAction?: (formData: FormData) => Promise<void>;
  canonicalView?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function submitFiles(files: FileList | File[]) {
    const selected = Array.from(files).filter((f) => f.size > 0 && f.type.startsWith("image/"));
    if (selected.length === 0) return;

    startTransition(async () => {
      for (const file of selected) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadAction(formData);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (canonicalView && registerCanonicalAction && result.sourceImageId) {
          const regForm = new FormData();
          regForm.set("sourceImageId", result.sourceImageId);
          regForm.set("canonicalView", canonicalView);
          await registerCanonicalAction(regForm);
        }
      }
      toast.success(`已上传 ${selected.length} 张`);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); submitFiles(e.dataTransfer.files); }}
        disabled={isPending}
        className="flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-black/20 transition hover:border-sky-400/50 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadCloud className="size-4 text-sky-300/70" />
        {label && <span className="mt-1 text-[9px] text-zinc-500">{label}</span>}
        {isPending && <span className="mt-1 text-[9px] text-sky-300">上传中...</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => { if (e.currentTarget.files) submitFiles(e.currentTarget.files); e.currentTarget.value = ""; }}
      />
    </>
  );
}

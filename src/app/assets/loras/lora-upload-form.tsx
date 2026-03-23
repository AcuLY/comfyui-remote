"use client";

import { Upload } from "lucide-react";
import { useActionState, useEffect, useId, useRef } from "react";
import { uploadLoraAction } from "./actions";
import { initialLoraUploadState, loraCategories } from "./lora-upload";

export function LoraUploadForm() {
  const [state, formAction, pending] = useActionState(uploadLoraAction, initialLoraUploadState);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputId = useId();

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    formRef.current?.reset();
  }, [state.status]);

  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  return (
    <form ref={formRef} action={formAction} className="grid gap-3 sm:grid-cols-[1fr_180px]">
      <label
        htmlFor={fileInputId}
        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center ${pending ? "pointer-events-none opacity-70" : ""}`}
      >
        <Upload className="size-5 text-sky-300" />
        <div className="mt-2 text-sm font-medium text-white">Choose a LoRA file</div>
        <div className="mt-1 text-xs text-zinc-400">Accepts `.safetensors` and `.ckpt` files.</div>
        <input
          id={fileInputId}
          name="file"
          type="file"
          accept=".safetensors,.ckpt"
          required
          className="hidden"
        />
      </label>

      <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
        <div className="text-xs text-zinc-500">Category</div>
        <select
          name="category"
          defaultValue={loraCategories[0]}
          disabled={pending}
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
        >
          {loraCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Upload to library"}
        </button>

        <p
          aria-live="polite"
          className={`rounded-xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}
        >
          {state.message ?? "Select a file, choose a category, and submit to the real LoRA API."}
        </p>
      </div>
    </form>
  );
}

"use client";

import { useState, useRef, useTransition } from "react";
import { ChevronDown, Loader2, Upload } from "lucide-react";
import { uploadLora } from "@/lib/actions";

const CATEGORIES = [
  { value: "characters", label: "Characters" },
  { value: "styles", label: "Styles" },
  { value: "poses", label: "Poses" },
  { value: "misc", label: "Misc" },
];

export function LoraUploadForm() {
  const [isPending, startTransition] = useTransition();
  const [category, setCategory] = useState("characters");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileName(file?.name ?? "");
    setMessage(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(formRef.current!);

    startTransition(async () => {
      try {
        await uploadLora(formData);
        setMessage({ type: "success", text: `${fileName} 上传成功` });
        setFileName("");
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        setMessage({ type: "error", text: err instanceof Error ? err.message : "上传失败" });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {/* 分类选择 */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">目标分类</label>
        <div className="relative">
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-zinc-900">{cat.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      {/* 文件选择 */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">LoRA 文件（.safetensors）</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-6 text-sm text-zinc-400 transition hover:border-sky-500/40 hover:text-white">
          <Upload className="size-4" />
          <span>{fileName || "点击选择文件"}</span>
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".safetensors,.ckpt,.pt"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      {/* 预览路径 */}
      {fileName && (
        <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
          目标路径: <span className="text-zinc-300">{category}/{fileName}</span>
        </div>
      )}

      {/* 提交 */}
      <button
        type="submit"
        disabled={isPending || !fileName}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> 上传中...</>
        ) : (
          <><Upload className="size-4" /> 上传 LoRA</>
        )}
      </button>

      {/* 消息提示 */}
      {message && (
        <div
          className={`rounded-xl px-3 py-2 text-xs ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300"
          }`}
        >
          {message.text}
        </div>
      )}
    </form>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LoraAsset } from "@/lib/types";
import { getApiBaseUrl } from "@/lib/api-base-url";

type UploadResponse = {
  ok?: boolean;
  data?: LoraAsset;
  error?: {
    message?: string;
    details?: unknown;
  };
};

type Props = {
  categories: string[];
};

export function LoraUploadPanel({ categories }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(categories[0] ?? "characters");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const accept = useMemo(() => ".safetensors,.ckpt,.pt,.pth,.bin", []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("请先选择要上传的 LoRA 文件。");
      setMessage(null);
      return;
    }

    const formData = new FormData();
    formData.set("category", category);
    formData.set("file", selectedFile);

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/loras`, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        const fallback = response.status >= 500 ? "上传失败，请检查后端配置。" : "上传失败，请稍后重试。";
        setError(payload?.error?.message ?? fallback);
        return;
      }

      setMessage(`上传成功：${payload.data.name}`);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("无法连接上传接口，请确认后端服务已启动。");
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_180px]" onSubmit={handleSubmit}>
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center">
        <Upload className="size-5 text-sky-300" />
        <div className="mt-2 text-sm font-medium text-white">{selectedFile ? selectedFile.name : "选择文件或拖拽上传"}</div>
        <div className="mt-1 text-xs text-zinc-400">支持 safetensors / ckpt / pt / pth / bin</div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
        <div>
          <div className="text-xs text-zinc-500">目标分类</div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
          >
            {categories.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "上传中..." : "上传到指定路径"}
        </button>
        {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
      </div>
    </form>
  );
}

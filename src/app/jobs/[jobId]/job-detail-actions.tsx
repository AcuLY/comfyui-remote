"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Play } from "lucide-react";
import { runJob, copyJob, runPosition } from "@/lib/actions";

export function JobDetailActions({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRun() {
    startTransition(async () => {
      await runJob(jobId);
    });
  }

  function handleCopy() {
    startTransition(async () => {
      const newId = await copyJob(jobId);
      if (newId) {
        router.push(`/jobs/${newId}`);
      }
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <button
        disabled={isPending}
        onClick={handleRun}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-4" /> {isPending ? "提交中…" : "运行整组"}
      </button>
      <button
        disabled={isPending}
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Copy className="size-4" /> {isPending ? "处理中…" : "复制任务"}
      </button>
    </div>
  );
}

export function PositionRunButton({ positionId }: { positionId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => runPosition(positionId))}
      className="inline-flex items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
    >
      <Play className="size-3.5" /> {isPending ? "提交中…" : "运行本节"}
    </button>
  );
}

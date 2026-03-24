"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Play } from "lucide-react";
import { runJob, copyJob } from "@/lib/actions";

export function JobActions({ jobId }: { jobId: string }) {
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
    <div className="grid grid-cols-3 gap-2 text-xs">
      <button className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200 transition hover:bg-white/[0.08]">
        编辑
      </button>
      <button
        disabled={isPending}
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Copy className="size-3.5" /> {isPending ? "…" : "复制"}
      </button>
      <button
        disabled={isPending}
        onClick={handleRun}
        className="inline-flex items-center justify-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Play className="size-3.5" /> {isPending ? "…" : "运行"}
      </button>
    </div>
  );
}

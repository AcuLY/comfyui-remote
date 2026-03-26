import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getPositionResults } from "@/lib/server-data";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "待审", cls: "bg-amber-500/80 text-white" },
  kept: { label: "kept", cls: "bg-emerald-500/80 text-white" },
  trashed: { label: "trash", cls: "bg-zinc-600/80 text-zinc-300" },
};

const RUN_STATUS_BADGE: Record<string, string> = {
  done: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  running: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  queued: "border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  failed: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export default async function PositionResultsPage({
  params,
}: {
  params: Promise<{ jobId: string; positionId: string }>;
}) {
  const { jobId, positionId } = await params;
  const data = await getPositionResults(positionId);

  if (!data || data.jobId !== jobId) {
    notFound();
  }

  const totalImages = data.runs.reduce((sum, run) => sum + run.images.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/jobs/${jobId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回任务详情
        </Link>
        {data.totalPending > 0 && data.pendingRunId && (
          <Link
            href={`/queue/${data.pendingRunId}`}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-500/20"
          >
            <AlertCircle className="size-3.5" />
            跳转至审核 ({data.totalPending} 张待审)
          </Link>
        )}
      </div>

      {/* Title */}
      <SectionCard
        title={`${data.positionName} — 结果`}
        subtitle={`${data.jobTitle} · 共 ${data.runs.length} 次运行 · ${totalImages} 张图片`}
      >
        {data.runs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-zinc-500">
            暂无运行结果
          </div>
        ) : (
          <div className="space-y-6">
            {data.runs.map((run) => (
              <div key={run.id}>
                {/* Run header */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-300">
                    Run #{run.runIndex}
                  </span>
                  <span className="text-[10px] text-zinc-500">{run.createdAt}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      RUN_STATUS_BADGE[run.status] ?? RUN_STATUS_BADGE.queued
                    }`}
                  >
                    {run.status}
                  </span>
                  {run.images.some((img) => img.status === "pending") && (
                    <Link
                      href={`/queue/${run.id}`}
                      className="ml-auto text-[10px] text-sky-400 hover:text-sky-300"
                    >
                      审核此组
                    </Link>
                  )}
                </div>

                {/* Image grid */}
                {run.images.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-[11px] text-zinc-600">
                    无图片
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
                    {run.images.map((img) => {
                      const badge = STATUS_BADGE[img.status] ?? STATUS_BADGE.pending;
                      return (
                        <Link
                          key={img.id}
                          href={`/queue/${run.id}/images/${img.id}`}
                          className={`group relative overflow-hidden rounded-xl border transition hover:border-sky-500/40 ${
                            img.status === "trashed"
                              ? "border-white/5 opacity-40"
                              : img.status === "kept"
                                ? "border-emerald-500/30"
                                : "border-white/10"
                          }`}
                        >
                          <Image
                            src={img.src}
                            alt=""
                            width={200}
                            height={280}
                            className="aspect-[3/4] w-full object-cover"
                            unoptimized
                          />
                          <div
                            className={`absolute bottom-0 left-0 right-0 py-0.5 text-center text-[8px] font-medium ${badge.cls}`}
                          >
                            {badge.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

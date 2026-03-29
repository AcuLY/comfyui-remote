import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getPositionResults } from "@/lib/server-data";
import { ResultsGrid } from "./results-grid";

export const dynamic = "force-dynamic";

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
          <ResultsGrid runs={data.runs} />
        )}
      </SectionCard>
    </div>
  );
}

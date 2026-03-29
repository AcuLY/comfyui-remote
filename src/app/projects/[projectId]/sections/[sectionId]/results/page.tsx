import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getSectionResults } from "@/lib/server-data";
import { ResultsGrid } from "./results-grid";

export const dynamic = "force-dynamic";

export default async function SectionResultsPage({
  params,
}: {
  params: Promise<{ projectId: string; sectionId: string }>;
}) {
  const { projectId, sectionId } = await params;
  const data = await getSectionResults(sectionId);

  if (!data || data.projectId !== projectId) {
    notFound();
  }

  const totalImages = data.runs.reduce((sum, run) => sum + run.images.length, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回项目详情
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
        title={`${data.sectionName} — 结果`}
        subtitle={`${data.projectTitle} · 共 ${data.runs.length} 次运行 · ${totalImages} 张图片`}
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

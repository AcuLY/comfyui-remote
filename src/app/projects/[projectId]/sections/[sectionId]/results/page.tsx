import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
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
          href={`/projects/${projectId}#section-${sectionId}`}
          scroll={false}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回项目详情
        </Link>
        <div className="flex items-center gap-2">
          {data.previousSection ? (
            <Link
              href={`/projects/${projectId}/sections/${data.previousSection.id}/results`}
              title={data.previousSection.name}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronLeft className="size-3.5" />
              上一节
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/5 px-3 py-2 text-xs text-zinc-600">
              <ChevronLeft className="size-3.5" />
              上一节
            </span>
          )}
          {data.nextSection ? (
            <Link
              href={`/projects/${projectId}/sections/${data.nextSection.id}/results`}
              title={data.nextSection.name}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              下一节
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/5 px-3 py-2 text-xs text-zinc-600">
              下一节
              <ChevronRight className="size-3.5" />
            </span>
          )}
        </div>
      </div>

      {/* Title */}
      <SectionCard
        title={`${data.sectionName} — 审核`}
        subtitle={`${data.projectTitle} · ${data.runs.length} 次运行 · ${totalImages} 张图片${data.totalPending > 0 ? ` · ${data.totalPending} 张待审` : ""}`}
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

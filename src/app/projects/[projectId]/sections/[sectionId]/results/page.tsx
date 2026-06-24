import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Images, Pencil } from "lucide-react";
import { HardNavigationLink } from "@/components/hard-navigation-link";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { SectionCard } from "@/components/section-card";
import { getSectionResults } from "@/lib/server-data";
import { hrefWithFolderQuery } from "@/lib/folder-navigation";
import { ResultsGrid } from "./results-grid";
import { ResultsRoutePrefetcher } from "./results-route-prefetcher";

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

  const returnHref = hrefWithFolderQuery(
    `/projects/${projectId}`,
    "sectionFolder",
    data.sectionFolderId,
    `section-${sectionId}`,
  );
  const sectionResultPrefetchHrefs = [
    data.previousSection ? `/projects/${projectId}/sections/${data.previousSection.id}/results` : null,
    data.nextSection ? `/projects/${projectId}/sections/${data.nextSection.id}/results` : null,
    data.nextPendingSection ? `/projects/${projectId}/sections/${data.nextPendingSection.id}/results` : null,
  ].filter((href): href is string => Boolean(href));

  return (
    <div className="space-y-4">
      <ResultsRoutePrefetcher hrefs={[...new Set(sectionResultPrefetchHrefs)]} />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HardNavigationLink
          href={returnHref}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回项目详情
        </HardNavigationLink>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <HardNavigationLink
            href={`/projects/${projectId}/sections/${sectionId}`}
            data-nav-editor
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/20 hover:text-sky-200"
          >
            <Pencil className="size-3.5" />
            返回小节
          </HardNavigationLink>
          <HardNavigationLink
            href={`/projects/${projectId}/results`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-300 transition hover:bg-violet-500/20 hover:text-violet-200"
          >
            <Images className="size-3.5" />
            项目结果
          </HardNavigationLink>
          {data.nextPendingSection && (
            <HardNavigationLink
              href={`/projects/${projectId}/sections/${data.nextPendingSection.id}/results`}
              data-nav-next-pending
              title={data.nextPendingSection.name}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-500/20 hover:text-amber-200"
            >
              <ArrowRight className="size-3.5" />
              下一个待审
            </HardNavigationLink>
          )}
          <NeighborNavigation
            previousHref={data.previousSection ? `/projects/${projectId}/sections/${data.previousSection.id}/results` : null}
            nextHref={data.nextSection ? `/projects/${projectId}/sections/${data.nextSection.id}/results` : null}
            hardNavigation
            previousLabel="上一节"
            nextLabel="下一节"
            previousTitle={data.previousSection?.name}
            nextTitle={data.nextSection?.name}
            previousDataAttributes={data.previousSection ? { "data-section-nav": "previous" } : undefined}
            nextDataAttributes={data.nextSection ? { "data-section-nav": "next" } : undefined}
            controlClassName="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.08] hover:text-white"
            disabledControlClassName="inline-flex items-center gap-1.5 rounded-xl border border-white/5 px-3 py-2 text-xs text-zinc-600"
            iconClassName="size-3.5"
          />
        </div>
      </div>

      {/* Title */}
      <SectionCard
        title={`${data.sectionName} — 审核`}
        subtitle={`${data.projectTitle} · ${data.runs.length} 次运行`}
      >
        <ResultsGrid
          key={`${sectionId}:${data.batchSize ?? 2}`}
          runs={data.runs}
          continuousReviewImages={data.continuousReviewImages}
          projectId={projectId}
          sectionId={sectionId}
          sectionName={data.sectionName}
          sectionSortOrder={data.sectionSortOrder}
          initialBatchSize={data.batchSize ?? 2}
        />
      </SectionCard>
    </div>
  );
}

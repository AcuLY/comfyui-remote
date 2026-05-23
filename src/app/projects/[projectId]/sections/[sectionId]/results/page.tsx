import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Images, Pencil } from "lucide-react";
import { SectionCard } from "@/components/section-card";
import { getSectionResults } from "@/lib/server-data";
import { hrefWithFolderQuery } from "@/lib/folder-navigation";
import { prisma } from "@/lib/prisma";
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

  // Find current section's sortOrder for the next-pending query
  const currentSection = await prisma.projectSection.findUnique({
    where: { id: sectionId },
    select: { sortOrder: true },
  });

  // Find next section with pending images
  const nextPendingSection = currentSection
    ? await prisma.projectSection.findFirst({
        where: {
          projectId,
          id: { not: sectionId },
          sortOrder: { gt: currentSection.sortOrder ?? 0 },
          runs: {
            some: {
              images: {
                some: { reviewStatus: "pending" },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      })
    : null;

  const totalImages = data.runs.reduce((sum, run) => sum + run.images.length, 0);
  const returnHref = hrefWithFolderQuery(
    `/projects/${projectId}`,
    "sectionFolder",
    data.sectionFolderId,
    `section-${sectionId}`,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnHref}
          scroll={false}
          className="inline-flex items-center gap-2 text-sm text-zinc-300"
        >
          <ArrowLeft className="size-4" /> 返回项目详情
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/projects/${projectId}/sections/${sectionId}`}
            data-nav-editor
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 transition hover:bg-sky-500/20 hover:text-sky-200"
          >
            <Pencil className="size-3.5" />
            返回小节
          </Link>
          <Link
            href={`/projects/${projectId}/results`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-300 transition hover:bg-violet-500/20 hover:text-violet-200"
          >
            <Images className="size-3.5" />
            项目结果
          </Link>
          {data.previousSection ? (
            <Link
              href={`/projects/${projectId}/sections/${data.previousSection.id}/results`}
              data-section-nav="previous"
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
              data-section-nav="next"
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
        <ResultsGrid
          runs={data.runs}
          sectionId={sectionId}
          initialBatchSize={data.batchSize ?? 2}
        />
      </SectionCard>
      {nextPendingSection && (
        <a
          href={`/projects/${projectId}/sections/${nextPendingSection.id}/results`}
          data-nav-next-pending
          className="hidden"
        />
      )}
    </div>
  );
}

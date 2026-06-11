"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import type { DemoData, DemoRun } from "../../data";
import { filterImages, findProject, findSection, rawSectionId } from "../../routing";
import type { ResultDemoFilter } from "../../routing";
import { ButtonLink } from "../../shared/primitives/button";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { PageHeader } from "../../shared/primitives/page-header";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
import { ReviewImageBoard } from "../../shared/media/review-image-board";
import { mergeExecutionMeta, ReviewMetaCard } from "./review-meta-card";
import s from "./review-page.runs.module.css";

const SCROLL_RESTORE_KEY = "demo-runs-from";

export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined }) {
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const metaOpen = searchParams?.get("meta") === "open";

  // Store current runId in sessionStorage so the list page can scroll back to it
  useEffect(() => {
    if (run) {
      try { sessionStorage.setItem(SCROLL_RESTORE_KEY, run.id); } catch {}
    }
  }, [run]);

  if (!run) return <EmptyPage title="没有可审核运行" />;
  return <ReviewPageContent key={run.id} data={data} run={run} metaOpen={metaOpen} />;
}

function ReviewPageContent({ data, run, metaOpen }: { data: DemoData; run: DemoRun; metaOpen: boolean }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [runImages, setRunImages] = useState(run.images);
  const images = filterImages(runImages, filter);
  const project = findProject(data, run.projectId);
  const section = findSection(project, run.sectionId);
  const sectionPath = project && section ? `/projects/${project.id}/sections/${rawSectionId(section)}` : null;
  const executionMeta = section ? mergeExecutionMeta(run, section) : null;
  return (
    <div className={s.page}>
      <PageHeader
        className={s.reviewPageHeader}
        back={{ href: "/runs", label: "返回任务" }}
        eyebrow="审核"
        title={`${run.projectTitle} / ${run.sectionName}`}
        subtitle={project?.notes || undefined}
        actions={
          <>
            {sectionPath ? <ButtonLink href={sectionPath} icon={ExternalLink}>跳转至小节</ButtonLink> : null}
            <a className={s.workflowDownloadLink} href={`/api/runs/${run.id}/workflow`} download>
              <Download className={s.iconMd} />
              下载工作流文件
            </a>
          </>
        }
      />
      {section ? (
        <ReviewMetaCard run={run} meta={executionMeta} defaultOpen={metaOpen} />
      ) : null}
      <section className={s.reviewSurface}>
        <SegmentedControl
          ariaLabel="切换视图"
          className={s.reviewFilterTabs}
          role="tablist"
          items={[
            { value: "all", label: "全部", count: runImages.length },
            { value: "pending", label: "待审", count: runImages.filter((image) => image.status === "pending").length },
            { value: "kept", label: "已保留", count: runImages.filter((image) => image.status === "kept").length },
            { value: "pstation", label: "p站", count: runImages.filter((image) => image.featured).length },
            { value: "preview", label: "预览", count: runImages.filter((image) => image.featured2).length },
            { value: "cover", label: "封面", count: runImages.filter((image) => image.cover).length },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <ReviewImageBoard images={images} onImagesChange={(updated) => {
          setRunImages((prev) => prev.map((img) => {
            const match = updated.find((u) => u.id === img.id);
            return match ?? img;
          }));
        }} />
      </section>
    </div>
  );
}

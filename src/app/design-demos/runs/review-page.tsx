"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";

import type { DemoData, DemoRun } from "../design-demo-data";
import { filterImages, findProject, findSection, rawSectionId } from "../design-demo-utils";
import type { ResultDemoFilter } from "../design-demo-utils";
import { ButtonLink } from "../ui/button-link";
import { DemoTabs } from "../ui/demo-tabs";
import { EmptyPage } from "../ui/empty-page";
import { PageHeader } from "../ui/page-header";
import { ReviewImageBoard } from "../ui/review-image-board";
import { mergeExecutionMeta, ReviewMetaCard } from "./review-meta-card";
import s from "../styles/runs.module.css";

export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  if (!run) return <EmptyPage title="没有可审核运行" />;
  const images = filterImages(run.images, filter);
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
            <a className={s.button} href={`/api/runs/${run.id}/workflow`} download>
              <Download className={s.iconMd} />
              下载工作流文件
            </a>
          </>
        }
      />
      {section ? (
        <ReviewMetaCard section={section} run={run} meta={executionMeta} />
      ) : null}
      <section className={s.reviewSurface}>
        <div className={s.reviewSurfaceTabs}>
          <DemoTabs
            tabs={[
              { key: "all", label: "全部", count: run.images.length },
              { key: "pending", label: "待审", count: run.images.filter((image) => image.status === "pending").length },
              { key: "kept", label: "已保留", count: run.images.filter((image) => image.status === "kept").length },
              { key: "pstation", label: "p站", count: run.images.filter((image) => image.featured).length },
              { key: "preview", label: "预览", count: run.images.filter((image) => image.featured2).length },
              { key: "cover", label: "封面", count: run.images.filter((image) => image.cover).length },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <ReviewImageBoard images={images} />
      </section>
    </div>
  );
}

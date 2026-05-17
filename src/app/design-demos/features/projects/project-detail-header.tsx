"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Play } from "lucide-react";

import type { DemoProject } from "../../data";
import { demoHref } from "../../routing";
import type { ProjectCardView } from "../../routing";
import s from "./project-detail-header.projects.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { SegmentedControl } from "../../shared/primitives/segmented-control";

const BATCH_SIZE_OPTIONS = [1, 2, 4, 8, 16];

export function ProjectDetailHeader({
  isResultView,
  project,
  subtitle,
  view,
}: {
  isResultView: boolean;
  project: DemoProject;
  subtitle: string;
  view: ProjectCardView;
}) {
  const [batchSize, setBatchSize] = useState(2);

  return (
    <header className={s.projectDetailHeader}>
      <div className={s.projectHeaderTop}>
        <div className={s.pageTitleBlock}>
          <ButtonLink href="/projects" tone="subtle" icon={ArrowLeft} className={s.pageBackLink}>
            返回项目列表
          </ButtonLink>
          <span className={s.eyebrow}>项目</span>
          <div className={s.projectTitleRow}>
            <h1 className={s.pageTitle}>{project.title}</h1>
          </div>
          <div className={s.pageSubtitle}>{subtitle}</div>
        </div>
        <div className={s.projectHeaderControls}>
          <ProjectViewToggle projectId={project.id} value={view} />
          {!isResultView ? (
            <div className={s.projectRunCluster} role="group" aria-label="整组运行">
              <SegmentedControl
                ariaLabel="批量张数"
                className={s.sectionRunBatchControl}
                compact
                dense
                fitItems
                fitItemWidth={32}
                items={BATCH_SIZE_OPTIONS.map((option) => ({ value: option, label: option }))}
                onChange={setBatchSize}
                value={batchSize}
              />
              <Button
                ariaLabel="整组运行"
                className={s.projectRunButton}
                feedback={{ title: "整组运行已加入任务", detail: `${project.sectionCount} 个小节 · batch ${batchSize}` }}
                icon={Play}
                iconOnly
                tone="primary"
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProjectViewToggle({ projectId, value }: { projectId: string; value: ProjectCardView }) {
  const router = useRouter();

  return (
    <SegmentedControl
      ariaLabel="项目视图"
      className={s.projectViewToggle}
      items={[
        { value: "sections", label: "小节" },
        { value: "results", label: "结果" },
      ]}
      onChange={(nextView) => {
        router.push(demoHref(nextView === "sections" ? `/projects/${projectId}` : `/projects/${projectId}/results`));
      }}
      role="tablist"
      value={value}
    />
  );
}

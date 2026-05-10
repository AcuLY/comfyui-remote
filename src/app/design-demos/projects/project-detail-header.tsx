"use client";

import { useState } from "react";
import { ArrowLeft, Download, Edit3, ImageIcon, Play, Rows3, Save } from "lucide-react";

import type { DemoProject } from "../design-demo-data";
import { cx } from "../design-demo-utils";
import type { ProjectCardView } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { Button } from "../ui/button";
import { ButtonLink } from "../ui/button-link";
import { BatchSizeSelector } from "./batch-size-selector";

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
            <ButtonLink href={`/projects/${project.id}/edit`} icon={Edit3} className={s.projectTitleEdit}>编辑</ButtonLink>
          </div>
          <div className={s.pageSubtitle}>{subtitle}</div>
        </div>
        <div className={s.projectHeaderControls}>
          <ProjectViewToggle projectId={project.id} value={view} />
        </div>
      </div>
      {!isResultView ? (
        <div className={s.projectCommandBar} role="toolbar" aria-label="项目命令">
          <div className={s.projectCommandSecondary}>
            <ButtonLink href={`/projects/${project.id}/batch-create`} tone="primary" icon={Rows3}>批量创建</ButtonLink>
            <Button icon={Download} feedback={{ title: "导入模板面板已准备" }}>导入模板</Button>
            <Button icon={ImageIcon} feedback={{ title: "图片整合已加入导出队列" }}>图片整合</Button>
            <Button icon={Save} feedback={{ title: "已保存为项目模板", detail: "使用当前小节结构和参数。" }}>保存模板</Button>
          </div>
          <div className={s.projectRunCluster} role="group" aria-label="整组运行">
            <span>批量张数</span>
            <BatchSizeSelector value={batchSize} onChange={setBatchSize} compact />
            <Button icon={Play} feedback={{ title: "整组运行已加入任务", detail: `${project.sectionCount} 个小节 · batch ${batchSize}` }}>整组运行</Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function ProjectViewToggle({ projectId, value }: { projectId: string; value: ProjectCardView }) {
  return (
    <div className={cx(s.segmented, s.projectViewToggle)} aria-label="项目视图">
      <ButtonLink href={`/projects/${projectId}`} className={cx(s.projectViewToggleButton, value === "sections" && s.projectViewToggleButtonActive)}>
        小节
      </ButtonLink>
      <ButtonLink href={`/projects/${projectId}/results`} className={cx(s.projectViewToggleButton, value === "results" && s.projectViewToggleButtonActive)}>
        结果
      </ButtonLink>
    </div>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, FileText, Layers } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingProject } from "@/features/training/types";

import { findProject, isProductionTrainingPath } from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { RunRows } from "./project-run-rows";
import { TrainingResultGrid } from "./training-result-grid";
import s from "./training-project-pages.module.css";
import { useProjectArchiveState } from "./use-project-archive-state";

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingData(data);
}

export function LoraTrainingProjectDetailPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const { isProjectArchived, setProjectArchived } = useProjectArchiveState(project?.id ?? null, project?.status === "archived");
  const [isUpdatingProjectArchive, setIsUpdatingProjectArchive] = useState(false);
  if (!project) return <EmptyPage title="没有训练项目数据" />;
  const sourceProject = project;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const activeProject: LoraTrainingProject = isProjectArchived
    ? { ...sourceProject, status: "archived" }
    : sourceProject.status === "archived"
      ? { ...sourceProject, status: "ready" }
      : sourceProject;
  const recentRuns = training.runs.filter((run) => run.projectId === sourceProject.id).slice(0, 4);
  const recentResults = sourceProject.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 4);
  const latestRevision = sourceProject.datasetRevisions[0];

  async function handleToggleProjectArchive() {
    const currentArchived = isProjectArchived;
    const nextArchived = !currentArchived;

    const applyLocalArchiveState = () => {
      setProjectArchived(nextArchived);
    };

    if (!isProductionTrainingRoute) {
      applyLocalArchiveState();
      pushToast({
        tone: nextArchived ? "warning" : "success",
        title: nextArchived ? "训练项目已归档" : "训练项目已恢复",
        detail: sourceProject.title,
      });
      return;
    }

    if (isUpdatingProjectArchive) return;

    setIsUpdatingProjectArchive(true);
    try {
      const response = await fetch(`/api/training/projects/${sourceProject.id}/${currentArchived ? "restore" : "archive"}`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: currentArchived ? "恢复失败" : "归档失败",
          detail: payload?.error?.message ?? "训练项目状态更新请求失败",
        });
        return;
      }

      applyLocalArchiveState();
      pushToast({
        tone: nextArchived ? "warning" : "success",
        title: nextArchived ? "训练项目已归档" : "训练项目已恢复",
        detail: sourceProject.title,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: currentArchived ? "恢复失败" : "归档失败",
        detail: error instanceof Error ? error.message : "训练项目状态更新请求失败",
      });
    } finally {
      setIsUpdatingProjectArchive(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="overview"
        project={activeProject}
        subtitle={isProjectArchived ? `${sourceProject.profileSummary} · 已归档` : sourceProject.profileSummary}
        actions={(
          <Button
            tone={isProjectArchived ? "subtle" : "danger"}
            icon={Archive}
            pending={isUpdatingProjectArchive}
            onClick={handleToggleProjectArchive}
          >
            {isProjectArchived ? "恢复" : "归档"}
          </Button>
        )}
      />
      <div className={s.overviewGrid}>
        <Panel title="角色资料">
          <div className={s.stack}>
            <p className={s.bodyText}>{sourceProject.profileSummary}</p>
            <div className={s.heroStrip}>
              <ImageListSmall images={sourceProject.referenceImages.map((reference) => reference.image)} limit={sourceProject.referenceImages.length} />
            </div>
            <ButtonLink href={`/training/projects/${sourceProject.id}/profile`} icon={FileText} ariaLabel={`编辑训练项目资料：${sourceProject.title}`}>
              编辑资料
            </ButtonLink>
          </div>
        </Panel>
        <Panel title="训练入口" subtitle="总览只放启动判断，完整训练准备和冻结版本在数据集页处理。">
          <div className={s.readinessSummary}>
            <span><strong>{sourceProject.keptCount}</strong> 已保留</span>
            <span><strong>{sourceProject.captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{latestRevision?.version ?? sourceProject.datasetVersion}</strong> 当前版本</span>
          </div>
          <ButtonLink href={`/training/projects/${sourceProject.id}/dataset`} icon={Layers} tone="primary" ariaLabel={`打开训练项目数据集工作台：${sourceProject.title}`}>
            打开数据集工作台
          </ButtonLink>
        </Panel>
        <Panel title="最近任务">
          <RunRows project={sourceProject} runs={recentRuns} />
        </Panel>
        <Panel title="最近产物" subtitle="只展示最近保留结果，完整审查在结果池。">
          <TrainingResultGrid results={recentResults} title="最近产物" />
        </Panel>
      </div>
    </div>
  );
}

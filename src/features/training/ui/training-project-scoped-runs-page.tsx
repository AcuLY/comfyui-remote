"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingRun, LoraTrainingTaskKind, LoraTrainingTaskStatus } from "@/features/training/types";
import {
  findProject,
  isProductionTrainingPath,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { RunRows } from "./project-run-rows";
import s from "./training-project-pages.module.css";

const STATUS_ITEMS: Array<{ value: LoraTrainingTaskStatus; label: string }> = [
  { value: "completed", label: "完成" },
  { value: "running", label: "进行中" },
  { value: "queued", label: "排队" },
  { value: "failed", label: "失败" },
];

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingData(data);
}

export function LoraTrainingProjectScopedRunsPage({
  data,
  kind,
  projectId,
}: {
  data: TrainingAppData;
  kind: LoraTrainingTaskKind;
  projectId?: string;
}) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [projectRunInteractionState, setProjectRunInteractionState] = useState(() => ({
    cancelledProjectRunIds: new Set<string>(),
    hiddenProjectRunIds: new Set<string>(),
    kind,
    projectId: project?.id ?? null,
    retriedProjectRunIds: new Set<string>(),
    status: "completed" as LoraTrainingTaskStatus,
  }));
  const [isCancellingProjectRuns, setIsCancellingProjectRuns] = useState(false);
  const [isRetryingProjectRuns, setIsRetryingProjectRuns] = useState(false);
  const [isDeletingProjectRuns, setIsDeletingProjectRuns] = useState(false);
  if (!project) return <EmptyPage title="没有项目任务数据" />;
  const activeProject = project;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const projectRunInteraction = projectRunInteractionState.projectId === activeProject.id && projectRunInteractionState.kind === kind ? projectRunInteractionState : {
    cancelledProjectRunIds: new Set<string>(),
    hiddenProjectRunIds: new Set<string>(),
    kind,
    projectId: activeProject.id,
    retriedProjectRunIds: new Set<string>(),
    status: "completed" as LoraTrainingTaskStatus,
  };
  const status = projectRunInteraction.status;
  const cancelledProjectRunIds = projectRunInteraction.cancelledProjectRunIds;
  const hiddenProjectRunIds = projectRunInteraction.hiddenProjectRunIds;
  const retriedProjectRunIds = projectRunInteraction.retriedProjectRunIds;
  const effectiveProjectRunStatus = (run: LoraTrainingRun) => (cancelledProjectRunIds.has(run.id) ? "failed" : run.status);
  const projectRuns = training.runs.filter((run) => run.projectId === activeProject.id && run.kind === kind && !hiddenProjectRunIds.has(run.id));
  const visibleRuns = projectRuns.filter((run) => effectiveProjectRunStatus(run) === status);

  function updateProjectRunInteraction(updater: (current: typeof projectRunInteraction) => typeof projectRunInteraction) {
    setProjectRunInteractionState((current) => {
      const active = current.projectId === activeProject.id && current.kind === kind ? current : {
        cancelledProjectRunIds: new Set<string>(),
        hiddenProjectRunIds: new Set<string>(),
        kind,
        projectId: activeProject.id,
        retriedProjectRunIds: new Set<string>(),
        status: "completed" as LoraTrainingTaskStatus,
      };
      return {
        ...updater(active),
        kind,
        projectId: activeProject.id,
      };
    });
  }

  function handleProjectRunStatusChange(nextStatus: LoraTrainingTaskStatus) {
    updateProjectRunInteraction((current) => ({
      ...current,
      status: nextStatus,
    }));
  }

  function applyLocalProjectRunDelete(runId: string) {
    updateProjectRunInteraction((current) => {
      const cancelledProjectRunIds = new Set(current.cancelledProjectRunIds);
      const retriedProjectRunIds = new Set(current.retriedProjectRunIds);
      cancelledProjectRunIds.delete(runId);
      retriedProjectRunIds.delete(runId);
      return {
        ...current,
        cancelledProjectRunIds,
        hiddenProjectRunIds: new Set([...current.hiddenProjectRunIds, runId]),
        retriedProjectRunIds,
      };
    });
  }

  function applyLocalProjectRunCancel(runId: string) {
    updateProjectRunInteraction((current) => ({
      ...current,
      cancelledProjectRunIds: new Set([...current.cancelledProjectRunIds, runId]),
    }));
  }

  async function handleDeleteProjectRun(runId: string) {
    const run = projectRuns.find((candidate) => candidate.id === runId);
    if (!run) return;

    if (!isProductionTrainingRoute) {
      applyLocalProjectRunDelete(runId);
      pushToast({
        tone: "warning",
        title: "任务已从项目列表移除",
        detail: run.title,
      });
      return;
    }

    if (isDeletingProjectRuns) return;

    setIsDeletingProjectRuns(true);
    try {
      const response = await fetch(
        run.kind === "generation"
          ? `/api/training/generation-tasks/${run.id}`
          : `/api/training/training-runs/${run.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "删除失败",
          detail: payload?.error?.message ?? "任务移除请求失败",
        });
        return;
      }

      applyLocalProjectRunDelete(runId);
      pushToast({
        tone: "warning",
        title: "任务已从项目列表移除",
        detail: run.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "删除失败",
        detail: error instanceof Error ? error.message : "任务移除请求失败",
      });
    } finally {
      setIsDeletingProjectRuns(false);
    }
  }

  async function handleCancelProjectRun(runId: string) {
    const run = projectRuns.find((candidate) => candidate.id === runId);
    if (!run || !(run.status === "queued" || run.status === "running")) return;
    const cancelTitle = run.kind === "generation" ? "生成任务已终止" : "训练任务已取消";

    if (!isProductionTrainingRoute) {
      applyLocalProjectRunCancel(runId);
      pushToast({
        tone: "warning",
        title: cancelTitle,
        detail: run.title,
      });
      return;
    }

    if (isCancellingProjectRuns) return;

    setIsCancellingProjectRuns(true);
    try {
      const response = await fetch(
        run.kind === "generation"
          ? `/api/training/generation-tasks/${run.id}/cancel`
          : `/api/training/training-runs/${run.id}/cancel`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestedBy: run.kind === "generation" ? "training_project_generation_runs_page" : "training_project_training_runs_page",
          }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "取消失败",
          detail: payload?.error?.message ?? "任务取消请求失败",
        });
        return;
      }

      applyLocalProjectRunCancel(runId);
      pushToast({
        tone: "warning",
        title: cancelTitle,
        detail: run.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "取消失败",
        detail: error instanceof Error ? error.message : "任务取消请求失败",
      });
    } finally {
      setIsCancellingProjectRuns(false);
    }
  }

  async function handleRetryProjectRun(runId: string) {
    const run = projectRuns.find((candidate) => candidate.id === runId);
    if (!run) return;

    const applyLocalRetryState = () => {
      updateProjectRunInteraction((current) => ({
        ...current,
        retriedProjectRunIds: new Set([...current.retriedProjectRunIds, runId]),
      }));
    };

    if (!isProductionTrainingRoute) {
      applyLocalRetryState();
      pushToast({
        tone: "success",
        title: "重试已排队",
        detail: run.title,
      });
      return;
    }

    if (isRetryingProjectRuns) return;

    setIsRetryingProjectRuns(true);
    try {
      const response = run.kind === "generation"
        ? await (async () => {
            if (!run.sectionId) {
              throw new Error("当前生成任务缺少小节上下文，无法重试。");
            }
            return fetch(`/api/training/sections/${run.sectionId}/runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                parentRunId: run.id,
                projectId: activeProject.id,
              }),
            });
          })()
        : await (async () => {
            if (!run.datasetRevisionId) {
              throw new Error("当前训练任务缺少数据集版本，无法重试。");
            }
            return fetch(`/api/training/projects/${activeProject.id}/training-runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                revisionId: run.datasetRevisionId,
                config: {
                  overrides: {
                    ordinary: {
                      targetSteps: run.targetSteps,
                    },
                  },
                },
              }),
            });
          })();
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "重试失败",
          detail: payload?.error?.message ?? "重试请求失败",
        });
        return;
      }

      applyLocalRetryState();
      pushToast({
        tone: "success",
        title: "重试已排队",
        detail: run.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "重试失败",
        detail: error instanceof Error ? error.message : "重试请求失败",
      });
    } finally {
      setIsRetryingProjectRuns(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active={kind === "generation" ? "generation" : "training"}
        project={project}
        title={`${project.title} / ${kind === "generation" ? "生成任务" : "训练任务"}`}
      />
      <SegmentedControl
        ariaLabel="切换任务状态"
        panel
        role="tablist"
        items={STATUS_ITEMS.map((item) => ({ ...item, count: projectRuns.filter((run) => effectiveProjectRunStatus(run) === item.value).length }))}
        value={status}
        onChange={handleProjectRunStatusChange}
      />
      <Panel title={kind === "generation" ? "项目生成任务" : "项目训练任务"}>
        <RunRows
          cancelledRunIds={cancelledProjectRunIds}
          isCancellingRuns={isCancellingProjectRuns}
          onCancelRun={handleCancelProjectRun}
          onDeleteRun={handleDeleteProjectRun}
          isDeletingRuns={isDeletingProjectRuns}
          onRetryRun={handleRetryProjectRun}
          project={project}
          retriedRunIds={retriedProjectRunIds}
          runs={visibleRuns}
        />
      </Panel>
    </div>
  );
}

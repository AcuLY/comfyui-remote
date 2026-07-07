"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  Play,
  Snowflake,
} from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingImageResult, LoraTrainingProject, LoraTrainingRun, LoraTrainingTaskKind, LoraTrainingTaskStatus } from "@/features/training/types";
import {
  buildLocalDatasetRevision,
  captionMissing,
  deriveDatasetCaption,
  findProject,
  isProductionTrainingPath,
  nextDatasetVersionLabel,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { RunRows } from "./project-run-rows";
import { TrainingResultGrid } from "./training-result-grid";
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

export { LoraTrainingProjectFormPage } from "./training-project-form-page";
export { LoraTrainingProjectDetailPage } from "./training-project-detail-page";
export { LoraTrainingProjectProfilePage } from "./training-project-profile-page";
export { LoraTrainingProjectSectionsPage } from "./training-project-sections-page";
export { LoraTrainingProjectSectionDetailPage } from "./training-project-section-detail-page";

export { LoraTrainingGenerationComposePage } from "./training-generation-compose-page";

export { LoraTrainingProjectResultsPage } from "./training-project-results-page";

export function LoraTrainingProjectDatasetPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const hrefForRoute = useRouteHref();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [datasetResultState, setDatasetResultState] = useState<{
    hasOverride: boolean;
    projectId: string | null;
    results: LoraTrainingImageResult[] | null;
  }>(() => ({
    hasOverride: false,
    projectId: project?.id ?? null,
    results: null,
  }));
  const [datasetRevisionState, setDatasetRevisionState] = useState<{
    datasetVersion: string | null;
    hasOverride: boolean;
    projectId: string | null;
    revisions: LoraTrainingProject["datasetRevisions"] | null;
  }>(() => ({
    datasetVersion: null,
    hasOverride: false,
    projectId: project?.id ?? null,
    revisions: null,
  }));
  const [trainingDraftState, setTrainingDraft] = useState<{
    draft: {
      captionMissingCount: number;
      keptCount: number;
      stepCount: number;
      version: string;
    } | null;
    projectId: string | null;
  }>(() => ({
    draft: null,
    projectId: project?.id ?? null,
  }));
  const [isGeneratingDatasetCaptions, setIsGeneratingDatasetCaptions] = useState(false);
  const [isFreezingDataset, setIsFreezingDataset] = useState(false);
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  if (!project) return <EmptyPage title="没有训练数据集数据" />;
  const activeProject = project;
  const hasDatasetResultOverride = datasetResultState.projectId === activeProject.id && datasetResultState.hasOverride;
  const resultPool = hasDatasetResultOverride ? (datasetResultState.results ?? activeProject.resultPool) : activeProject.resultPool;
  const keptResults = resultPool.filter((result) => result.reviewStatus === "kept");
  const keptCount = hasDatasetResultOverride ? keptResults.length : activeProject.keptCount;
  const captionMissingCount = hasDatasetResultOverride
    ? keptResults.filter((result) => captionMissing(result.caption)).length
    : activeProject.captionMissingCount;
  const hasDatasetRevisionOverride = datasetRevisionState.projectId === activeProject.id && datasetRevisionState.hasOverride;
  const datasetVersion = hasDatasetRevisionOverride ? (datasetRevisionState.datasetVersion ?? activeProject.datasetVersion) : activeProject.datasetVersion;
  const datasetRevisions = hasDatasetRevisionOverride ? (datasetRevisionState.revisions ?? activeProject.datasetRevisions) : activeProject.datasetRevisions;
  const trainingDraft = trainingDraftState.projectId === activeProject.id ? trainingDraftState.draft : null;
  const latestRevision = datasetRevisions[0] ?? null;
  const activeTrainingRuns = training.runs.filter((run) =>
    run.kind === "training"
    && run.projectId === activeProject.id
    && (run.status === "queued" || run.status === "running"));
  const activeTrainingRun = activeTrainingRuns[0] ?? null;
  const hasActiveTrainingRun = activeTrainingRuns.length > 0;
  const startTrainingBlockedReason = hasActiveTrainingRun
    ? `同一训练项目不能同时存在多个进行中训练任务。当前任务：${activeTrainingRun?.title ?? "训练中"}`
    : keptCount === 0
      ? "至少保留 1 张训练图片后才能启动训练。"
      : captionMissingCount > 0
        ? `还有 ${captionMissingCount} 张保留图片缺少说明文本，请先补齐。`
        : null;
  const startTrainingActionLabel = hasActiveTrainingRun
    ? "训练进行中"
    : startTrainingBlockedReason
      ? "准备数据集"
      : trainingDraft
        ? "更新训练草稿"
        : "启动训练";

  async function handleGenerateDatasetCaptions() {
    if (isGeneratingDatasetCaptions || captionMissingCount === 0) return;

    if (!isProductionTrainingRoute) {
      const nextResults = resultPool.map((result) => {
        if (result.reviewStatus !== "kept" || !captionMissing(result.caption)) return result;
        return {
          ...result,
          caption: deriveDatasetCaption(result),
        };
      });
      setDatasetResultState({
        hasOverride: true,
        projectId: activeProject.id,
        results: nextResults,
      });
      pushToast({
        tone: "success",
        title: "说明文本已批量生成",
        detail: `${captionMissingCount} 张图片已补全`,
      });
      return;
    }

    setIsGeneratingDatasetCaptions(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/captions/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "kept_without_captions",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "批量生成说明文本失败",
          detail: payload?.error?.message ?? "说明文本批量生成请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: "说明文本已批量生成",
        detail: typeof payload?.data?.taskCount === "number" ? `${payload.data.taskCount} 张图片已补全` : activeProject.title,
      });
      setDatasetResultState({
        hasOverride: false,
        projectId: activeProject.id,
        results: null,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "批量生成说明文本失败",
        detail: error instanceof Error ? error.message : "说明文本批量生成请求失败",
      });
    } finally {
      setIsGeneratingDatasetCaptions(false);
    }
  }

  async function handleFreezeDatasetRevision() {
    if (isFreezingDataset) return;
    const nextVersion = nextDatasetVersionLabel(datasetVersion);

    if (!isProductionTrainingRoute) {
      const nextRevision = buildLocalDatasetRevision(activeProject.id, resultPool, nextVersion);
      setDatasetRevisionState({
        datasetVersion: nextVersion,
        hasOverride: true,
        projectId: activeProject.id,
        revisions: [nextRevision, ...datasetRevisions],
      });
      pushToast({
        tone: "success",
        title: "数据集版本已冻结",
        detail: nextVersion,
      });
      return;
    }

    setIsFreezingDataset(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/dataset-revisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "冻结数据集失败",
          detail: payload?.error?.message ?? "数据集冻结请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: "数据集版本已冻结",
        detail: nextVersion,
      });
      setDatasetRevisionState({
        datasetVersion: null,
        hasOverride: false,
        projectId: activeProject.id,
        revisions: null,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "冻结数据集失败",
        detail: error instanceof Error ? error.message : "数据集冻结请求失败",
      });
    } finally {
      setIsFreezingDataset(false);
    }
  }

  async function handleOpenTrainingDraft() {
    if (startTrainingBlockedReason) {
      pushToast({
        tone: "warning",
        title: hasActiveTrainingRun ? "训练任务已在进行中" : "请先准备数据集",
        detail: startTrainingBlockedReason,
      });
      return;
    }

    const nextDraft = {
      draft: {
        captionMissingCount,
        keptCount,
        stepCount: 2400,
        version: datasetVersion,
      },
      projectId: activeProject.id,
    };

    if (!isProductionTrainingRoute) {
      setTrainingDraft(nextDraft);
      pushToast({
        tone: "success",
        title: trainingDraft ? "训练配置草稿已更新" : "训练配置草稿已打开",
        detail: datasetVersion,
      });
      return;
    }

    if (isStartingTraining) return;

    setIsStartingTraining(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/training-runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revisionId: latestRevision?.id,
          config: {
            overrides: {
              ordinary: {
                targetSteps: nextDraft.draft.stepCount,
              },
            },
          },
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "训练任务创建失败",
          detail: payload?.error?.message ?? "训练任务创建请求失败",
        });
        return;
      }

      setTrainingDraft(nextDraft);
      pushToast({
        tone: "success",
        title: "训练任务已创建",
        detail: datasetVersion,
      });
      router.push(`/training/runs/training/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练任务创建失败",
        detail: error instanceof Error ? error.message : "训练任务创建请求失败",
      });
    } finally {
      setIsStartingTraining(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="dataset"
        project={activeProject}
        actions={(
          <>
            <Button
              icon={Snowflake}
              disabled={keptCount === 0}
              pending={isFreezingDataset}
              onClick={handleFreezeDatasetRevision}
            >
              冻结当前版本
            </Button>
            <Button
              tone="primary"
              icon={Play}
              disabled={Boolean(startTrainingBlockedReason) || isStartingTraining}
              pending={!startTrainingBlockedReason && isStartingTraining}
              onClick={handleOpenTrainingDraft}
            >
              {startTrainingActionLabel}
            </Button>
          </>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="训练准备" subtitle="只有已保留图片进入冻结版本，后续编辑不会回写已冻结版本。">
          <div className={s.readinessSummary}>
            <span><strong>{keptCount}</strong> 已保留图片</span>
            <span><strong>{captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{datasetVersion}</strong> 当前版本</span>
          </div>
          <p className={s.bodyText}>准备信息保持在训练入口附近，完整样本与冻结快照继续由下方草稿和版本列表承载。</p>
          {startTrainingBlockedReason ? <p className={s.bodyText}>{startTrainingBlockedReason}</p> : null}
        </Panel>
        <Panel title="冻结版本">
          <div className={s.entityRowsSurface}>
            <div className={s.entityRows}>
              {datasetRevisions.map((revision) => (
                <Link className={s.entityRow} href={hrefForRoute(`/training/projects/${activeProject.id}/dataset/revisions/${revision.id}`)} key={revision.id}>
                  <div>
                    <strong>{revision.version}</strong>
                    <span>{revision.itemCount} 张 · 缺说明文本 {revision.captionMissingCount} · {revision.manifestName}</span>
                  </div>
                  <StatusBadge status={revision.status} label={revision.status === "ready" ? "可训练" : revision.status === "draft" ? "草稿" : "训练中"} />
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      {trainingDraft ? (
        <Panel title="训练配置草稿" subtitle="基于当前数据集版本生成，可继续调整结果池和数据集后更新。">
          <dl className={s.trainingDraft}>
            <div><dt>数据集版本</dt><dd>{trainingDraft.version}</dd></div>
            <div><dt>已保留图片</dt><dd>{trainingDraft.keptCount} 张</dd></div>
            <div><dt>缺说明文本</dt><dd>{trainingDraft.captionMissingCount}</dd></div>
            <div><dt>训练步数</dt><dd>{trainingDraft.stepCount}</dd></div>
          </dl>
        </Panel>
      ) : null}
      <Panel
        title="已保留草稿"
        actions={(
          <Button
            icon={FileText}
            disabled={captionMissingCount === 0}
            pending={isGeneratingDatasetCaptions}
            onClick={handleGenerateDatasetCaptions}
          >
            批量生成说明文本
          </Button>
        )}
      >
        <TrainingResultGrid results={keptResults} title="已保留草稿" />
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectDatasetRevisionPage({ data, projectId, revisionId }: { data: TrainingAppData; projectId?: string; revisionId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const revision = project?.datasetRevisions.find((item) => item.id === revisionId);
  if (!project || !revision) return <EmptyPage title="没有冻结版本数据" />;
  const revisionResults = revision.samples.map((sample) => ({
    id: sample.id,
    sectionId: sample.sectionTitle,
    sectionTitle: sample.sectionTitle,
    image: sample.image,
    reviewStatus: "kept" as const,
    caption: sample.captionSnapshot,
    sourceLabel: `${sample.label} · ${sample.filePathSnapshot}`,
  }));
  const relatedRuns = training.runs.filter((run) => revision.relatedTrainingRunIds.includes(run.id) || run.datasetRevisionId === revision.id);

  return (
    <div className={s.page}>
      <ProjectHeader active="dataset" project={project} title={`${project.title} / 数据集 ${revision.version}`} />
      <div className={s.twoCol}>
        <Panel title="版本快照">
          <dl className={s.statGrid}>
            <div><dt>状态</dt><dd>{revision.status}</dd></div>
            <div><dt>图片</dt><dd>{revision.itemCount} 张</dd></div>
            <div><dt>缺说明文本</dt><dd>{revision.captionMissingCount}</dd></div>
            <div><dt>文件清单</dt><dd>{revision.manifestName}</dd></div>
          </dl>
        </Panel>
        <Panel title="关联训练">
          <RunRows project={project} runs={relatedRuns} />
        </Panel>
      </div>
      <Panel title="样本快照与说明文本">
        <TrainingResultGrid results={revisionResults} title={`${revision.version} 样本快照`} />
      </Panel>
      <Panel title="文件清单">
        <div className={s.manifestListSurface}>
          <ol className={s.manifestList}>
            {revision.manifestRows.map((row) => <li key={row}>{row}</li>)}
          </ol>
        </div>
      </Panel>
    </div>
  );
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

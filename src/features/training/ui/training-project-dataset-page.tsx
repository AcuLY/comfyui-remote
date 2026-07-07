"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { FileText, Play, Snowflake } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingImageResult, LoraTrainingProject } from "@/features/training/types";

import {
  buildLocalDatasetRevision,
  captionMissing,
  deriveDatasetCaption,
  findProject,
  isProductionTrainingPath,
  nextDatasetVersionLabel,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { TrainingResultGrid } from "./training-result-grid";
import s from "./training-project-pages.module.css";

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingData(data);
}

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

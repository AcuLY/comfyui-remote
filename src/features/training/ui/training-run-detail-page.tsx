"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, ExternalLink, History, ImageIcon, ImagePlus, Play, RotateCcw, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import { ImageThumbMedium } from "@/components/design-demo-ui/media/image-thumb-medium";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingReviewStatus, LoraTrainingRun, LoraTrainingTaskKind } from "@/features/training/types";
import { GenerationOutputGrid } from "./training-run-generation-output-grid";
import {
  findRun,
  generationResultsForRun,
  isProductionTrainingPath,
  progressPercent,
  trainingArtifactLabel,
  trainingConfigText,
  trainingPresetStatusLabel,
  trainingRunDetailTitle,
} from "./training-run-detail-utils";
import s from "./training-run-detail-page.module.css";

type RetryDraft = {
  runId: string;
  projectTitle: string;
  title: string;
  provider: string;
  queuedAt: string;
  sourceStatus: LoraTrainingRun["status"];
  datasetVersion?: string;
};

type ActiveSampleState = {
  index: number;
  runId: string;
};

type CopiedCaptionState = {
  caption: string;
  runId: string;
  sampleId: string;
};

function runStatusBadge(run: LoraTrainingRun) {
  if (run.status === "completed") return <StatusBadge status="done" label="已完成" />;
  if (run.status === "running") return <StatusBadge status="running" label="进行中" />;
  if (run.status === "queued") return <StatusBadge status="queued" label="排队中" />;
  return <StatusBadge status="failed" label="失败" />;
}

function toTrainingImageReviewApiStatus(reviewStatus: LoraTrainingReviewStatus) {
  return reviewStatus === "kept" ? "keep" : reviewStatus === "rejected" ? "reject" : "pending";
}

function reviewResultToastTitle(reviewStatus: LoraTrainingReviewStatus) {
  return reviewStatus === "kept" ? "图片已保留" : reviewStatus === "rejected" ? "图片已拒绝" : "图片已标记为待审核";
}

async function copyTextWithFallback(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall through when browser permissions block the Clipboard API.
  }

  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.className = s.clipboardTextarea;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function LoraTrainingRunDetailPage({
  data,
  kind,
  runId,
}: {
  data: TrainingAppData;
  kind: LoraTrainingTaskKind;
  runId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const [activeSampleState, setActiveSampleState] = useState<ActiveSampleState | null>(null);
  const [activeGenerationResultId, setActiveGenerationResultId] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<CopiedCaptionState | null>(null);
  const [resultReviewState, setResultReviewState] = useState<Record<string, LoraTrainingReviewStatus>>({});
  const [appliedGenerationOutputState, setAppliedGenerationOutputState] = useState<{
    appliedResultIds: Set<string>;
    pendingResultIds: Set<string>;
    runId: string | null;
  }>({
    appliedResultIds: new Set<string>(),
    pendingResultIds: new Set<string>(),
    runId: null,
  });
  const [retryDraft, setRetryDraft] = useState<RetryDraft | null>(null);
  const [cancelledRunId, setCancelledRunId] = useState<string | null>(null);
  const [createdPresetState, setCreatedPresetState] = useState<{
    createdAt: string;
    presetId: string;
    runId: string;
  } | null>(null);
  const [isQueueingRetry, setIsQueueingRetry] = useState(false);
  const [isCancellingTrainingRun, setIsCancellingTrainingRun] = useState(false);
  const [isCreatingTrainingPreset, setIsCreatingTrainingPreset] = useState(false);
  const [isReviewingGenerationOutput, setIsReviewingGenerationOutput] = useState(false);
  const training = buildLoraTrainingData(data);
  const run = findRun(data, kind, runId);
  const project = run ? training.projects.find((item) => item.id === run.projectId) : undefined;
  const percent = run ? progressPercent(run) : 0;

  if (!run) return <EmptyPage title={kind === "generation" ? "没有生成任务数据" : "没有训练任务数据"} />;

  const currentRun = run;
  const isGeneration = currentRun.kind === "generation";
  const currentRetryDraft = currentRun.status === "failed" && retryDraft?.runId === currentRun.id ? retryDraft : null;
  const isRetryQueued = Boolean(currentRetryDraft);
  const isRunCancelled = cancelledRunId === currentRun.id;
  const projectHref = `/training/projects/${currentRun.projectId}`;
  const datasetHref = currentRun.datasetRevisionId ? `${projectHref}/dataset/revisions/${currentRun.datasetRevisionId}` : `${projectHref}/dataset`;
  const datasetSamples = isGeneration ? [] : currentRun.datasetSamples ?? [];
  const inputImages = isGeneration ? currentRun.inputImages ?? [] : [];
  const generationOutputResults = generationResultsForRun(currentRun, project, resultReviewState);
  const generationOutputSection = isGeneration ? generationOutputResults[0] ?? null : null;
  const appliedGenerationOutputIds = appliedGenerationOutputState.runId === currentRun.id
    ? appliedGenerationOutputState.appliedResultIds
    : new Set<string>();
  const pendingGenerationOutputApplyIds = appliedGenerationOutputState.runId === currentRun.id
    ? appliedGenerationOutputState.pendingResultIds
    : new Set<string>();
  const generationSectionHref = generationOutputSection ? `${projectHref}/sections/${generationOutputSection.sectionId}` : null;
  const generationResultsHref = generationSectionHref ? `${generationSectionHref}#section-results` : null;
  const activeSample = activeSampleState?.runId === currentRun.id ? datasetSamples[activeSampleState.index] ?? null : null;
  const isActiveCaptionCopied = activeSample ? copiedCaption?.runId === currentRun.id && copiedCaption?.sampleId === activeSample.id : false;
  const locallyCreatedPresetAt = createdPresetState?.runId === currentRun.id ? createdPresetState.createdAt : null;
  const presetCreatedAt = currentRun.presetCreatedAt ?? locallyCreatedPresetAt;
  const canCreatePreset = !isGeneration && currentRun.status === "completed" && Boolean(currentRun.finalLoraArtifactId) && !currentRun.presetCreatedAt && !locallyCreatedPresetAt;
  const logText = currentRun.trainingLogLines?.length ? currentRun.trainingLogLines.join("\n") : "尚未创建训练日志";
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function handleCopyActiveCaption() {
    if (!activeSample) return;
    const caption = activeSample.caption;
    void copyTextWithFallback(caption);
    setCopiedCaption({ caption, runId: currentRun.id, sampleId: activeSample.id });
  }

  function setActiveSampleOffset(offset: -1 | 1) {
    setActiveSampleState((current) => {
      const index = current?.runId === currentRun.id ? current.index : 0;
      return { index: (index + datasetSamples.length + offset) % datasetSamples.length, runId: currentRun.id };
    });
  }

  async function handleQueueRetry() {
    const nextRetryDraft = {
      runId: currentRun.id,
      projectTitle: currentRun.projectTitle,
      title: currentRun.title,
      provider: currentRun.provider ?? (isGeneration ? "生成服务" : "本地训练"),
      queuedAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      sourceStatus: currentRun.status,
      datasetVersion: project?.datasetVersion,
    };

    if (!isProductionTrainingRoute) {
      setRetryDraft(nextRetryDraft);
      pushToast({
        tone: "success",
        title: "已加入重试队列",
        detail: currentRun.title,
      });
      return;
    }

    if (isQueueingRetry) return;

    setIsQueueingRetry(true);
    try {
      const response = isGeneration
        ? await (async () => {
            if (!currentRun.sectionId) {
              throw new Error("当前生成任务缺少小节上下文，无法重试。");
            }
            return fetch(`/api/training/sections/${currentRun.sectionId}/runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                parentRunId: currentRun.id,
                projectId: currentRun.projectId,
              }),
            });
          })()
        : await (async () => {
            if (!currentRun.datasetRevisionId) {
              throw new Error("当前训练任务缺少数据集版本，无法重试。");
            }
            return fetch(`/api/training/projects/${currentRun.projectId}/training-runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                revisionId: currentRun.datasetRevisionId,
                config: {
                  overrides: {
                    ordinary: {
                      targetSteps: currentRun.targetSteps,
                    },
                  },
                },
              }),
            });
          })();
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "重试失败",
          detail: payload?.error?.message ?? "重试请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: "重试已排队",
        detail: currentRun.title,
      });
      router.push(`/training/runs/${isGeneration ? "generation" : "training"}/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "重试失败",
        detail: error instanceof Error ? error.message : "重试请求失败",
      });
    } finally {
      setIsQueueingRetry(false);
    }
  }

  async function handleReviewGenerationOutput(resultId: string, reviewStatus: LoraTrainingReviewStatus) {
    const reviewedResult = generationOutputResults.find((result) => result.id === resultId);

    const applyLocalReview = () => {
      setResultReviewState((current) => ({ ...current, [resultId]: reviewStatus }));
    };

    if (!isProductionTrainingRoute) {
      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? currentRun.title,
      });
      return;
    }

    if (isReviewingGenerationOutput) return;

    setIsReviewingGenerationOutput(true);
    try {
      const response = await fetch(`/api/training/image-results/${resultId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: toTrainingImageReviewApiStatus(reviewStatus),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "结果审核失败",
          detail: payload?.error?.message ?? "训练结果审核请求失败",
        });
        return;
      }

      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? currentRun.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "结果审核失败",
        detail: error instanceof Error ? error.message : "训练结果审核请求失败",
      });
    } finally {
      setIsReviewingGenerationOutput(false);
    }
  }

  async function handleApplyGenerationOutput(resultId: string) {
    const appliedResult = generationOutputResults.find((result) => result.id === resultId);

    const applyLocalState = () => {
      setAppliedGenerationOutputState((current) => {
        const active = current.runId === currentRun.id ? current : {
          appliedResultIds: new Set<string>(),
          pendingResultIds: new Set<string>(),
          runId: currentRun.id,
        };
        const nextApplied = new Set(active.appliedResultIds);
        nextApplied.add(resultId);
        const nextPending = new Set(active.pendingResultIds);
        nextPending.delete(resultId);
        return {
          appliedResultIds: nextApplied,
          pendingResultIds: nextPending,
          runId: currentRun.id,
        };
      });
    };

    if (appliedGenerationOutputIds.has(resultId) || pendingGenerationOutputApplyIds.has(resultId)) {
      return;
    }

    if (!isProductionTrainingRoute) {
      applyLocalState();
      pushToast({
        tone: "success",
        title: "生成输出已加入资料图",
        detail: appliedResult?.sourceLabel ?? currentRun.title,
      });
      return;
    }

    setAppliedGenerationOutputState((current) => {
      const active = current.runId === currentRun.id ? current : {
        appliedResultIds: new Set<string>(),
        pendingResultIds: new Set<string>(),
        runId: currentRun.id,
      };
      return {
        appliedResultIds: active.appliedResultIds,
        pendingResultIds: new Set([...active.pendingResultIds, resultId]),
        runId: currentRun.id,
      };
    });

    try {
      const response = await fetch(`/api/training/generation-outputs/${resultId}/apply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetEntityType: "reference_image",
          targetEntityId: currentRun.projectId,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "加入资料图失败",
          detail: payload?.error?.message ?? "生成输出应用请求失败",
        });
        return;
      }

      applyLocalState();
      pushToast({
        tone: "success",
        title: "生成输出已加入资料图",
        detail: appliedResult?.sourceLabel ?? currentRun.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "加入资料图失败",
        detail: error instanceof Error ? error.message : "生成输出应用请求失败",
      });
    } finally {
      setAppliedGenerationOutputState((current) => {
        const active = current.runId === currentRun.id ? current : {
          appliedResultIds: new Set<string>(),
          pendingResultIds: new Set<string>(),
          runId: currentRun.id,
        };
        const nextPending = new Set(active.pendingResultIds);
        nextPending.delete(resultId);
        return {
          appliedResultIds: active.appliedResultIds,
          pendingResultIds: nextPending,
          runId: currentRun.id,
        };
      });
    }
  }

  async function handleCancelTrainingRun() {
    if (isRunCancelled) return;

    if (!isProductionTrainingRoute) {
      setCancelledRunId(currentRun.id);
      pushToast({
        tone: "warning",
        title: isGeneration ? "生成任务已取消" : "训练任务已取消",
        detail: currentRun.title,
      });
      return;
    }

    if (isCancellingTrainingRun) return;

    setIsCancellingTrainingRun(true);
    try {
      const response = await fetch(
        isGeneration
          ? `/api/training/generation-tasks/${currentRun.id}/cancel`
          : `/api/training/training-runs/${currentRun.id}/cancel`,
        {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestedBy: isGeneration ? "training_generation_run_detail" : "training_run_detail",
        }),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "取消失败",
          detail: payload?.error?.message ?? "训练任务取消请求失败",
        });
        return;
      }

      setCancelledRunId(currentRun.id);
      pushToast({
        tone: "warning",
        title: isGeneration ? "生成任务已取消" : "训练任务已取消",
        detail: currentRun.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "取消失败",
        detail: error instanceof Error ? error.message : "训练任务取消请求失败",
      });
    } finally {
      setIsCancellingTrainingRun(false);
    }
  }

  async function handleCreateTrainingPreset() {
    if (!canCreatePreset) return;

    if (!isProductionTrainingRoute) {
      setCreatedPresetState({
        createdAt: new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
        presetId: `training-preset-${currentRun.id}`,
        runId: currentRun.id,
      });
      pushToast({
        tone: "success",
        title: "训练预制已创建",
        detail: currentRun.title,
      });
      return;
    }

    if (isCreatingTrainingPreset) return;

    setIsCreatingTrainingPreset(true);
    try {
      const response = await fetch(`/api/training/training-runs/${currentRun.id}/create-preset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          presetName: `${currentRun.projectTitle} 训练预制`,
          category: "训练产物",
          folder: "LoRA 产物",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "创建训练预制失败",
          detail: payload?.error?.message ?? "训练预制创建请求失败",
        });
        return;
      }

      setCreatedPresetState({
        createdAt: payload.data.presetCreatedAt ?? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
        presetId: payload.data.id,
        runId: currentRun.id,
      });
      pushToast({
        tone: "success",
        title: "训练预制已创建",
        detail: currentRun.title,
      });
      router.push(`/training/presets/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "创建训练预制失败",
        detail: error instanceof Error ? error.message : "训练预制创建请求失败",
      });
    } finally {
      setIsCreatingTrainingPreset(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/runs", label: "返回运行" }}
        title={trainingRunDetailTitle(currentRun, project)}
        actions={(
            <>
              {generationSectionHref ? (
                <ButtonLink href={generationSectionHref} icon={ExternalLink} ariaLabel={`打开生成任务小节：${currentRun.title}`}>
                  跳转小节
                </ButtonLink>
              ) : null}
              {generationResultsHref ? (
                <ButtonLink href={generationResultsHref} icon={ImageIcon} ariaLabel={`查看生成任务结果：${currentRun.title}`}>
                  查看结果
                </ButtonLink>
              ) : null}
              {!isGeneration ? (
                <ButtonLink href={datasetHref} icon={History} ariaLabel={`查看训练任务数据集版本：${currentRun.title}`}>
                  数据集版本
                </ButtonLink>
              ) : null}
                    {!isRunCancelled && (currentRun.status === "queued" || currentRun.status === "running") ? (
                      <Button
                        tone="danger"
                        icon={Trash2}
                        pending={isCancellingTrainingRun}
                        ariaLabel={`${isGeneration ? "取消生成任务" : "取消训练任务"}：${currentRun.title}`}
                        onClick={handleCancelTrainingRun}
                      >
                        {isGeneration ? "取消生成" : "取消训练"}
                      </Button>
                    ) : null}
                    {currentRun.status === "failed" && !isRetryQueued ? <Button tone="primary" icon={RotateCcw} pending={isQueueingRetry} ariaLabel={`重试任务：${currentRun.title}`} onClick={handleQueueRetry}>重试</Button> : null}
                    {isRetryQueued ? <StatusBadge status="pending" label="已排队重试" /> : null}
              </>
            )}
          />

          <section className={s.statusSurface} aria-label="任务状态">
            <div>
              {isRetryQueued ? <StatusBadge status="pending" label="已排队重试" /> : isRunCancelled ? <StatusBadge status="failed" label="已取消" /> : runStatusBadge(currentRun)}
              <strong>{currentRun.provider ?? (isGeneration ? "生成服务" : "本地训练")}</strong>
              <span>{isRetryQueued ? "已加入重试队列，等待训练服务重新调度。" : isRunCancelled ? `${isGeneration ? "生成任务" : "训练任务"}已取消，等待状态同步。` : currentRun.schedulerMessage ?? currentRun.waitReason ?? currentRun.errorMessage ?? currentRun.outputLabel ?? "任务记录已同步"}</span>
            </div>
        <div className={s.progressBlock}>
          <span>{percent}%</span>
          <div className={s.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>
      </section>

      {currentRetryDraft ? (
        <section className={s.retryDraftPanel} aria-label="重试队列草稿">
          <div className={s.retryDraftTop}>
            <div>
              <StatusBadge status="pending" label="重试队列草稿" />
              <strong>{currentRetryDraft.projectTitle} / {currentRetryDraft.title}</strong>
            </div>
            <span>
              <Clock3 aria-hidden="true" />
              {currentRetryDraft.queuedAt}
            </span>
          </div>
          <p>失败记录已整理成本地重试草稿，可继续核对数据集版本、执行服务和失败来源后提交到训练队列。</p>
          <dl className={s.retryDraftMeta}>
            <div><dt>执行服务</dt><dd>{currentRetryDraft.provider}</dd></div>
            <div><dt>来源状态</dt><dd>{currentRetryDraft.sourceStatus === "failed" ? "失败记录" : currentRetryDraft.sourceStatus}</dd></div>
            <div><dt>数据集版本</dt><dd>{currentRetryDraft.datasetVersion ?? "生成任务无数据集版本"}</dd></div>
          </dl>
        </section>
      ) : null}

      <div className={s.detailGrid}>
        <Panel
          title={isGeneration ? "输出" : "训练产物"}
          subtitle={isGeneration ? "文本任务直接展示应用结果，图片任务展示进入结果池的样本。" : "完成后产出模型文件；未完成状态保留进度与日志入口。"}
          actions={canCreatePreset ? (
            <Button
              icon={ImagePlus}
              tone="primary"
              pending={isCreatingTrainingPreset}
              ariaLabel={`从训练任务创建预制：${currentRun.title}`}
              onClick={handleCreateTrainingPreset}
            >
              创建预制
            </Button>
          ) : null}
        >
          <div className={s.stack}>
            {currentRun.status === "failed" ? (
              <div className={s.callout} data-tone="danger">
                <AlertTriangle aria-hidden="true" />
                <span>{currentRun.errorMessage}</span>
              </div>
            ) : null}
            {currentRun.status === "queued" ? (
              <div className={s.callout}>
                <Play aria-hidden="true" />
                <span>{currentRun.waitReason ?? "等待训练服务调度"}</span>
              </div>
            ) : null}
            {currentRun.status === "completed" ? (
              <div className={s.callout} data-tone="success">
                <CheckCircle2 aria-hidden="true" />
                <span>{currentRun.outputText ?? currentRun.artifactName ?? currentRun.outputLabel ?? "任务已完成"}</span>
              </div>
            ) : null}
            {isGeneration && currentRun.status === "completed" ? (
              <GenerationOutputGrid
                activeResultId={activeGenerationResultId}
                appliedResultIds={appliedGenerationOutputIds}
                onActiveResultChange={setActiveGenerationResultId}
                onApplyReference={handleApplyGenerationOutput}
                onReviewStatusChange={handleReviewGenerationOutput}
                pendingApplyResultIds={pendingGenerationOutputApplyIds}
                results={generationOutputResults}
              />
            ) : null}
            {!isGeneration ? (
              <dl className={s.statGrid}>
                <div><dt>数据集</dt><dd>{project?.datasetVersion ?? "未记录"}</dd></div>
                <div><dt>图片</dt><dd>{project?.keptCount ?? 0} 张已保留</dd></div>
                <div><dt>LoRA 文件</dt><dd>{trainingArtifactLabel(currentRun)}</dd></div>
                <div><dt>预制</dt><dd>{trainingPresetStatusLabel(currentRun, canCreatePreset, presetCreatedAt)}</dd></div>
              </dl>
            ) : null}
          </div>
        </Panel>

        <Panel
          title={isGeneration ? "最终输入" : "训练配置"}
          subtitle={isGeneration ? "与生图运行详情一致，只展示本次任务提交给生成服务的最终请求。" : "训练任务只展示可复现所需配置和数据集版本。"}
        >
          <div className={s.stack}>
            <Field readOnly multiline features={{ clipboard: true }} label={isGeneration ? "最终请求" : "训练参数快照"} value={isGeneration ? currentRun.finalInput ?? "未记录最终输入" : trainingConfigText(currentRun)} />
            {!isGeneration && currentRun.trainingConfig?.length ? (
              <dl className={s.configGrid}>
                {currentRun.trainingConfig.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                    {row.detail ? <span>{row.detail}</span> : null}
                  </div>
                ))}
              </dl>
            ) : null}
            {isGeneration && inputImages.length > 0 ? (
              <div className={s.inputAttachmentStrip}>
                <strong>最终输入附件</strong>
                <ImageListSmall images={inputImages} limit={4} showCounts />
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      {!isGeneration ? (
        <div className={s.trainingEvidenceGrid}>
          <Panel
            title="训练集样本"
            subtitle="冻结数据集的缩略图与说明快照；点击后按审核图方式放大。"
          >
            {datasetSamples.length > 0 ? (
              <div className={s.trainingSampleGrid}>
                {datasetSamples.map((sample, index) => (
                  <article
                    className={s.trainingSampleCard}
                    data-status={sample.status}
                    key={sample.id}
                  >
                    <ImageThumbMedium
                      image={sample.image}
                      onOpen={() => setActiveSampleState({ index, runId: currentRun.id })}
                      showStatus={false}
                    />
                    <span className={s.sampleMeta}>
                      <strong>{sample.label}</strong>
                      <em>{sample.sectionTitle}</em>
                    </span>
                    <p className={s.sampleCaption}>{sample.caption}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className={s.empty}>当前训练任务没有冻结样本</div>
            )}
          </Panel>

          <Panel
            title="训练日志"
            subtitle={currentRun.trainingLogArtifactName ? `日志文件 ${currentRun.trainingLogArtifactName}` : "训练服务日志预览"}
          >
            <pre className={s.trainingLog}>{logText}</pre>
          </Panel>
        </div>
      ) : null}

      {activeSample ? (
        <ImagePreviewLarge
          image={activeSample.image}
          title={`${activeSample.label} · ${activeSample.sectionTitle}`}
          meta={activeSample.caption}
          onClose={() => setActiveSampleState(null)}
          onNext={() => setActiveSampleOffset(1)}
          onPrevious={() => setActiveSampleOffset(-1)}
          actions={(
            <Button
              icon={Copy}
              onClick={handleCopyActiveCaption}
              pressed={isActiveCaptionCopied}
              ariaLabel={`复制说明文本：${activeSample.label}`}
              feedback={{ title: isActiveCaptionCopied ? "说明文本已再次复制" : "说明文本已复制", detail: activeSample.caption }}
            >
              {isActiveCaptionCopied ? "已复制说明文本" : "复制说明文本"}
            </Button>
          )}
        />
      ) : null}
    </div>
  );
}

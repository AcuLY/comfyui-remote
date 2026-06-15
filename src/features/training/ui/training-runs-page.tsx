"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronDown, CircleAlert, Clock3, Copy, RotateCcw, X } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImageListSmall } from "@/components/design-demo-ui/media";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingRun, LoraTrainingTaskKind, LoraTrainingTaskStatus } from "@/features/training/types";
import s from "./training-runs-page.module.css";

const STATUS_ITEMS: Array<{ value: LoraTrainingTaskStatus; label: string }> = [
  { value: "completed", label: "完成" },
  { value: "running", label: "进行中" },
  { value: "queued", label: "排队" },
  { value: "failed", label: "失败 / 取消" },
];

const ERROR_CLAMP_LINES = 3;

function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

function taskDetailHref(run: LoraTrainingRun, hrefForRoute: (route: string) => string) {
  const type = run.kind === "generation" ? "generation" : "training";
  return hrefForRoute(`/training/runs/${type}/${run.id}`);
}

function groupRunsByProject(runs: LoraTrainingRun[]) {
  const groups = new Map<string, { id: string; latestTimestamp: string; title: string; rows: LoraTrainingRun[] }>();
  for (const run of runs) {
    const existing = groups.get(run.projectId);
    if (existing) {
      existing.rows.push(run);
      if (timestampRank(run.timestamp) > timestampRank(existing.latestTimestamp)) {
        existing.latestTimestamp = run.timestamp;
      }
    } else {
      groups.set(run.projectId, { id: run.projectId, latestTimestamp: run.timestamp, title: run.projectTitle, rows: [run] });
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => timestampRank(b.timestamp) - timestampRank(a.timestamp)),
    }))
    .sort((a, b) => timestampRank(b.latestTimestamp) - timestampRank(a.latestTimestamp));
}

function timestampRank(value: string) {
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function runPreviewImages(run: LoraTrainingRun, projects: ReturnType<typeof buildLoraTrainingData>["projects"]) {
  if (run.kind === "training") {
    return (run.datasetSamples ?? []).map((sample) => sample.image).slice(0, 4);
  }

  if (!run.summary.startsWith("图片")) return [];
  const project = projects.find((candidate) => candidate.id === run.projectId);
  return (project?.resultPool ?? []).map((result) => result.image).slice(0, run.status === "completed" ? 4 : 3);
}

function progressLabel(run: LoraTrainingRun) {
  const percent = Math.round(Math.max(0, Math.min(100, run.progress ?? 0)));
  if (run.kind === "training") return `训练 ${percent}%`;
  if (run.summary.startsWith("文本")) return `解析 ${percent}%`;
  return `生成 ${percent}%`;
}

function statusBadge(run: LoraTrainingRun) {
  if (run.status === "completed") return <StatusBadge status="done" label={run.outputLabel ?? "已完成"} />;
  if (run.status === "running") return <StatusBadge status="running" label={run.kind === "training" ? "训练中" : "生成中"} />;
  if (run.status === "queued") return <StatusBadge status="pending" label="排队中" />;
  return <StatusBadge status="failed" label="需处理" />;
}

function TrainingRunFailureBlock({ message }: { message: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measureOverflow = useCallback((node: HTMLParagraphElement | null) => {
    textRef.current = node;
    if (!node) return;
    requestAnimationFrame(() => {
      setOverflows(node.scrollHeight > node.clientHeight + 2);
    });
  }, []);

  return (
    <div className={s.runFailureBlock} role="status">
      <div className={s.runFailureHeader}>
        <CircleAlert className={s.icon} aria-hidden="true" />
        <span>失败原因</span>
        {overflows && !expanded ? (
          <button
            type="button"
            className={s.runFailureToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
          >
            展开
          </button>
        ) : null}
        {expanded ? (
          <button
            type="button"
            className={s.runFailureToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(false);
            }}
          >
            收起
          </button>
        ) : null}
      </div>
      <p
        ref={measureOverflow}
        className={cx(s.runFailureText, !expanded && s.runFailureTextClamped)}
        style={{ ["--error-clamp-lines" as string]: ERROR_CLAMP_LINES }}
      >
        {message}
      </p>
    </div>
  );
}

async function copyRunMessage(message: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message);
      return;
    }
  } catch {
    // Fall back to the selection API below when clipboard permissions are unavailable.
  }

  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = message;
  textarea.setAttribute("readonly", "");
  textarea.className = s.clipboardTextarea;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function CurrentRunningSurface({ runs }: { runs: LoraTrainingRun[] }) {
  if (runs.length === 0) return null;

  return (
    <section className={s.currentRunSurface} aria-label="当前运行中">
      <div className={s.currentRunHeader}>
        <div>
          <span>
            <Clock3 className={s.icon} aria-hidden="true" />
            当前运行中
          </span>
          <strong>{runs.length} 个任务</strong>
        </div>
      </div>
      <div className={s.currentRunList}>
        {runs.map((run) => {
          const percent = Math.round(Math.max(0, Math.min(100, run.progress ?? 0)));
          return (
            <article className={s.currentRunItem} key={run.id}>
              <div className={s.currentRunTitleBlock}>
                <strong>{run.projectTitle} · {run.title}</strong>
                <span>{run.summary} · {run.timestamp}</span>
              </div>
              <div className={s.currentRunProgressBlock}>
                <div className={s.currentRunProgressTop}>
                  <span>{progressLabel(run)}</span>
                  <strong>{percent}%</strong>
                </div>
                <div
                  className={s.currentRunProgressTrack}
                  role="progressbar"
                  aria-label={`${run.title} 进度`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span className={s.currentRunProgressFill} style={{ width: `${percent}%` }} />
                </div>
                <div className={s.currentRunMeta}>
                  <span>{run.provider ?? "本地任务"}</span>
                  <span>{run.schedulerMessage ?? run.finalInput ?? "等待下一个检查点"}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function LoraTrainingRunsPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const hrefForRoute = useRouteHref();
  const training = buildLoraTrainingData(data);
  const [kind, setKind] = useState<LoraTrainingTaskKind>("generation");
  const [status, setStatus] = useState<LoraTrainingTaskStatus>("completed");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hiddenRunIds, setHiddenRunIds] = useState<Set<string>>(new Set());
  const [retriedRunIds, setRetriedRunIds] = useState<Set<string>>(new Set());
  const [cancelledRunIds, setCancelledRunIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingRuns, setIsDeletingRuns] = useState(false);
  const [isRetryingRuns, setIsRetryingRuns] = useState(false);
  const [isCancellingRuns, setIsCancellingRuns] = useState(false);
  const effectiveRunStatus = (run: LoraTrainingRun) => (cancelledRunIds.has(run.id) ? "failed" : run.status);
  const runsForKind = training.runs.filter((run) => run.kind === kind && !hiddenRunIds.has(run.id));
  const runningRunsForKind = runsForKind.filter((run) => effectiveRunStatus(run) === "running").slice(0, 2);
  const visibleRuns = runsForKind.filter((run) => effectiveRunStatus(run) === status);
  const groups = groupRunsByProject(visibleRuns);
  const selectedVisibleCount = visibleRuns.filter((run) => selectedIds.has(run.id)).length;
  const allVisibleSelected = visibleRuns.length > 0 && selectedVisibleCount === visibleRuns.length;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function countFor(nextKind: LoraTrainingTaskKind, nextStatus: LoraTrainingTaskStatus) {
    return training.runs.filter((run) => run.kind === nextKind && effectiveRunStatus(run) === nextStatus && !hiddenRunIds.has(run.id)).length;
  }

  function toggleRun(runId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  function toggleVisibleRuns() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleRuns.forEach((run) => next.delete(run.id));
        return next;
      }
      return new Set([...current, ...visibleRuns.map((run) => run.id)]);
    });
  }

  function applyLocalHiddenRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    setHiddenRunIds((current) => new Set([...current, ...ids]));
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))));
  }

  async function handleDeleteRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    const runs = runsForKind.filter((run) => ids.has(run.id));

    if (!isProductionTrainingRoute) {
      applyLocalHiddenRuns(ids);
      pushToast({
        tone: "warning",
        title: "任务已从列表移除",
        detail: runs.length === 1 ? (runs[0]?.title ?? "任务") : `${runs.length} 条任务`,
      });
      return;
    }

    if (isDeletingRuns || runs.length === 0) return;

    setIsDeletingRuns(true);
    try {
      const responses = await Promise.all(
        runs.map(async (run) => {
          const response = await fetch(
            run.kind === "generation"
              ? `/api/training/generation-tasks/${run.id}`
              : `/api/training/training-runs/${run.id}`,
            { method: "DELETE" },
          );
          const payload = await response.json().catch(() => null);
          return { payload, response, run };
        }),
      );

      const completedIds = new Set(
        responses
          .filter(({ payload, response }) => response.ok && payload?.ok)
          .map(({ run }) => run.id),
      );
      if (completedIds.size > 0) {
        applyLocalHiddenRuns(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "删除失败",
          detail: failedResponse.payload?.error?.message ?? "任务移除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "任务已从列表移除",
        detail: completedIds.size === 1 ? (runs[0]?.title ?? "任务") : `${completedIds.size} 条任务`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "删除失败",
        detail: error instanceof Error ? error.message : "任务移除请求失败",
      });
    } finally {
      setIsDeletingRuns(false);
    }
  }

  async function retryRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    const runs = runsForKind.filter((run) => ids.has(run.id));

    const applyLocalRetriedRuns = (appliedIds: Set<string>) => {
      setRetriedRunIds((current) => new Set([...current, ...appliedIds]));
      setSelectedIds((current) => new Set([...current].filter((id) => !appliedIds.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalRetriedRuns(ids);
      pushToast({
        tone: "success",
        title: runs.length === 1 ? "重试已排队" : "失败任务已加入重试队列",
        detail: runs.length === 1 ? (runs[0]?.title ?? "任务") : `${runs.length} 条任务`,
      });
      return;
    }

    if (isRetryingRuns || runs.length === 0) return;

    setIsRetryingRuns(true);
    try {
      const responses = await Promise.all(
        runs.map(async (run) => {
          if (run.kind === "generation") {
            if (!run.sectionId) {
              throw new Error(`生成任务 ${run.title} 缺少小节上下文，无法重试。`);
            }
            const response = await fetch(`/api/training/sections/${run.sectionId}/runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                parentRunId: run.id,
                projectId: run.projectId,
              }),
            });
            const payload = await response.json().catch(() => null);
            return { payload, response, run };
          }

          if (!run.datasetRevisionId) {
            throw new Error(`训练任务 ${run.title} 缺少数据集版本，无法重试。`);
          }
          const response = await fetch(`/api/training/projects/${run.projectId}/training-runs`, {
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
          const payload = await response.json().catch(() => null);
          return { payload, response, run };
        }),
      );

      const completedIds = new Set(
        responses
          .filter(({ payload, response }) => response.ok && payload?.ok)
          .map(({ run }) => run.id),
      );
      if (completedIds.size > 0) {
        applyLocalRetriedRuns(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "重试失败",
          detail: failedResponse.payload?.error?.message ?? "重试请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: completedIds.size === 1 ? "重试已排队" : "失败任务已加入重试队列",
        detail: completedIds.size === 1 ? (runs[0]?.title ?? "任务") : `${completedIds.size} 条任务`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "重试失败",
        detail: error instanceof Error ? error.message : "重试请求失败",
      });
    } finally {
      setIsRetryingRuns(false);
    }
  }

  async function cancelRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    const runs = runsForKind.filter((run) => ids.has(run.id) && (run.status === "queued" || run.status === "running"));

    const applyLocalCancelledRuns = (appliedIds: Set<string>) => {
      setCancelledRunIds((current) => new Set([...current, ...appliedIds]));
      setSelectedIds((current) => new Set([...current].filter((id) => !appliedIds.has(id))));
    };

    if (!isProductionTrainingRoute) {
      const localCancelledIds = new Set(runs.map((run) => run.id));
      applyLocalCancelledRuns(localCancelledIds);
      pushToast({
        tone: "warning",
        title: runs.length === 1 ? "训练任务已取消" : "训练任务已取消",
        detail: runs.length === 1 ? (runs[0]?.title ?? "任务") : `${runs.length} 条任务`,
      });
      return;
    }

    if (isCancellingRuns || runs.length === 0) return;

    setIsCancellingRuns(true);
    try {
      const responses = await Promise.all(
        runs.map(async (run) => {
          const response = await fetch(
            run.kind === "generation"
              ? `/api/training/generation-tasks/${run.id}/cancel`
              : `/api/training/training-runs/${run.id}/cancel`,
            {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              requestedBy: run.kind === "generation" ? "training_generation_runs_page" : "training_runs_page",
            }),
            },
          );
          const payload = await response.json().catch(() => null);
          return { payload, response, run };
        }),
      );

      const completedIds = new Set(
        responses
          .filter(({ payload, response }) => response.ok && payload?.ok)
          .map(({ run }) => run.id),
      );
      if (completedIds.size > 0) {
        applyLocalCancelledRuns(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "取消失败",
          detail: failedResponse.payload?.error?.message ?? "训练任务取消请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: completedIds.size === 1 ? "训练任务已取消" : "训练任务已取消",
        detail: completedIds.size === 1 ? (runs[0]?.title ?? "任务") : `${completedIds.size} 条任务`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "取消失败",
        detail: error instanceof Error ? error.message : "训练任务取消请求失败",
      });
    } finally {
      setIsCancellingRuns(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader title="运行" />

      <CurrentRunningSurface runs={runningRunsForKind} />

      <div className={s.runSurfaceStack}>
        <SegmentedControl
          ariaLabel="切换任务类型"
          panel
          role="tablist"
          items={[
            { value: "generation", label: "生成任务", count: training.runs.filter((run) => run.kind === "generation" && !hiddenRunIds.has(run.id)).length },
            { value: "training", label: "训练任务", count: training.runs.filter((run) => run.kind === "training" && !hiddenRunIds.has(run.id)).length },
          ]}
          value={kind}
          onChange={(nextKind) => {
            setKind(nextKind);
            setSelectedIds(new Set());
          }}
        />
        <SegmentedControl
          ariaLabel="切换任务状态"
          className={s.statusTabs}
          panel
          role="tablist"
          items={STATUS_ITEMS.map((item) => ({ ...item, count: countFor(kind, item.value) }))}
          value={status}
          onChange={(nextStatus) => {
            setStatus(nextStatus);
            setSelectedIds(new Set());
          }}
        />

        <section className={s.runSurface} aria-label="训练运行列表">
          <div className={s.runSurfaceHeader}>
            <div>
              <strong>{kind === "generation" ? "训练集生成任务" : "LoRA 训练任务"}</strong>
              <em>{groups.length} 个项目 · {visibleRuns.length} 条记录{selectedVisibleCount ? ` · 已选 ${selectedVisibleCount}` : ""}</em>
            </div>
            <div className={s.toolbar}>
              <Button icon={CheckSquare} onClick={toggleVisibleRuns} disabled={visibleRuns.length === 0}>
                {allVisibleSelected ? "取消全选" : "全选"}
              </Button>
                  {status === "failed" ? (
                        <Button
                          icon={RotateCcw}
                          tone="primary"
                          pending={isRetryingRuns}
                          disabled={selectedVisibleCount === 0}
                          onClick={() => retryRuns(selectedIds)}
                        >
                          重试所选
                        </Button>
                  ) : kind === "training" && (status === "queued" || status === "running") ? (
                    <Button
                      icon={X}
                      tone="danger"
                      pending={isCancellingRuns}
                      disabled={selectedVisibleCount === 0}
                      onClick={() => cancelRuns(selectedIds)}
                    >
                      取消所选
                    </Button>
                  ) : (
                <Button
                  icon={X}
                  tone="danger"
                  pending={isDeletingRuns}
                  disabled={selectedVisibleCount === 0}
                  onClick={() => handleDeleteRuns(selectedIds)}
                  feedback={{ tone: "warning", title: "任务已从列表移除", detail: `${selectedVisibleCount} 条任务` }}
                >
                  删除所选
                </Button>
              )}
            </div>
          </div>

          {visibleRuns.length === 0 ? (
            <div className={s.empty}>当前没有{STATUS_ITEMS.find((item) => item.value === status)?.label}任务</div>
          ) : (
            <div className={s.runGroupList}>
              {groups.map((group) => {
                const collapsed = collapsedGroups.has(group.id);
                const selectedInGroup = group.rows.filter((run) => selectedIds.has(run.id)).length;
                const allGroupSelected = group.rows.length > 0 && selectedInGroup === group.rows.length;

                return (
                  <section className={s.runProjectGroup} key={group.id}>
                    <div className={s.runProjectHeader}>
                      <button
                        className={s.runProjectHeaderToggle}
                        type="button"
                        onClick={() => {
                          setCollapsedGroups((current) => {
                            const next = new Set(current);
                            if (next.has(group.id)) next.delete(group.id);
                            else next.add(group.id);
                            return next;
                          });
                        }}
                        aria-expanded={!collapsed}
                      >
                        <ChevronDown className={cx(s.icon, collapsed && s.runProjectChevronCollapsed)} aria-hidden="true" />
                        <span>{group.title}</span>
                        <em>{group.rows.length} 条记录{selectedInGroup ? ` · 已选 ${selectedInGroup}` : ""} · 最新 {group.latestTimestamp}</em>
                      </button>
                      <Checkbox
                        checked={allGroupSelected}
                        label={allGroupSelected ? `取消全选项目任务：${group.title}` : `全选项目任务：${group.title}`}
                        onCheckedChange={() => {
                          setSelectedIds((current) => {
                            const runIds = group.rows.map((run) => run.id);
                            const next = new Set(current);
                            if (allGroupSelected) runIds.forEach((id) => next.delete(id));
                            else runIds.forEach((id) => next.add(id));
                            return next;
                          });
                        }}
                        stopPropagation
                        variant="compact"
                      />
                    </div>
                    {collapsed ? null : (
                      <div className={s.runRows}>
                            {group.rows.map((run) => {
                              const selected = selectedIds.has(run.id);
                              const retried = retriedRunIds.has(run.id);
                              const cancelled = cancelledRunIds.has(run.id);
                              const previewImages = runPreviewImages(run, training.projects);
                              const errorMessage = run.errorMessage ?? "模型服务返回空结果或连接超时";

                              return (
                                <div className={cx(s.runRow, effectiveRunStatus(run) === "failed" && !retried && s.runRowFailed, selected && s.runRowSelected)} data-training-run-id={run.id} key={run.id}>
                                  <Checkbox
                                    checked={selected}
                                    label={selected ? `取消选择任务：${run.title}` : `选择任务：${run.title}`}
                                onCheckedChange={() => toggleRun(run.id)}
                                stopPropagation
                                variant="compact"
                                  />
                                  <Link className={cx(s.runMain, previewImages.length > 0 && s.runMainWithThumbs)} href={taskDetailHref(run, hrefForRoute)}>
                                    <span className={s.runText}>
                                      <strong>{run.title}</strong>
                                      <span>{run.summary}{retried ? " · 已重试" : ""}{cancelled ? " · 已取消" : ""}</span>
                                      <em>{retried ? "已加入重试队列" : cancelled ? "已取消" : run.timestamp}</em>
                                      {typeof run.progress === "number" ? (
                                        <span className={s.runProgress} aria-label={`约 ${run.progress}%`}>
                                          <span className={s.runProgressTrack} aria-hidden="true">
                                        <span className={s.runProgressFill} style={{ width: `${run.progress}%` }} />
                                      </span>
                                      <span>约 {run.progress}%</span>
                                    </span>
                                  ) : null}
                                </span>
                                {previewImages.length > 0 ? (
                                  <ImageListSmall
                                    className={s.runThumbs}
                                    images={previewImages}
                                    limit={previewImages.length}
                                    showCounts={run.kind === "generation"}
                                  />
                                ) : null}
                              </Link>
                                  {effectiveRunStatus(run) === "failed" ? (
                                    retried ? (
                                      <div className={s.rowActions}>
                                        <StatusBadge status="pending" label="已排队重试" />
                                      </div>
                                    ) : cancelled ? (
                                      <div className={s.rowActions}>
                                        <StatusBadge status="failed" label="已取消" />
                                      </div>
                                    ) : (
                                      <div className={s.runSecondary}>
                                        <TrainingRunFailureBlock message={errorMessage} />
                                    <div className={cx(s.rowActions, s.runFailureToolbar)}>
                                      <Button
                                        tone="subtle"
                                        icon={Copy}
                                        size="sm"
                                        ariaLabel={`复制任务报错：${run.title}`}
                                        onClick={() => copyRunMessage(errorMessage)}
                                        feedback={{ title: "报错已复制", detail: errorMessage }}
                                      >
                                        复制
                                      </Button>
                                          <Button
                                            tone="subtle"
                                            icon={RotateCcw}
                                            size="sm"
                                            pending={isRetryingRuns}
                                            ariaLabel={`重试任务：${run.title}`}
                                            onClick={() => retryRuns([run.id])}
                                          >
                                            重试
                                          </Button>
                                    </div>
                                  </div>
                                )
                                  ) : (
                                    <div className={s.rowActions}>
                                      {statusBadge(run)}
                                      {(status === "queued" || status === "running") ? (
                                        <Button
                                          icon={X}
                                          size="sm"
                                          tone="danger"
                                          pending={isCancellingRuns}
                                          ariaLabel={`${kind === "generation" ? "取消生成任务" : "取消训练任务"}：${run.title}`}
                                          onClick={() => cancelRuns([run.id])}
                                        >
                                          {kind === "generation" ? "终止" : "取消"}
                                        </Button>
                                      ) : (
                                            <Button
                                              icon={X}
                                              iconOnly
                                              size="sm"
                                              tone="danger"
                                              pending={isDeletingRuns}
                                              ariaLabel={`删除任务：${run.title}`}
                                              onClick={() => handleDeleteRuns([run.id])}
                                              feedback={{ tone: "warning", title: "任务已从列表移除", detail: run.title }}
                                            />
                                          )}
                                    </div>
                                  )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

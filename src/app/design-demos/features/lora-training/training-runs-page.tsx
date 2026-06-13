"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronDown, CircleAlert, Clock3, Copy, RotateCcw, X } from "lucide-react";

import type { DemoData } from "../../data";
import { cx, demoHref } from "../../routing";
import { ImageListSmall } from "../../shared/media";
import { Button } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { PageHeader } from "../../shared/primitives/page-header";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingRun, LoraTrainingTaskKind, LoraTrainingTaskStatus } from "./types";
import s from "./training-runs-page.module.css";

const STATUS_ITEMS: Array<{ value: LoraTrainingTaskStatus; label: string }> = [
  { value: "completed", label: "完成" },
  { value: "running", label: "进行中" },
  { value: "queued", label: "排队" },
  { value: "failed", label: "失败 / 取消" },
];

const ERROR_CLAMP_LINES = 3;

function taskDetailHref(run: LoraTrainingRun) {
  const type = run.kind === "generation" ? "generation" : "training";
  return demoHref(`/training/runs/${type}/${run.id}`);
}

function groupRunsByProject(runs: LoraTrainingRun[]) {
  const groups = new Map<string, { id: string; title: string; rows: LoraTrainingRun[] }>();
  for (const run of runs) {
    if (!groups.has(run.projectId)) groups.set(run.projectId, { id: run.projectId, title: run.projectTitle, rows: [] });
    groups.get(run.projectId)!.rows.push(run);
  }
  return [...groups.values()];
}

function runPreviewImages(run: LoraTrainingRun, projects: ReturnType<typeof buildLoraTrainingDemoData>["projects"]) {
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
  if (run.status === "running") return <StatusBadge status="running" label="生成中" />;
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

export function LoraTrainingRunsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const [kind, setKind] = useState<LoraTrainingTaskKind>("generation");
  const [status, setStatus] = useState<LoraTrainingTaskStatus>("completed");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hiddenRunIds, setHiddenRunIds] = useState<Set<string>>(new Set());
  const [retriedRunIds, setRetriedRunIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const runsForKind = training.runs.filter((run) => run.kind === kind && !hiddenRunIds.has(run.id));
  const runningRunsForKind = runsForKind.filter((run) => run.status === "running").slice(0, 2);
  const visibleRuns = runsForKind.filter((run) => run.status === status);
  const groups = groupRunsByProject(visibleRuns);
  const selectedVisibleCount = visibleRuns.filter((run) => selectedIds.has(run.id)).length;
  const allVisibleSelected = visibleRuns.length > 0 && selectedVisibleCount === visibleRuns.length;

  function countFor(nextKind: LoraTrainingTaskKind, nextStatus: LoraTrainingTaskStatus) {
    return training.runs.filter((run) => run.kind === nextKind && run.status === nextStatus && !hiddenRunIds.has(run.id)).length;
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

  function hideRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    setHiddenRunIds((current) => new Set([...current, ...ids]));
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))));
  }

  function retryRuns(runIds: Iterable<string>) {
    const ids = new Set(runIds);
    setRetriedRunIds((current) => new Set([...current, ...ids]));
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))));
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
                  disabled={selectedVisibleCount === 0}
                  onClick={() => retryRuns(selectedIds)}
                  feedback={{ title: "失败任务已加入重试队列", detail: `${selectedVisibleCount} 条任务` }}
                >
                  重试所选
                </Button>
              ) : (
                <Button
                  icon={X}
                  tone="danger"
                  disabled={selectedVisibleCount === 0}
                  onClick={() => hideRuns(selectedIds)}
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
                        <em>{group.rows.length} 条记录{selectedInGroup ? ` · 已选 ${selectedInGroup}` : ""}</em>
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
                          const previewImages = runPreviewImages(run, training.projects);
                          const errorMessage = run.errorMessage ?? "模型服务返回空结果或连接超时";

                          return (
                            <div className={cx(s.runRow, run.status === "failed" && !retried && s.runRowFailed, selected && s.runRowSelected)} data-training-run-id={run.id} key={run.id}>
                              <Checkbox
                                checked={selected}
                                label={selected ? `取消选择任务：${run.title}` : `选择任务：${run.title}`}
                                onCheckedChange={() => toggleRun(run.id)}
                                stopPropagation
                                variant="compact"
                              />
                              <Link className={cx(s.runMain, previewImages.length > 0 && s.runMainWithThumbs)} href={taskDetailHref(run)}>
                                <span className={s.runText}>
                                  <strong>{run.title}</strong>
                                  <span>{run.summary}{retried ? " · 已重试" : ""}</span>
                                  <em>{retried ? "已加入重试队列" : run.timestamp}</em>
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
                              {run.status === "failed" ? (
                                retried ? (
                                  <div className={s.rowActions}>
                                    <StatusBadge status="pending" label="已排队重试" />
                                  </div>
                                ) : (
                                  <div className={s.runSecondary}>
                                    <TrainingRunFailureBlock message={errorMessage} />
                                    <div className={cx(s.rowActions, s.runFailureToolbar)}>
                                      <Button
                                        tone="subtle"
                                        icon={Copy}
                                        size="sm"
                                        onClick={() => copyRunMessage(errorMessage)}
                                        feedback={{ title: "报错已复制", detail: errorMessage }}
                                      >
                                        复制
                                      </Button>
                                      <Button
                                        tone="subtle"
                                        icon={RotateCcw}
                                        size="sm"
                                        onClick={() => retryRuns([run.id])}
                                        feedback={{ title: "重试已排队", detail: run.title }}
                                      >
                                        重试
                                      </Button>
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className={s.rowActions}>
                                  {statusBadge(run)}
                                  <Button
                                    icon={X}
                                    iconOnly
                                    size="sm"
                                    tone="danger"
                                    ariaLabel={`删除任务：${run.title}`}
                                    onClick={() => hideRuns([run.id])}
                                    feedback={{ tone: "warning", title: "任务已从列表移除", detail: run.title }}
                                  />
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

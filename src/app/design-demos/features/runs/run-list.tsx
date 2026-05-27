"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckSquare, ChevronDown, CircleAlert, Copy, X } from "lucide-react";

import type { DemoRun } from "../../data";
import { cx, demoHref } from "../../routing";
import { Button } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { groupCollapsedKey, groupRunsByProject } from "./queue-model";
import type { QueueRunMode } from "./types";
import s from "./run-list.runs.module.css";
import local from "./run-list.module.css";

export function RunList({
  className,
  title,
  runs,
  empty,
  mode,
  collapsedGroups,
  onToggleGroup,
  highlightRunId,
}: {
  className?: string;
  title: string;
  runs: DemoRun[];
  empty: string;
  mode: QueueRunMode;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  highlightRunId?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [hiddenRunIds, setHiddenRunIds] = useState<Set<string>>(new Set());
  const [retriedRunIds, setRetriedRunIds] = useState<Set<string>>(new Set());
  const activeRuns = runs.filter((r) => !hiddenRunIds.has(r.id));
  const groups = groupRunsByProject(activeRuns);
  const visibleRuns = groups.flatMap((group) => group.rows.map((row) => row.run)).slice(0, 8);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedVisibleCount = visibleRuns.filter((run) => selectedIds.has(run.id)).length;
  const allVisibleSelected = visibleRuns.length > 0 && selectedVisibleCount === visibleRuns.length;

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

  function batchDelete() {
    setHiddenRunIds((prev) => new Set([...prev, ...selectedIds]));
    setSelectedIds(new Set());
  }

  function batchRetry() {
    setRetriedRunIds((prev) => new Set([...prev, ...selectedIds]));
    setSelectedIds(new Set());
  }

  function deleteRun(runId: string) {
    setHiddenRunIds((prev) => new Set([...prev, runId]));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(runId);
      return next;
    });
  }

  function retryRun(runId: string) {
    setRetriedRunIds((prev) => new Set([...prev, runId]));
  }

  function toggleGroupRuns(groupRows: { run: DemoRun }[]) {
    setSelectedIds((current) => {
      const groupRunIds = groupRows.map(({ run }) => run.id);
      const allSelected = groupRunIds.every((id) => current.has(id));
      const next = new Set(current);
      if (allSelected) {
        groupRunIds.forEach((id) => next.delete(id));
      } else {
        groupRunIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  // Ensure highlighted run's group is expanded, then scroll into view
  useEffect(() => {
    if (!highlightRunId) return;
    // Find which group contains this run and expand it
    const targetGroup = groups.find((g) => g.rows.some(({ run }) => run.id === highlightRunId));
    if (targetGroup && collapsedGroups.has(groupCollapsedKey(targetGroup.id))) {
      onToggleGroup(targetGroup.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    if (!highlightRunId) return;
    const el = listRef.current?.querySelector(`[data-run-id="${highlightRunId}"]`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    } else {
      // Fallback: retry after paint in case DOM isn't ready (group was just expanded)
      const timer = setTimeout(() => {
        listRef.current?.querySelector(`[data-run-id="${highlightRunId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className={cx(s.queueSurface, className)}>
      <div className={s.queueSurfaceHeader}>
        <div>
          <strong>{title}</strong>
          <em>{groups.length} 个项目 · {runs.length} 条记录{selectedVisibleCount > 0 ? ` · 已选 ${selectedVisibleCount}` : ""}</em>
        </div>
        <div className={s.toolbar}>
          <Button icon={CheckSquare} onClick={toggleVisibleRuns} disabled={visibleRuns.length === 0}>
            {allVisibleSelected ? "取消全选" : "全选"}
          </Button>
          {mode === "running" ? (
            <Button
              tone="danger"
              icon={X}
              disabled={selectedVisibleCount === 0}
              onClick={batchDelete}
              feedback={{ tone: "warning", title: "运行任务删除队列已准备", detail: `${selectedVisibleCount} 条任务` }}
            >
              删除所选
            </Button>
          ) : (
            <Button
              tone="primary"
              icon={ArrowRight}
              disabled={selectedVisibleCount === 0}
              onClick={batchRetry}
              feedback={{ title: "失败任务已加入重试队列", detail: `${selectedVisibleCount} 条任务` }}
            >
              重试所选
            </Button>
          )}
        </div>
      </div>
      {runs.length === 0 ? (
        <div className={s.empty}>{empty}</div>
      ) : (
        <div className={s.queueRunList} ref={listRef}>
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(groupCollapsedKey(group.id));
            const selectedInGroup = group.rows.filter(({ run }) => selectedIds.has(run.id)).length;
            const allGroupSelected = group.rows.length > 0 && selectedInGroup === group.rows.length;
            return (
              <section className={s.queueProjectGroup} key={group.id}>
                <div className={s.queueProjectHeader}>
                  <button
                    className={s.queueProjectHeaderToggle}
                    type="button"
                    onClick={() => onToggleGroup(group.id)}
                    aria-expanded={!collapsed}
                  >
                    <ChevronDown className={cx(s.icon, collapsed && s.queueProjectChevronCollapsed)} />
                    <span>{group.title}</span>
                    <em>{group.rows.length} 条记录{selectedInGroup > 0 ? ` · 已选 ${selectedInGroup}` : ""} · 最新 {group.latestCreatedAt}</em>
                  </button>
                  <Checkbox
                    checked={allGroupSelected}
                    label={allGroupSelected ? `取消全选项目：${group.title}` : `全选项目：${group.title}`}
                    onCheckedChange={() => toggleGroupRuns(group.rows)}
                    stopPropagation
                    variant="compact"
                  />
                </div>
                {collapsed ? null : (
                  <div className={s.queueProjectRows}>
                    {group.rows.map(({ run }) => {
                      const selected = selectedIds.has(run.id);
                      const retried = retriedRunIds.has(run.id);
                      const errorMessage = run.errorMessage ?? "ComfyUI 返回空结果或连接超时";
                      return (
                        <div
                          className={cx(
                            s.queueRunRow,
                            s.queueRunRowSelectable,
                            mode === "failed" && !retried && s.queueRunRowFailed,
                            selected && s.queueRunRowSelected,
                          )}
                          data-run-id={run.id}
                          key={run.id}
                        >
                          <Checkbox
                            checked={selected}
                            label={selected ? `取消选择任务：${run.sectionName}` : `选择任务：${run.sectionName}`}
                            onCheckedChange={() => toggleRun(run.id)}
                            stopPropagation
                            variant="compact"
                          />
                          <Link href={`${demoHref(`/runs/${run.id}`)}?meta=open`} className={s.queueRunMain} onClick={(event) => event.stopPropagation()}>
                            <strong>{run.sectionName}</strong>
                            <span>run {run.runIndex}{retried ? " · 已重试" : ""}</span>
                            <span className={s.queueRunDate}>
                              {retried ? "已加入重试队列" : mode === "running" ? "创建于" : "失败于"} {retried ? "" : mode === "running" ? run.createdAt : run.startedAt ?? run.createdAt}
                            </span>
                          </Link>
                          {mode === "failed" ? (
                            retried ? (
                              <div className={s.toolbar}>
                                <StatusBadge status="pending" label="已排队重试" />
                              </div>
                            ) : (
                              <div className={s.queueRunSecondary}>
                                <ErrorBlock errorMessage={errorMessage} />
                                <div className={cx(s.toolbar, s.queueRunFailureToolbar)}>
                                  <Button
                                    tone="subtle"
                                    icon={Copy}
                                    className={s.queueRunErrorCopy}
                                    onClick={() => copyErrorMessage(errorMessage)}
                                    feedback={{ title: "报错已复制", detail: errorMessage }}
                                  >
                                    复制
                                  </Button>
                                  <Button tone="subtle" icon={ArrowRight} className={s.queueRunRetryAction} onClick={() => retryRun(run.id)} feedback={{ title: "重试已排队", detail: run.sectionName }}>重试</Button>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className={s.toolbar}>
                              <Button tone="danger" icon={X} onClick={() => deleteRun(run.id)} feedback={{ tone: "warning", title: "删除任务已排队", detail: run.sectionName }}>删除</Button>
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
  );
}

/* ---------- Collapsible error block ---------- */

const ERROR_CLAMP_LINES = 3;

function ErrorBlock({ errorMessage }: { errorMessage: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const measureOverflow = useCallback((node: HTMLParagraphElement | null) => {
    if (!node) return;
    (textRef as React.MutableRefObject<HTMLParagraphElement | null>).current = node;
    // Compare scrollHeight vs clientHeight to detect clamping
    requestAnimationFrame(() => {
      setOverflows(node.scrollHeight > node.clientHeight + 2);
    });
  }, []);

  return (
    <div className={s.queueRunError} role="status">
      <div className={s.queueRunErrorHeader}>
        <CircleAlert className={s.queueRunErrorIcon} aria-hidden="true" />
        <span>失败原因</span>
        {overflows && !expanded && (
          <button
            type="button"
            className={s.queueRunErrorToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
          >
            展开
          </button>
        )}
        {expanded && (
          <button
            type="button"
            className={s.queueRunErrorToggle}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(false);
            }}
          >
            收起
          </button>
        )}
      </div>
      <p
        ref={measureOverflow}
        className={cx(s.queueRunErrorText, !expanded && s.queueRunErrorTextClamped)}
        style={{ ["--error-clamp-lines" as string]: ERROR_CLAMP_LINES }}
      >
        {errorMessage}
      </p>
    </div>
  );
}

async function copyErrorMessage(errorMessage: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(errorMessage);
      return;
    }
  } catch {
    // Fall back to the selection API below when clipboard permissions are unavailable.
  }

  const textarea = document.createElement("textarea");
  textarea.value = errorMessage;
  textarea.setAttribute("readonly", "");
  textarea.className = local.clipboardTextarea;
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

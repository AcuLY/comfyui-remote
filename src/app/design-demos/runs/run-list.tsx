"use client";

import { useState } from "react";
import { ArrowRight, CheckSquare, ChevronDown, Copy, Square, X } from "lucide-react";

import type { DemoRun } from "../design-demo-data";
import { cx } from "../design-demo-utils";
import { Button } from "../ui/button";
import { groupCollapsedKey, groupRunsByProject } from "./queue-model";
import type { QueueRunMode } from "./types";
import s from "../styles/runs.module.css";
import local from "./run-list.module.css";

export function RunList({
  title,
  runs,
  empty,
  mode,
  collapsedGroups,
  onToggleGroup,
}: {
  title: string;
  runs: DemoRun[];
  empty: string;
  mode: QueueRunMode;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
}) {
  const groups = groupRunsByProject(runs);
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

  return (
    <section className={s.queueSurface}>
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
              feedback={{ tone: "warning", title: "运行任务取消队列已准备", detail: `${selectedVisibleCount} 条任务` }}
            >
              取消所选
            </Button>
          ) : (
            <Button
              tone="primary"
              icon={ArrowRight}
              disabled={selectedVisibleCount === 0}
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
        <div className={s.queueRunList}>
          {groups.map((group) => {
            const collapsed = collapsedGroups.has(groupCollapsedKey(mode, group.id));
            const selectedInGroup = group.rows.filter(({ run }) => selectedIds.has(run.id)).length;
            return (
              <section className={s.queueProjectGroup} key={group.id}>
                <button
                  className={s.queueProjectHeader}
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  aria-expanded={!collapsed}
                >
                  <ChevronDown className={cx(s.icon, collapsed && s.queueProjectChevronCollapsed)} />
                  <span>{group.title}</span>
                  <em>{group.rows.length} 条记录{selectedInGroup > 0 ? ` · 已选 ${selectedInGroup}` : ""} · 最新 {group.latestCreatedAt}</em>
                </button>
                {collapsed ? null : (
                  <div className={s.queueProjectRows}>
                    {group.rows.map(({ run }) => {
                      const selected = selectedIds.has(run.id);
                      const errorMessage = run.errorMessage ?? "ComfyUI 返回空结果或连接超时";
                      return (
                        <div
                          aria-checked={selected}
                          className={cx(s.queueRunRow, s.queueRunRowSelectable, selected && s.queueRunRowSelected)}
                          key={run.id}
                          onClick={() => toggleRun(run.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggleRun(run.id);
                            }
                          }}
                          role="checkbox"
                          tabIndex={0}
                        >
                          <span className={s.queueRowCheck} aria-hidden="true">
                            {selected ? <CheckSquare className={s.icon} /> : <Square className={s.icon} />}
                          </span>
                          <div className={s.queueRunMain}>
                            <strong>{run.sectionName}</strong>
                            <span>run {run.runIndex}</span>
                            <span className={s.queueRunDate}>
                              {mode === "running" ? "创建于" : "失败于"} {mode === "running" ? run.createdAt : run.startedAt ?? run.createdAt}
                            </span>
                            {mode === "failed" ? (
                              <span className={s.queueRunError}>
                                原因：{errorMessage}
                                <span
                                  className={s.queueRunErrorAction}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  <Button
                                    tone="subtle"
                                    icon={Copy}
                                    className={s.queueRunErrorCopy}
                                    onClick={() => copyErrorMessage(errorMessage)}
                                    feedback={{ title: "报错已复制", detail: errorMessage }}
                                  >
                                    复制
                                  </Button>
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <div className={s.toolbar} onClick={(event) => event.stopPropagation()}>
                            {mode === "running" ? (
                              <Button tone="danger" icon={X} feedback={{ tone: "warning", title: "取消任务已排队", detail: run.sectionName }}>取消</Button>
                            ) : (
                              <Button tone="primary" icon={ArrowRight} feedback={{ title: "重试已排队", detail: run.sectionName }}>重试</Button>
                            )}
                          </div>
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

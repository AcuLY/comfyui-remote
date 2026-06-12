"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronDown, RotateCcw, X } from "lucide-react";

import type { DemoData } from "../../data";
import { cx, demoHref } from "../../routing";
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

function statusBadge(run: LoraTrainingRun) {
  if (run.status === "completed") return <StatusBadge status="done" label={run.outputLabel ?? "已完成"} />;
  if (run.status === "running") return <StatusBadge status="running" label="生成中" />;
  if (run.status === "queued") return <StatusBadge status="pending" label="排队中" />;
  return <StatusBadge status="failed" label="需处理" />;
}

export function LoraTrainingRunsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const [kind, setKind] = useState<LoraTrainingTaskKind>("generation");
  const [status, setStatus] = useState<LoraTrainingTaskStatus>("completed");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hiddenRunIds, setHiddenRunIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const runsForKind = training.runs.filter((run) => run.kind === kind && !hiddenRunIds.has(run.id));
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

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="运行"
        subtitle="集中处理训练集生成任务和 LoRA 训练任务。"
      />

      <div className={s.modeSummary} aria-label="运行概览">
        {STATUS_ITEMS.map((item) => (
          <div className={s.metricCard} key={item.value}>
            <strong>{countFor(kind, item.value)}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

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
                  feedback={{ title: "重试动作已预览", detail: `${selectedVisibleCount} 条任务` }}
                >
                  重试所选
                </Button>
              ) : (
                <Button
                  icon={X}
                  tone="danger"
                  disabled={selectedVisibleCount === 0}
                  onClick={() => hideRuns(selectedIds)}
                  feedback={{ tone: "warning", title: "删除动作已预览", detail: `${selectedVisibleCount} 条任务` }}
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

                          return (
                            <div className={cx(s.runRow, selected && s.runRowSelected)} data-training-run-id={run.id} key={run.id}>
                              <Checkbox
                                checked={selected}
                                label={selected ? `取消选择任务：${run.title}` : `选择任务：${run.title}`}
                                onCheckedChange={() => toggleRun(run.id)}
                                stopPropagation
                                variant="compact"
                              />
                              <Link className={s.runMain} href={taskDetailHref(run)}>
                                <strong>{run.title}</strong>
                                <span>{run.summary}</span>
                                <em>{run.timestamp}</em>
                                {typeof run.progress === "number" ? (
                                  <span className={s.runProgress} aria-label={`约 ${run.progress}%`}>
                                    <span className={s.runProgressTrack} aria-hidden="true">
                                      <span className={s.runProgressFill} style={{ width: `${run.progress}%` }} />
                                    </span>
                                    <span>约 {run.progress}%</span>
                                  </span>
                                ) : null}
                                {run.errorMessage ? <span className={s.runError}>{run.errorMessage}</span> : null}
                              </Link>
                              <div className={s.rowActions}>
                                {statusBadge(run)}
                                {run.status === "failed" ? (
                                  <Button icon={RotateCcw} iconOnly size="sm" ariaLabel={`重试任务：${run.title}`} feedback={{ title: "重试动作已预览", detail: run.title }} />
                                ) : (
                                  <Button
                                    icon={X}
                                    iconOnly
                                    size="sm"
                                    tone="danger"
                                    ariaLabel={`删除任务：${run.title}`}
                                    onClick={() => hideRuns([run.id])}
                                    feedback={{ tone: "warning", title: "删除动作已预览", detail: run.title }}
                                  />
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
      </div>
    </div>
  );
}

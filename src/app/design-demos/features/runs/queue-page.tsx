"use client";

import { useRef, useState } from "react";

import type { DemoData } from "../../data";
import type { QueueDemoTab } from "../../routing";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { CurrentRunningProgressCard } from "./current-running-progress-card";
import { PendingReviewGroups, pendingReviewPageSize } from "./pending-review-groups";
import {
  buildCurrentRunningRuns,
  buildQueueReviewRows,
  buildQueueStatusRuns,
  groupCollapsedKey,
  groupRowsByProject,
} from "./queue-model";
import { QueueMetrics } from "./queue-metrics";
import { RunList } from "./run-list";
import s from "./queue-page.runs.module.css";

const SCROLL_RESTORE_KEY = "demo-runs-from";

function readAndClearScrollRestore(): string | undefined {
  try {
    const value = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (value) {
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      return value;
    }
  } catch {}
  return undefined;
}

function detectTabForRun(
  runId: string,
  reviewRows: { run: { id: string } }[],
  running: { id: string }[],
  failed: { id: string }[],
): QueueDemoTab {
  if (running.some((r) => r.id === runId)) return "running";
  if (failed.some((r) => r.id === runId)) return "failed";
  if (reviewRows.some((r) => r.run.id === runId)) return "pending";
  return "pending";
}

export function QueuePage({ data }: { data: DemoData }) {
  const [fromRunId] = useState(readAndClearScrollRestore);

  const reviewRows = buildQueueReviewRows(data.runs);
  const running = buildQueueStatusRuns(data.runs, "running");
  const currentRunningRuns = buildCurrentRunningRuns(running);
  const failed = buildQueueStatusRuns(data.runs, "failed");

  const initialTab = fromRunId ? detectTabForRun(fromRunId, reviewRows, running, failed) : "pending";
  const [activeTab, setActiveTab] = useState<QueueDemoTab>(initialTab);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const stackRef = useRef<HTMLDivElement>(null);

  function handleTabChange(tab: QueueDemoTab) {
    // Pin scroll position: keep the tab bar at the same viewport Y after content changes
    const rect = stackRef.current?.getBoundingClientRect();
    const topBefore = rect?.top ?? 0;
    setActiveTab(tab);
    requestAnimationFrame(() => {
      if (!stackRef.current) return;
      const topAfter = stackRef.current.getBoundingClientRect().top;
      const delta = topAfter - topBefore;
      if (Math.abs(delta) > 1) {
        window.scrollBy({ top: delta, behavior: "instant" });
      }
    });
  }
  const reviewGroups = groupRowsByProject(reviewRows);
  const totalPending = reviewRows.reduce((sum, row) => sum + row.pendingCount, 0);
  const pageSize = pendingReviewPageSize();
  const totalPages = Math.max(1, Math.ceil(reviewGroups.length / pageSize));

  function toggleGroup(groupId: string) {
    const key = groupCollapsedKey(groupId);
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="任务"
        title="任务工作台"
        subtitle="按状态处理待审图片、运行中任务和失败记录。"
      />
      <QueueMetrics
        pendingImages={totalPending}
        reviewGroups={reviewRows.length}
        runningCount={running.length}
        failedCount={failed.length}
      />
      <CurrentRunningProgressCard runs={currentRunningRuns} />
      <div className={s.queueSurfaceStack} ref={stackRef}>
        <SegmentedControl
          ariaLabel="切换视图"
          panel
          role="tablist"
          items={[
            { value: "pending", label: "待审核", count: totalPending },
            { value: "running", label: "队列", count: running.length },
            { value: "failed", label: "失败", count: failed.length },
          ]}
          value={activeTab}
          onChange={handleTabChange}
        />
        {activeTab === "pending" ? (
          <PendingReviewGroups
            className={s.queueSurface}
            groups={reviewGroups}
            reviewRows={reviewRows}
            totalPending={totalPending}
            totalPages={totalPages}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            highlightRunId={fromRunId}
          />
        ) : activeTab === "running" ? (
          <RunList
            key="running"
            className={s.queueSurface}
            title="运行中"
            runs={running}
            empty="当前没有运行中或排队中的任务"
            mode="running"
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            highlightRunId={fromRunId}
          />
        ) : activeTab === "failed" ? (
          <RunList
            key="failed"
            className={s.queueSurface}
            title="最近失败"
            runs={failed}
            empty="当前没有失败任务"
            mode="failed"
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            highlightRunId={fromRunId}
          />
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import type { DemoData } from "../../data";
import type { QueueDemoTab } from "../../routing";
import { PageHeader } from "../../shared/primitives/page-header";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
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

export function QueuePage({ data }: { data: DemoData }) {
  const reviewRows = buildQueueReviewRows(data.runs);
  const running = buildQueueStatusRuns(data.runs, "running");
  const currentRunningRuns = buildCurrentRunningRuns(running);
  const failed = buildQueueStatusRuns(data.runs, "failed");
  const [activeTab, setActiveTab] = useState<QueueDemoTab>("pending");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const reviewGroups = groupRowsByProject(reviewRows);
  const totalPending = reviewRows.reduce((sum, row) => sum + row.pendingCount, 0);
  const pageSize = pendingReviewPageSize();
  const totalPages = Math.max(1, Math.ceil(reviewGroups.length / pageSize));

  function toggleGroup(tab: QueueDemoTab, groupId: string) {
    const key = groupCollapsedKey(tab, groupId);
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
      <div className={s.queueSurfaceStack}>
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
          onChange={setActiveTab}
        />
        {activeTab === "pending" ? (
          <PendingReviewGroups
            className={s.queueSurface}
            groups={reviewGroups}
            reviewRows={reviewRows}
            totalPending={totalPending}
            totalPages={totalPages}
            collapsedGroups={collapsedGroups}
            onToggleGroup={(groupId) => toggleGroup("pending", groupId)}
          />
        ) : activeTab === "running" ? (
          <RunList
            className={s.queueSurface}
            title="运行中"
            runs={running}
            empty="当前没有运行中或排队中的任务"
            mode="running"
            collapsedGroups={collapsedGroups}
            onToggleGroup={(groupId) => toggleGroup("running", groupId)}
          />
        ) : activeTab === "failed" ? (
          <RunList
            className={s.queueSurface}
            title="最近失败"
            runs={failed}
            empty="当前没有失败任务"
            mode="failed"
            collapsedGroups={collapsedGroups}
            onToggleGroup={(groupId) => toggleGroup("failed", groupId)}
          />
        ) : null}
      </div>
    </div>
  );
}

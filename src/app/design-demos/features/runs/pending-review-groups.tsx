import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";

import { cx, demoHref } from "../../routing";
import { Button } from "../../shared/primitives/button";
import { EmptyRows } from "../../shared/primitives/empty-rows";
import { ImageListSmall } from "../../shared/media/image-list-small";
import { DemoPager } from "./demo-pager";
import { groupCollapsedKey } from "./queue-model";
import type { QueueProjectGroup, QueueReviewRow } from "./types";
import s from "./pending-review-groups.runs.module.css";

const PAGE_SIZE = 8;

export function pendingReviewPageSize() {
  return PAGE_SIZE;
}

function findPageForRun(groups: QueueProjectGroup<QueueReviewRow>[], runId: string): number {
  const index = groups.findIndex((g) => g.rows.some((r) => r.run.id === runId));
  if (index < 0) return 1;
  return Math.floor(index / PAGE_SIZE) + 1;
}

export function PendingReviewGroups({
  className,
  groups,
  reviewRows,
  totalPending,
  totalPages,
  collapsedGroups,
  onToggleGroup,
  highlightRunId,
}: {
  className?: string;
  groups: QueueProjectGroup<QueueReviewRow>[];
  reviewRows: QueueReviewRow[];
  totalPending: number;
  totalPages: number;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  highlightRunId?: string;
}) {
  const initialPage = highlightRunId ? findPageForRun(groups, highlightRunId) : 1;
  const [currentPage, setCurrentPage] = useState(initialPage);
  const listRef = useRef<HTMLDivElement>(null);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedGroups = groups.slice(pageStart, pageStart + PAGE_SIZE);

  // Ensure highlighted run's group is expanded, then scroll into view
  useEffect(() => {
    if (!highlightRunId) return;
    const targetGroup = groups.find((g) => g.rows.some((r) => r.run.id === highlightRunId));
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
      // Fallback: retry after paint in case DOM isn't ready
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
          <strong>最新结果组</strong>
          <em>{groups.length} 个项目 · {reviewRows.length} 组 · {totalPending} 张待审</em>
        </div>
        <div className={s.toolbar}>
          <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已清理完成、失败和取消记录" }}>清理记录</Button>
        </div>
      </div>
      <div className={s.queueRunList} ref={listRef}>
        {pagedGroups.map((group) => {
          const collapsed = collapsedGroups.has(groupCollapsedKey(group.id));
          const pendingInGroup = group.rows.reduce((sum, row) => sum + row.pendingCount, 0);
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
                <em>{group.rows.length} 组 · {pendingInGroup} 张待审 · 最新 {group.latestCreatedAt}</em>
              </button>
              {collapsed ? null : (
                <div className={s.queueProjectRows}>
                  {group.rows.map((row) => (
                    <Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id} data-run-id={row.run.id}>
                      <div className={s.queueRunMain}>
                        <strong>{row.run.sectionName}</strong>
                        <span>run {row.run.runIndex}</span>
                        <span className={s.queueRunDate}>生成于 {row.run.createdAt}</span>
                      </div>
                      <ImageListSmall className={s.queueThumbs} images={row.run.images} limit={row.run.images.length} showCounts />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {reviewRows.length === 0 ? <EmptyRows label="当前没有待审核任务" /> : null}
      </div>
      <div className={s.queuePager}>
        <span className={s.pagerInfoFull}>显示 {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, groups.length)} · 共 {groups.length} 个项目 / {reviewRows.length} 组</span>
        <span className={s.pagerInfoCompact}>{pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, groups.length)} / {groups.length}</span>
        <DemoPager currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </div>
    </section>
  );
}

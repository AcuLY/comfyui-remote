import Link from "next/link";
import { ChevronDown, Trash2 } from "lucide-react";

import { cx, demoHref } from "../design-demo-utils";
import { Button } from "../ui/button";
import { EmptyRows } from "../ui/empty-rows";
import { ImageListSmall } from "../ui/image-list-small";
import { DemoPager } from "./demo-pager";
import { groupCollapsedKey } from "./queue-model";
import type { QueueProjectGroup, QueueReviewRow } from "./types";
import s from "./pending-review-groups.runs.module.css";

const PAGE_SIZE = 8;

export function pendingReviewPageSize() {
  return PAGE_SIZE;
}

export function PendingReviewGroups({
  groups,
  reviewRows,
  totalPending,
  totalPages,
  collapsedGroups,
  onToggleGroup,
}: {
  groups: QueueProjectGroup<QueueReviewRow>[];
  reviewRows: QueueReviewRow[];
  totalPending: number;
  totalPages: number;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
}) {
  return (
    <section className={s.queueSurface}>
      <div className={s.queueSurfaceHeader}>
        <div>
          <strong>最新结果组</strong>
          <em>{groups.length} 个项目 · {reviewRows.length} 组 · {totalPending} 张待审</em>
        </div>
        <div className={s.toolbar}>
          <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已清理完成、失败和取消记录" }}>清理记录</Button>
        </div>
      </div>
      <div className={s.queueRunList}>
        {groups.slice(0, PAGE_SIZE).map((group) => {
          const collapsed = collapsedGroups.has(groupCollapsedKey("pending", group.id));
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
                    <Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id}>
                      <div className={s.queueRunMain}>
                        <strong>{row.run.sectionName}</strong>
                        <span>run {row.run.runIndex}</span>
                        <span className={s.queueRunDate}>生成于 {row.run.createdAt}</span>
                      </div>
                      <ImageListSmall className={s.queueThumbs} images={row.run.images} limit={5} />
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
        <span className={s.pagerInfoFull}>显示 1-{Math.min(PAGE_SIZE, groups.length)} · 共 {groups.length} 个项目 / {reviewRows.length} 组</span>
        <span className={s.pagerInfoCompact}>1-{Math.min(PAGE_SIZE, groups.length)} / {groups.length}</span>
        <DemoPager currentPage={1} totalPages={totalPages} />
      </div>
    </section>
  );
}

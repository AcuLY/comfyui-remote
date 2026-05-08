"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  ImageIcon,
  Square,
  Trash2,
  X,
} from "lucide-react";

import type { DemoData, DemoRun } from "./design-demo-data";
import { cx, demoHref, filterImages, findProject, findSection, rawSectionId } from "./design-demo-utils";
import type { QueueDemoTab, ResultDemoFilter } from "./design-demo-utils";
import {
  Button,
  ButtonLink,
  DemoTabs,
  EmptyPage,
  EmptyRows,
  ImageThumbSmall,
  MetricCard,
  PageHeader,
  ReviewImageBoard,
} from "./design-demo-ui";
import s from "./design-demo.module.css";
type QueueReviewRow = {
  run: DemoRun;
  pendingCount: number;
};

type QueueProjectGroup<T> = {
  id: string;
  title: string;
  latestCreatedAt: string;
  rows: T[];
};

type DemoRunProgress = {
  percent: number;
  currentStep: number;
  totalSteps: number;
  elapsed: string | null;
  remaining: string | null;
  rate: string | null;
  stage: number;
};

type DemoCurrentRun = {
  run: DemoRun;
  progress: DemoRunProgress;
};

function buildQueueReviewRows(runs: DemoRun[]): QueueReviewRow[] {
  const sourceRuns = runs.filter((run) => run.images.length > 0);
  const needsPendingMock = sourceRuns.length > 0 && sourceRuns.every((run) => run.pendingCount === 0);

  return sourceRuns.map((run, index) => {
    const imageTotal = Math.max(run.imageCount, run.images.length, 1);
    const actualPending = run.pendingCount;
    const pendingCount = actualPending > 0 ? actualPending : needsPendingMock ? Math.min(imageTotal, 1 + (index % 3)) : 0;

    return {
      run,
      pendingCount,
    };
  });
}

function numericMeta(meta: Record<string, unknown> | null, key: string, fallback: number) {
  const value = meta?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function buildDemoRunProgress(run: DemoRun, index: number): DemoRunProgress {
  const stageOneSteps = Math.max(1, Math.round(numericMeta(run.executionMeta, "ks1Steps", 28)));
  const stageTwoSteps = Math.max(0, Math.round(numericMeta(run.executionMeta, "ks2Steps", 0)));
  const hasStageTwo = stageTwoSteps > 0;
  const totalSteps = hasStageTwo ? stageOneSteps + stageTwoSteps : stageOneSteps;
  const percent = Math.min(94, 48 + ((run.runIndex * 13 + index * 17) % 40));
  const currentStep = Math.max(1, Math.min(totalSteps, Math.round((totalSteps * percent) / 100)));

  return {
    percent,
    currentStep,
    totalSteps,
    elapsed: "02:14",
    remaining: "00:56",
    rate: "1.8s/it",
    stage: hasStageTwo && currentStep > stageOneSteps ? 2 : 1,
  };
}

function buildCurrentRunningRuns(runs: DemoRun[]): DemoCurrentRun[] {
  return runs
    .filter((run) => run.status === "running")
    .slice(0, 1)
    .map((run, index) => ({
      run,
      progress: buildDemoRunProgress(run, index),
    }));
}

function buildQueueStatusRuns(runs: DemoRun[], mode: "running" | "failed") {
  const filtered = runs.filter((run) => (mode === "running" ? ["queued", "running"].includes(run.status) : run.status === "failed"));
  if (filtered.length > 0) return filtered;
  const mockSource = runs.filter((run) => run.images.length > 0);
  const fallback = mode === "running" ? mockSource.slice(0, 4) : mockSource.slice(0, 3);
  return fallback.map((run, index) => ({
    ...run,
    status: mode === "running" ? (index % 2 === 0 ? "running" : "queued") : "failed",
    errorMessage: mode === "failed" ? run.errorMessage ?? "ComfyUI 返回空结果或连接超时" : run.errorMessage,
  }));
}

function queueDateValue(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function groupRowsByProject<T extends { run: DemoRun }>(rows: T[]): QueueProjectGroup<T>[] {
  const groups = new Map<string, QueueProjectGroup<T>>();

  rows.forEach((row) => {
    const key = row.run.projectId || row.run.projectTitle;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
      if (queueDateValue(row.run.createdAt) > queueDateValue(existing.latestCreatedAt)) {
        existing.latestCreatedAt = row.run.createdAt;
      }
      return;
    }

    groups.set(key, {
      id: key,
      title: row.run.projectTitle,
      latestCreatedAt: row.run.createdAt,
      rows: [row],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => queueDateValue(b.run.createdAt) - queueDateValue(a.run.createdAt)),
    }))
    .sort((a, b) => queueDateValue(b.latestCreatedAt) - queueDateValue(a.latestCreatedAt));
}

function groupRunsByProject(runs: DemoRun[]) {
  return groupRowsByProject(runs.map((run) => ({ run })));
}

function groupCollapsedKey(tab: QueueDemoTab, groupId: string) {
  return `${tab}:${groupId}`;
}

function QueueMetrics({
  pendingImages,
  reviewGroups,
  runningCount,
  failedCount,
}: {
  pendingImages: number;
  reviewGroups: number;
  runningCount: number;
  failedCount: number;
}) {
  return (
    <div className={s.metricGrid}>
      <MetricCard icon={ImageIcon} label="待审" value={pendingImages} meta={`${reviewGroups} 个结果组`} />
      <MetricCard icon={Clock3} label="队列" value={runningCount} meta="生成队列" />
      <MetricCard icon={AlertTriangle} label="失败" value={failedCount} meta="可重试任务" />
    </div>
  );
}

function CurrentRunningProgressCard({ runs }: { runs: DemoCurrentRun[] }) {
  if (runs.length === 0) return null;

  return (
    <section className={s.currentRunSurface} aria-label="当前运行中">
      <div className={s.currentRunHeader}>
        <div>
          <span>
            <Clock3 className={s.icon} />
            当前运行中
          </span>
          <strong>{runs.length} 个任务</strong>
        </div>
      </div>
      <div className={s.currentRunList}>
        {runs.map(({ run, progress }) => {
          const percent = Math.round(Math.max(0, Math.min(100, progress.percent)));
          const gradientSize = `${10000 / Math.max(percent, 1)}% 100%`;
          const statusText =
            progress.percent >= 100
              ? "采样完成，正在收尾"
              : `采样 ${progress.currentStep}/${progress.totalSteps}`;
          const metaItems = [
            progress.elapsed ? `已用 ${progress.elapsed}` : null,
            progress.remaining ? `剩余 ${progress.remaining}` : null,
            progress.rate,
            progress.stage > 1 ? `阶段 ${progress.stage}` : null,
          ].filter((item): item is string => Boolean(item));

          return (
            <article className={s.currentRunItem} key={run.id}>
              <div className={s.currentRunTitleBlock}>
                <strong>{run.projectTitle} · {run.sectionName}</strong>
                <span>run {run.runIndex} · 创建于 {run.createdAt}</span>
              </div>
              <div className={s.currentRunProgressBlock}>
                <div className={s.currentRunProgressTop}>
                  <span>{statusText}</span>
                  <strong>{percent}%</strong>
                </div>
                <div
                  className={s.currentRunProgressTrack}
                  role="progressbar"
                  aria-label="ComfyUI 采样进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                >
                  <span
                    className={s.currentRunProgressFill}
                    style={{ width: `${percent}%`, backgroundSize: gradientSize }}
                  />
                </div>
                <div className={s.currentRunMeta}>
                  {metaItems.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function QueuePage({ data }: { data: DemoData }) {
  const reviewRows = buildQueueReviewRows(data.runs);
  const running = buildQueueStatusRuns(data.runs, "running");
  const currentRunningRuns = buildCurrentRunningRuns(running);
  const failed = buildQueueStatusRuns(data.runs, "failed");
  const [activeTab, setActiveTab] = useState<QueueDemoTab>("pending");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const reviewGroups = groupRowsByProject(reviewRows);
  const totalPending = reviewRows.reduce((sum, row) => sum + row.pendingCount, 0);
  const pageSize = 8;
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
        <div className={s.queueTabsBar}>
          <DemoTabs
            tabs={[
              { key: "pending", label: "待审核", count: totalPending },
              { key: "running", label: "队列", count: running.length },
              { key: "failed", label: "失败", count: failed.length },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>
        {activeTab === "pending" ? (
          <section className={s.queueSurface}>
            <div className={s.queueSurfaceHeader}>
              <div>
                <strong>最新结果组</strong>
                <em>{reviewGroups.length} 个项目 · {reviewRows.length} 组 · {totalPending} 张待审</em>
            </div>
            <div className={s.toolbar}>
                <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已清理完成、失败和取消记录" }}>清理记录</Button>
            </div>
          </div>
            <div className={s.queueRunList}>
              {reviewGroups.slice(0, pageSize).map((group) => {
                const collapsed = collapsedGroups.has(groupCollapsedKey("pending", group.id));
                const pendingInGroup = group.rows.reduce((sum, row) => sum + row.pendingCount, 0);
                return (
                  <section className={s.queueProjectGroup} key={group.id}>
                    <button
                      className={s.queueProjectHeader}
                      type="button"
                      onClick={() => toggleGroup("pending", group.id)}
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
                            <div className={s.queueThumbs}>
                              {row.run.images.slice(0, 5).map((image, index) => (
                                <ImageThumbSmall image={image} key={`${image.id}-${index}`} />
                              ))}
                            </div>
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
              <span className={s.pagerInfoFull}>显示 1-{Math.min(pageSize, reviewGroups.length)} · 共 {reviewGroups.length} 个项目 / {reviewRows.length} 组</span>
              <span className={s.pagerInfoCompact}>1-{Math.min(pageSize, reviewGroups.length)} / {reviewGroups.length}</span>
              <DemoPager currentPage={1} totalPages={totalPages} />
            </div>
          </section>
        ) : activeTab === "running" ? (
          <RunList
            title="运行中"
            runs={running}
            empty="当前没有运行中或排队中的任务"
            mode="running"
            collapsedGroups={collapsedGroups}
            onToggleGroup={(groupId) => toggleGroup("running", groupId)}
          />
        ) : activeTab === "failed" ? (
          <RunList
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
  mode: "running" | "failed";
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
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
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

export function DemoPager({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const pages = Array.from(new Set([
    1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    totalPages,
  ])).filter((page) => page >= 1 && page <= totalPages);

  return (
    <div className={s.pagerControls} aria-label="分页">
      <button className={s.pagerButton} type="button" disabled={currentPage <= 1} aria-label="上一页">
        <ArrowLeft className="size-3.5" />
      </button>
      {pages.map((page, index) => {
        const previous = pages[index - 1];
        return (
          <span className={s.pagerChunk} key={page}>
            {previous && page - previous > 1 ? <span className={s.pagerEllipsis}>…</span> : null}
            <button
              className={cx(s.pagerButton, page === currentPage && s.pagerButtonActive)}
              type="button"
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </button>
          </span>
        );
      })}
      <button className={s.pagerButton} type="button" disabled={currentPage >= totalPages} aria-label="下一页">
        <ArrowRight className="size-3.5" />
      </button>
    </div>
  );
}

function mergeExecutionMeta(run: DemoRun, section: NonNullable<ReturnType<typeof findSection>>) {
  const fallback: Record<string, unknown> = {
    aspectRatio: section.aspectRatio,
    shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    checkpointName: section.checkpointName,
    workflowId: run.id,
    positivePrompt: section.positivePrompt,
    negativePrompt: section.negativePrompt,
  };

  for (const [key, value] of Object.entries(run.executionMeta ?? {})) {
    if (value !== null && value !== undefined && value !== "") fallback[key] = value;
  }

  return fallback;
}

function metaText(meta: Record<string, unknown>, key: string, fallback = "未记录") {
  const value = meta[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function promptTextWithBreakLines(value: string) {
  return value.replace(/\s*BREAK\s*/g, "\n").trim();
}

function loraName(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

function loraEntries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const path = typeof raw.path === "string" ? raw.path : "";
      if (!path) return null;
      const weight = raw.weight === null || raw.weight === undefined ? "未设权重" : String(raw.weight);
      const enabled = raw.enabled !== false;
      return { id: `${path}-${index}`, name: loraName(path), weight, enabled };
    })
    .filter((entry): entry is { id: string; name: string; weight: string; enabled: boolean } => Boolean(entry));
}

function SamplerMetaBlock({ meta, stage }: { meta: Record<string, unknown>; stage: 1 | 2 }) {
  const prefix = stage === 1 ? "ks1" : "ks2";
  const hasSampler = ["Seed", "Steps", "Cfg", "Sampler", "Denoise"].some((key) => meta[`${prefix}${key}`] !== null && meta[`${prefix}${key}`] !== undefined);

  if (!hasSampler && stage === 2) {
    return (
      <div className={s.reviewSamplerBlock} data-empty="true">
        <em>KSampler2</em>
        <p>跳过（1x 或未记录高清修复参数）</p>
      </div>
    );
  }

  return (
    <div className={s.reviewSamplerBlock}>
      <em>KSampler{stage}</em>
      <dl>
        <div><dt>seed</dt><dd>{metaText(meta, `${prefix}Seed`)}</dd></div>
        <div><dt>steps</dt><dd>{metaText(meta, `${prefix}Steps`)}</dd></div>
        <div><dt>cfg</dt><dd>{metaText(meta, `${prefix}Cfg`)}</dd></div>
        <div><dt>denoise</dt><dd>{metaText(meta, `${prefix}Denoise`)}</dd></div>
        <div data-span="2"><dt>sampler</dt><dd>{metaText(meta, `${prefix}Sampler`)}</dd></div>
      </dl>
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={s.reviewMetaStat}>
      <em>{label}</em>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewExecutionMeta({ meta }: { meta: Record<string, unknown> }) {
  const lora1 = loraEntries(meta.lora1);
  const lora2 = loraEntries(meta.lora2);
  const positivePrompt = metaText(meta, "positivePrompt", "");
  const negativePrompt = metaText(meta, "negativePrompt", "");
  const positivePromptText = positivePrompt ? promptTextWithBreakLines(positivePrompt) : "";
  const negativePromptText = negativePrompt ? promptTextWithBreakLines(negativePrompt) : "";

  return (
    <div className={s.reviewMetaBody}>
      <div className={s.reviewSamplerGrid}>
        <SamplerMetaBlock meta={meta} stage={1} />
        <SamplerMetaBlock meta={meta} stage={2} />
      </div>

      <div className={s.reviewMetaLine}>
        <MetaStat label="Checkpoint" value={metaText(meta, "checkpointName")} />
        <MetaStat label="Workflow" value={metaText(meta, "workflowId")} />
      </div>

      {(lora1.length > 0 || lora2.length > 0) ? (
        <div className={s.reviewLoraGrid}>
          {[["LoRA1", lora1] as const, ["LoRA2", lora2] as const].map(([label, entries]) => (
            <div key={label} className={s.reviewLoraColumn}>
              <em>{label}<span>{entries.length}</span></em>
              {entries.length > 0 ? (
                <ul>
                  {entries.map((entry) => (
                    <li key={entry.id} data-disabled={!entry.enabled}>
                      <span title={entry.name}>{entry.name}</span>
                      <strong>{entry.weight}</strong>
                    </li>
                  ))}
                </ul>
              ) : <p>未记录</p>}
            </div>
          ))}
        </div>
      ) : null}

      <div className={s.reviewPromptGrid}>
        <div>
          <em>Prompt<span>{positivePrompt ? `${positivePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{positivePromptText || "未记录"}</pre>
        </div>
        <div>
          <em>Negative<span>{negativePrompt ? `${negativePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{negativePromptText || "未记录"}</pre>
        </div>
      </div>
    </div>
  );
}

function ReviewMetaCard({
  section,
  run,
  meta,
}: {
  section: { name: string };
  run: DemoRun;
  meta: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const summary = meta
    ? [
        metaText(meta, "aspectRatio") || null,
        metaText(meta, "shortSidePx") ? `${metaText(meta, "shortSidePx")}px` : null,
        metaText(meta, "batchSize") ? `${metaText(meta, "batchSize")} 张` : null,
        metaText(meta, "upscaleFactor") ? `${metaText(meta, "upscaleFactor")}x` : null,
      ].filter(Boolean) as string[]
    : [];

  return (
    <section className={s.reviewMetaSurface} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={s.reviewMetaHeader}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div>
          <em>RUN-{run.runIndex.toString().padStart(2, "0")}</em>
          <strong>参数信息</strong>
          <span>{section.name} · {run.createdAt}</span>
        </div>
        {summary.length > 0 ? (
          <ul className={s.reviewMetaSummary} aria-hidden={open}>
            {summary.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : null}
        <ChevronDown className={s.reviewMetaChevron} aria-hidden="true" />
      </button>
      {meta ? <ReviewExecutionMeta meta={meta} /> : null}
    </section>
  );
}

export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  if (!run) return <EmptyPage title="没有可审核运行" />;
  const images = filterImages(run.images, filter);
  const project = findProject(data, run.projectId);
  const section = findSection(project, run.sectionId);
  const sectionPath = project && section ? `/projects/${project.id}/sections/${rawSectionId(section)}` : null;
  const executionMeta = section ? mergeExecutionMeta(run, section) : null;
  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/runs", label: "返回任务" }}
        eyebrow="审核"
        title={`${run.projectTitle} / ${run.sectionName}`}
        subtitle={`${run.pendingCount} 张待审 / ${run.imageCount} 张总图，按筛选结果进行批量处理。`}
        actions={
          <>
            {sectionPath ? <ButtonLink href={sectionPath} icon={ExternalLink}>跳转至小节</ButtonLink> : null}
            <a className={s.button} href={`/api/runs/${run.id}/workflow`} download>
              <Download className="size-4" />
              下载工作流文件
            </a>
          </>
        }
      />
      {section ? (
        <ReviewMetaCard section={section} run={run} meta={executionMeta} />
      ) : null}
      <section className={s.reviewSurface}>
        <div className={s.reviewSurfaceTabs}>
          <DemoTabs
            tabs={[
              { key: "all", label: "全部", count: run.images.length },
              { key: "pending", label: "待审", count: run.images.filter((image) => image.status === "pending").length },
              { key: "kept", label: "已保留", count: run.images.filter((image) => image.status === "kept").length },
              { key: "pstation", label: "p站", count: run.images.filter((image) => image.featured).length },
              { key: "preview", label: "预览", count: run.images.filter((image) => image.featured2).length },
              { key: "cover", label: "封面", count: run.images.filter((image) => image.cover).length },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <ReviewImageBoard images={images} />
      </section>
    </div>
  );
}

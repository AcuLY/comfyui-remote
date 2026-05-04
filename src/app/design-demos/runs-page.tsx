"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckSquare,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  ImageIcon,
  Square,
  Trash2,
  X,
} from "lucide-react";

import type { DemoData, DemoImage, DemoRun } from "./design-demo-data";
import { cx, demoHref, filterImages, findProject, findSection, rawSectionId } from "./design-demo-utils";
import type { QueueDemoTab, ResultDemoFilter } from "./design-demo-utils";
import {
  Button,
  ButtonLink,
  DemoTabs,
  EmptyPage,
  EmptyRows,
  ImageGrid,
  MetricCard,
  PageHeader,
  ReviewImageBoard,
  StatusBadge,
} from "./design-demo-ui";
import s from "./design-demo.module.css";
type QueueReviewRow = {
  run: DemoRun;
  pendingCount: number;
  keptCount: number;
  featuredCount: number;
  trashedCount: number;
  status: "pending" | "kept" | "featured" | "trashed";
  statusLabel: string;
};

function buildQueueReviewRows(runs: DemoRun[]): QueueReviewRow[] {
  const sourceRuns = runs.filter((run) => run.images.length > 0);
  const needsPendingMock = sourceRuns.length > 0 && sourceRuns.every((run) => run.pendingCount === 0);

  return sourceRuns.map((run, index) => {
    const imageTotal = Math.max(run.imageCount, run.images.length, 1);
    const actualPending = run.pendingCount;
    const pendingCount = actualPending > 0 ? actualPending : needsPendingMock ? Math.min(imageTotal, 1 + (index % 3)) : 0;
    const actualKept = run.images.filter((image) => image.status === "kept").length;
    const actualFeatured = run.images.filter((image) => image.featured || image.featured2).length;
    const actualTrashed = run.images.filter((image) => image.status === "trashed").length;
    const keptCount = Math.max(actualKept, Math.max(0, Math.min(imageTotal - pendingCount, Math.ceil(imageTotal / 2))));
    const featuredCount = Math.max(actualFeatured, keptCount > 1 ? Math.min(2, keptCount - 1) : 0);
    const trashedCount = Math.max(actualTrashed, index % 5 === 0 ? 1 : 0);
    const status =
      pendingCount > 0
        ? "pending"
        : featuredCount > 0
          ? "featured"
          : keptCount > 0
            ? "kept"
            : "trashed";
    const statusLabel =
      status === "pending"
        ? "待审"
        : status === "featured"
          ? "p站/预览"
          : status === "kept"
            ? "保留"
            : "删除";

    return {
      run,
      pendingCount,
      keptCount,
      featuredCount,
      trashedCount,
      status,
      statusLabel,
    };
  });
}

function buildQueueStatusRuns(runs: DemoRun[], mode: "running" | "failed") {
  const filtered = runs.filter((run) => (mode === "running" ? ["queued", "running"].includes(run.status) : run.status === "failed"));
  if (filtered.length > 0) return filtered;
  const fallback = runs.filter((run) => run.images.length > 0).slice(mode === "running" ? 0 : 4, mode === "running" ? 4 : 8);
  return fallback.map((run, index) => ({
    ...run,
    status: mode === "running" ? (index % 2 === 0 ? "running" : "queued") : "failed",
    errorMessage: mode === "failed" ? run.errorMessage ?? "ComfyUI 返回空结果或连接超时" : run.errorMessage,
  }));
}

function buildQueueTrashImages(images: DemoImage[]) {
  const trashed = images.filter((image) => image.status === "trashed");
  if (trashed.length > 0) return trashed;
  return images.slice(-8).map((image, index) => ({
    ...image,
    id: `trash-${image.id}-${index}`,
    status: "trashed" as const,
  }));
}

function QueueMetrics({
  pendingImages,
  reviewGroups,
  runningCount,
  failedCount,
  trashCount,
}: {
  pendingImages: number;
  reviewGroups: number;
  runningCount: number;
  failedCount: number;
  trashCount: number;
}) {
  return (
    <div className={s.metricGrid}>
      <MetricCard icon={ImageIcon} label="待审图片" value={pendingImages} meta={`${reviewGroups} 个结果组`} />
      <MetricCard icon={Clock3} label="运行中" value={runningCount} meta="生成队列" />
      <MetricCard icon={AlertTriangle} label="失败" value={failedCount} meta="可重试任务" />
      <MetricCard icon={Archive} label="回收站" value={trashCount} meta="已删除图片" />
    </div>
  );
}

export function QueuePage({ data }: { data: DemoData }) {
  const reviewRows = buildQueueReviewRows(data.runs);
  const running = buildQueueStatusRuns(data.runs, "running");
  const failed = buildQueueStatusRuns(data.runs, "failed");
  const trashImages = buildQueueTrashImages(data.images);
  const [activeTab, setActiveTab] = useState<QueueDemoTab>("pending");
  const totalPending = reviewRows.reduce((sum, row) => sum + row.pendingCount, 0);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(reviewRows.length / pageSize));
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="任务"
        title="任务工作台"
        subtitle="按状态处理待审图片、运行中任务、失败记录和回收站图片。"
      />
      <QueueMetrics
        pendingImages={totalPending}
        reviewGroups={reviewRows.length}
        runningCount={running.length}
        failedCount={failed.length}
        trashCount={trashImages.length}
      />
      <div className={s.queueSurfaceStack}>
        <div className={s.queueTabsBar}>
          <DemoTabs
            tabs={[
              { key: "pending", label: "待审核", count: totalPending },
              { key: "running", label: "运行中", count: running.length },
              { key: "failed", label: "失败", count: failed.length },
              { key: "trash", label: "回收站", count: trashImages.length },
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
                <em>{reviewRows.length} 组 · {totalPending} 张待审</em>
            </div>
            <div className={s.toolbar}>
                <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已清理完成、失败和取消记录" }}>清理记录</Button>
            </div>
          </div>
            <div className={s.queueRunList}>
              {reviewRows.slice(0, pageSize).map((row) => (
                <Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id}>
                  <div className={s.queueRunMain}>
                    <strong>{row.run.projectTitle}</strong>
                    <span>{row.run.sectionName} · run {row.run.runIndex}</span>
                    <span className={s.queueRunDate}>生成于 {row.run.createdAt}</span>
                  </div>
                  <div className={s.queueThumbs}>
                    {row.run.images.slice(0, 5).map((image, index) => (
                      <span key={`${image.id}-${index}`}>
                        {image.src ? <img src={image.src} alt="" loading="eager" /> : <ImageIcon className={s.icon} />}
                      </span>
                    ))}
                  </div>
                  <div className={s.queueRunMeta}>
                    <span className={s.badge}>{row.pendingCount} 待审</span>
                    <span className={s.badge}>{row.keptCount} 保留</span>
                    <span className={s.badge}>{row.featuredCount} p站/预览</span>
                    <span className={s.badge}>{row.trashedCount} 删除</span>
                  </div>
                  <StatusBadge status={row.status} label={row.statusLabel} />
                </Link>
              ))}
              {reviewRows.length === 0 ? <EmptyRows label="当前没有待审核任务" /> : null}
            </div>
            <div className={s.queuePager}>
              <span>显示 1-{Math.min(pageSize, reviewRows.length)} · 共 {reviewRows.length} 组</span>
              <DemoPager currentPage={1} totalPages={totalPages} />
            </div>
          </section>
        ) : activeTab === "running" ? (
          <RunList title="运行中" runs={running} empty="当前没有运行中或排队中的任务" mode="running" />
        ) : activeTab === "failed" ? (
          <RunList title="最近失败" runs={failed} empty="当前没有失败任务" mode="failed" />
        ) : (
          <section className={s.queueSurface}>
            <div className={s.queueSurfaceHeader}>
              <div>
                <strong>回收站</strong>
                <em>{trashImages.length} 张已删除图片</em>
              </div>
              <div className={s.toolbar}>
                <Button icon={Archive} feedback={{ title: "恢复操作已加入队列", detail: `${trashImages.length} 张图片` }}>恢复所选</Button>
                <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "清空图片需要确认", detail: `${trashImages.length} 张图片` }}>清空已选</Button>
              </div>
            </div>
            {trashImages.length ? (
              <ImageGrid images={trashImages} showStatus={false} selectable />
            ) : (
              <EmptyRows label="当前没有回收站图片" />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function RunList({ title, runs, empty, mode }: { title: string; runs: DemoRun[]; empty: string; mode: "running" | "failed" }) {
  const visibleRuns = runs.slice(0, 8);
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
          <em>{runs.length} 条记录{selectedVisibleCount > 0 ? ` · 已选 ${selectedVisibleCount}` : ""}</em>
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
          {visibleRuns.map((run) => {
            const selected = selectedIds.has(run.id);
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
                  <strong>{run.projectTitle}</strong>
                  <span>{run.sectionName} · run {run.runIndex}</span>
                  <span className={s.queueRunDate}>{mode === "running" ? "开始于" : "失败于"} {run.startedAt ?? run.createdAt}</span>
                  {mode === "failed" ? <span className={s.queueRunError}>原因：{run.errorMessage ?? "ComfyUI 返回空结果或连接超时"}</span> : null}
                </div>
                <div className={s.queueRunMeta}>
                  <span className={s.badge}>run {run.runIndex}</span>
                  <span className={s.badge}>{run.imageCount} 图</span>
                </div>
                <StatusBadge status={run.status} />
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
          <pre>{positivePrompt || "未记录"}</pre>
        </div>
        <div>
          <em>Negative<span>{negativePrompt ? `${negativePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{negativePrompt || "未记录"}</pre>
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
            {sectionPath ? <ButtonLink href={`${sectionPath}/results`} icon={ImageIcon}>查看结果</ButtonLink> : null}
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
      <section className={s.reviewSurface}>
        <ReviewImageBoard images={images} />
      </section>
    </div>
  );
}


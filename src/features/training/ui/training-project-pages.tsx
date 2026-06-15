"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Copy,
  CopyPlus,
  Edit3,
  FileText,
  GripVertical,
  ImagePlus,
  Layers,
  Play,
  Plus,
  Save,
  Snowflake,
  Trash2,
  Upload,
} from "lucide-react";

import { toImageUrl } from "@/lib/image-url";
import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { ImagePreviewFrame } from "@/components/design-demo-ui/media/image-preview-frame";
import { ImagePreviewLarge } from "@/components/design-demo-ui/media/image-preview-large";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { SortableList, useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { SwitchRow } from "@/components/design-demo-ui/primitives/switch-row";
import { SelectionBatchBar } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingDemoData } from "@/features/training/build";
import type { TrainingAppData, TrainingModelOption } from "@/features/training/data";
import type { TrainingImage as DemoImage, LoraTrainingImageResult, LoraTrainingPreset, LoraTrainingProject, LoraTrainingReferenceImage, LoraTrainingRun, LoraTrainingSection, LoraTrainingSectionBlock, LoraTrainingTaskKind, LoraTrainingTaskStatus, LoraTrainingTemplate } from "@/features/training/types";
import s from "./training-project-pages.module.css";

const PROJECT_TABS = [
  { key: "overview", label: "总览", path: "" },
  { key: "profile", label: "资料", path: "/profile" },
  { key: "sections", label: "小节", path: "/sections" },
  { key: "results", label: "结果池", path: "/results" },
  { key: "dataset", label: "数据集", path: "/dataset" },
  { key: "generation", label: "生成任务", path: "/generation-tasks" },
  { key: "training", label: "训练任务", path: "/training-runs" },
] as const;

const STATUS_ITEMS: Array<{ value: LoraTrainingTaskStatus; label: string }> = [
  { value: "completed", label: "完成" },
  { value: "running", label: "进行中" },
  { value: "queued", label: "排队" },
  { value: "failed", label: "失败" },
];

const RESULT_FILTER_ITEMS = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待审" },
  { value: "kept", label: "保留" },
  { value: "rejected", label: "拒绝" },
] as const;

type TrainingResultFilter = (typeof RESULT_FILTER_ITEMS)[number]["value"];
type LoraTrainingTemplateSeedSection = LoraTrainingTemplate["sections"][number];
type SceneBlockPatch = Partial<Pick<LoraTrainingSectionBlock, "text" | "title">>;
type ProjectReferenceUploadDraft = {
  file: File;
  id: string;
  previewReference: ReferenceCandidate;
  title: string;
};
type ProjectSectionDraftState = {
  blockCount: number;
  firstBlock: string;
  imagePrompt: string;
  projectTitle: string;
  projectId: string;
  scenePreview: string;
  sectionId: string;
  sectionTitle: string;
};
const DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT = "保持角色正面可训练，避免复杂遮挡和多人构图。";
const PROJECT_RUN_ERROR_CLAMP_LINES = 3;

type NewProjectTemplateHints = {
  sections: string;
  templateId: string;
  templateTitle: string;
};

function useTraining(data: TrainingAppData) {
  return buildLoraTrainingDemoData(data);
}

function isTrainingModelOption(value: unknown): value is TrainingModelOption {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.modelType === "checkpoint"
    && typeof record.name === "string"
    && typeof record.relativePath === "string";
}

function findProject(data: TrainingAppData, projectId?: string) {
  if (!projectId) return undefined;
  const training = buildLoraTrainingDemoData(data);
  return training.projects.find((project) => project.id === projectId);
}

function findSection(project: LoraTrainingProject | undefined, sectionId?: string) {
  if (!project || !sectionId) return undefined;
  return project.sections.find((section) => section.id === sectionId);
}

function buildProjectSectionStateKey(projectId: string, sectionId: string) {
  return `${projectId}:${sectionId}`;
}

function moveSceneBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

function nextSceneBlockOrdinal(blocks: LoraTrainingSectionBlock[], prefix: string) {
  const ordinals = blocks
    .map((block) => (block.id.startsWith(prefix) ? Number(block.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function buildSeedSectionCopy(section: LoraTrainingTemplateSeedSection, copyNumber: number): LoraTrainingTemplateSeedSection {
  return {
    ...section,
    id: `${section.id}-copy-${copyNumber}`,
    title: `${section.title} 副本 ${copyNumber}`,
  };
}

function nextSeedSectionCopyNumber(sections: LoraTrainingTemplateSeedSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextProjectSectionCopyNumber(sections: LoraTrainingSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextProjectSectionDraftNumber(sections: LoraTrainingSection[]) {
  const draftPrefix = "new-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function useUrlSearch() {
  const searchParams = useSearchParams();
  return searchParams.toString();
}

function readNewProjectTemplateHints(search: string): NewProjectTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    sections: searchParams.get("sections") ?? "",
    templateId: searchParams.get("templateId") ?? "",
    templateTitle: searchParams.get("template") ?? "",
  };
}

function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

function buildTrainingProjectTriggerToken(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");
  return normalized || "training_project";
}

function buildProjectReferenceUploadPreview(file: File, draftId: string): ReferenceCandidate {
  const title = file.name.replace(/\.[^.]+$/, "") || "本地上传图片";
  const url = URL.createObjectURL(file);

  return {
    id: draftId,
    title,
    detail: "创建项目后会自动上传到角色资料，并作为参考图保留。",
    image: {
      id: `${draftId}-image`,
      src: url,
      full: url,
      label: title,
      status: "pending",
      featured: false,
      featured2: false,
      cover: false,
      width: null,
      height: null,
    },
    meta: "本地上传",
  };
}

function toTrainingImageReviewApiStatus(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
  if (reviewStatus === "kept") return "keep";
  if (reviewStatus === "rejected") return "reject";
  return "pending";
}

function reviewResultToastTitle(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
  return reviewStatus === "kept" ? "图片已保留" : reviewStatus === "rejected" ? "图片已拒绝" : "图片已标记为待审核";
}

function buildUploadedReferenceImage(
  input: {
    id: string;
    index: number;
    label: string;
    note: string;
    relativePath: string;
  },
): LoraTrainingReferenceImage | null {
  const url = toImageUrl(input.relativePath);
  if (!url) return null;
  return {
    id: input.id,
    kind: input.index === 0 ? "original" : "auxiliary",
    label: input.label,
    note: input.note,
    image: {
      id: `${input.id}-image`,
      src: url,
      full: url,
      label: input.label,
      status: "pending",
      featured: input.index === 0,
      featured2: false,
      cover: input.index === 0,
      width: null,
      height: null,
    },
  };
}

function buildUploadedSupplementalImage(input: {
  detail: string;
  id: string;
  relativePath: string;
  title: string;
}): SupplementalImageAttachment | null {
  const url = toImageUrl(input.relativePath);
  if (!url) return null;
  return {
    detail: input.detail,
    id: input.id,
    image: {
      id: `${input.id}-image`,
      src: url,
      full: url,
      label: input.title,
      status: "pending",
      featured: false,
      featured2: false,
      cover: false,
      width: null,
      height: null,
    },
    source: "上传",
    title: input.title,
  };
}

function ProjectNav({ active, project }: { active: (typeof PROJECT_TABS)[number]["key"]; project: LoraTrainingProject }) {
  const hrefForRoute = useRouteHref();
  return (
    <nav className={s.projectNav} aria-label="训练项目页面">
      {PROJECT_TABS.map((item) => (
        <Link
          aria-current={item.key === active ? "page" : undefined}
          className={cx(s.projectNavItem, item.key === active && s.projectNavItemActive)}
          href={hrefForRoute(`/training/projects/${project.id}${item.path}`)}
          key={item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function ProjectHeader({
  active,
  actions,
  project,
  subtitle,
  title,
}: {
  active: (typeof PROJECT_TABS)[number]["key"];
  actions?: ReactNode;
  project: LoraTrainingProject;
  subtitle?: string;
  title?: string;
}) {
  return (
    <>
      <PageHeader
        back={{ href: "/training/projects", label: "返回训练项目" }}
        eyebrow="LoRA 训练项目"
        title={title ?? project.title}
        subtitle={subtitle ?? project.profileSummary}
        actions={actions}
      />
      <ProjectNav active={active} project={project} />
    </>
  );
}

function reviewStatusLabel(status: LoraTrainingImageResult["reviewStatus"]) {
  if (status === "kept") return "保留";
  if (status === "rejected") return "拒绝";
  return "待审";
}

function reviewStatusTone(status: LoraTrainingImageResult["reviewStatus"]) {
  if (status === "kept") return "kept";
  if (status === "rejected") return "failed";
  return "pending";
}

function referenceKindLabel(kind: LoraTrainingReferenceImage["kind"]) {
  if (kind === "original") return "原始";
  if (kind === "generated") return "生成";
  return "辅助";
}

function nextDatasetVersionLabel(currentVersion: string) {
  const match = /^v(\d+)$/i.exec(currentVersion.trim());
  if (!match) return "v1";
  return `v${Number(match[1]) + 1}`;
}

function normalizeGenerationDraftReferenceId(referenceId: string) {
  if (referenceId.startsWith("reference-")) return referenceId.slice("reference-".length);
  if (referenceId.startsWith("result-")) return referenceId.slice("result-".length);
  return referenceId;
}

function captionMissing(caption: string) {
  const normalized = caption.trim();
  return normalized.length === 0 || normalized === "未填写说明文本";
}

function deriveDatasetCaption(result: LoraTrainingImageResult) {
  if (!captionMissing(result.caption)) return result.caption;
  return `${result.sourceLabel}，训练说明`;
}

function buildLocalDatasetRevision(projectId: string, results: LoraTrainingImageResult[], version: string) {
  const keptResults = results.filter((result) => result.reviewStatus === "kept");
  const samples = keptResults.slice(0, 6).map((result, index) => ({
    id: `${projectId}-dataset-${version}-${index + 1}`,
    label: String(index + 1).padStart(3, "0"),
    sectionTitle: result.sectionTitle,
    image: result.image,
    captionSnapshot: result.caption,
    filePathSnapshot: `datasets/${projectId}/${version}/${String(index + 1).padStart(3, "0")}.png`,
  }));

  return {
    id: `${projectId}-dataset-${version}`,
    version,
    status: keptResults.some((result) => captionMissing(result.caption)) ? "draft" as const : "ready" as const,
    createdAt: "刚刚",
    itemCount: keptResults.length,
    captionMissingCount: keptResults.filter((result) => captionMissing(result.caption)).length,
    manifestName: `dataset_${version}.jsonl`,
    samples,
    manifestRows: samples.slice(0, 4).map((sample) => `${sample.filePathSnapshot} | ${sample.captionSnapshot}`),
    relatedTrainingRunIds: [],
  };
}

function TrainingResultGrid({
  onReviewStatusChange,
  onToggleSelected,
  results,
  selectedIds,
  title = "训练结果",
}: {
  onReviewStatusChange?: (resultId: string, status: LoraTrainingImageResult["reviewStatus"]) => void;
  onToggleSelected?: (resultId: string) => void;
  results: LoraTrainingImageResult[];
  selectedIds?: Set<string>;
  title?: string;
}) {
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const activeResult = activeResultId ? results.find((result) => result.id === activeResultId) ?? null : null;
  const activeResultIndex = activeResult ? results.findIndex((result) => result.id === activeResult.id) : -1;

  function moveActiveResult(offset: number) {
    if (results.length === 0) return;
    setActiveResultId((current) => {
      const currentIndex = current ? results.findIndex((result) => result.id === current) : -1;
      const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + offset + results.length) % results.length;
      return results[nextIndex]?.id ?? null;
    });
  }

  if (results.length === 0) return <div className={s.emptyInline}>没有训练结果图片</div>;

  return (
    <>
      <div className={s.trainingResultGrid}>
        {results.map((result) => {
          const selected = selectedIds?.has(result.id) ?? false;

          return (
            <article
              className={cx(s.trainingResultCard, selected && s.trainingResultCardSelected)}
              data-review-status={result.reviewStatus}
              key={result.id}
            >
              {onToggleSelected ? (
                <div className={s.trainingResultCardControls}>
                  <Checkbox
                    checked={selected}
                    label={selected ? `取消选择训练结果：${result.sourceLabel}` : `选择训练结果：${result.sourceLabel}`}
                    onCheckedChange={() => onToggleSelected(result.id)}
                    stopPropagation
                    variant="compact"
                  />
                  <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />
                </div>
              ) : null}
              <button
                aria-label={`打开训练结果：${result.sourceLabel}`}
                className={s.trainingResultPreviewButton}
                type="button"
                onClick={() => setActiveResultId(result.id)}
              >
                <ImagePreviewFrame image={result.image} />
              </button>
              <span className={s.trainingResultMeta}>
                <strong>{result.sourceLabel}</strong>
                {onToggleSelected ? null : <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />}
              </span>
              <p className={s.trainingResultCaption}>{result.caption}</p>
            </article>
          );
        })}
      </div>
      {activeResult ? (
        <ImagePreviewLarge
          image={activeResult.image}
          title={`${title} / ${activeResult.sectionTitle}`}
          meta={activeResult.caption}
          onClose={() => setActiveResultId(null)}
          onNext={activeResultIndex >= 0 ? () => moveActiveResult(1) : undefined}
          onPrevious={activeResultIndex >= 0 ? () => moveActiveResult(-1) : undefined}
          actions={(
            <>
              <Button icon={Check} ariaLabel={`保留训练结果：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange?.(activeResult.id, "kept")}>保留</Button>
              <Button tone="danger" icon={Trash2} ariaLabel={`拒绝训练结果：${activeResult.sourceLabel}`} onClick={() => onReviewStatusChange?.(activeResult.id, "rejected")}>拒绝</Button>
            </>
          )}
        />
      ) : null}
    </>
  );
}

function runPreviewImages(run: LoraTrainingRun, project: LoraTrainingProject) {
  if (run.kind === "training") {
    return (run.datasetSamples ?? []).map((sample) => sample.image).slice(0, 4);
  }

  if (!run.summary.startsWith("图片")) return [];
  return project.resultPool.map((result) => result.image).slice(0, run.status === "completed" ? 4 : 3);
}

function projectRunStatusLabel(status: LoraTrainingTaskStatus) {
  if (status === "completed") return "完成";
  if (status === "running") return "进行中";
  if (status === "queued") return "排队";
  return "失败";
}

function ProjectRunFailureBlock({ message }: { message: string }) {
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
    <div className={s.projectRunFailureBlock} role="status">
      <div className={s.projectRunFailureHeader}>
        <CircleAlert aria-hidden="true" />
        <span>失败原因</span>
        {overflows && !expanded ? (
          <button
            type="button"
            className={s.projectRunFailureToggle}
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
            className={s.projectRunFailureToggle}
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
        className={cx(s.projectRunFailureText, !expanded && s.projectRunFailureTextClamped)}
        style={{ ["--error-clamp-lines" as string]: PROJECT_RUN_ERROR_CLAMP_LINES }}
      >
        {message}
      </p>
    </div>
  );
}

async function copyProjectRunMessage(message: string) {
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

function RunRows({
  onDeleteRun,
  isDeletingRuns = false,
  onRetryRun,
  project,
  retriedRunIds = new Set<string>(),
  runs,
}: {
  onDeleteRun?: (runId: string) => void;
  isDeletingRuns?: boolean;
  onRetryRun?: (runId: string) => void;
  project: LoraTrainingProject;
  retriedRunIds?: Set<string>;
  runs: LoraTrainingRun[];
}) {
  const hrefForRoute = useRouteHref();
  if (runs.length === 0) return <div className={s.emptyInline}>没有任务记录</div>;

  return (
    <div className={s.projectRunRowsSurface}>
      <div className={s.projectRunRows}>
        {runs.map((run) => {
          const type = run.kind === "generation" ? "generation" : "training";
          const previewImages = runPreviewImages(run, project);
          const retried = retriedRunIds.has(run.id);
          const failed = run.status === "failed" && !retried;
          const failureMessage = run.errorMessage ?? "任务失败，请打开详情查看日志。";
          return (
            <article className={cx(s.projectRunRow, failed && s.projectRunRowFailed)} key={run.id}>
              <Link className={s.projectRunMain} href={hrefForRoute(`/training/runs/${type}/${run.id}`)}>
                <span className={s.projectRunText}>
                  <strong>{run.title}</strong>
                  <span>{run.summary} · {run.timestamp}</span>
                  {run.outputLabel ? <em>{run.outputLabel}</em> : null}
                  {run.waitReason ? <em>{run.waitReason}</em> : null}
                  {retried ? <em>已排队重试</em> : null}
                </span>
              </Link>
              {previewImages.length > 0 ? (
                <ImageListSmall
                  className={s.projectRunThumbs}
                  images={previewImages}
                  limit={previewImages.length}
                  showCounts={run.kind === "generation"}
                />
              ) : null}
              <span className={s.projectRunStatus}>
                <StatusBadge status={retried ? "pending" : run.status === "completed" ? "done" : run.status} label={retried ? "已排队重试" : projectRunStatusLabel(run.status)} />
              </span>
              {failed ? (
                <div className={s.projectRunSecondary}>
                  <ProjectRunFailureBlock message={failureMessage} />
                  <div className={s.projectRunFailureToolbar}>
                    <Button size="sm" tone="subtle" icon={Copy} ariaLabel={`复制任务报错：${run.title}`} onClick={() => copyProjectRunMessage(failureMessage)} feedback={{ title: "报错已复制", detail: failureMessage }}>复制</Button>
                    <Button size="sm" tone="subtle" icon={Play} ariaLabel={`重试任务：${run.title}`} onClick={() => onRetryRun?.(run.id)}>重试</Button>
                    <Button size="sm" tone="danger" icon={Trash2} pending={isDeletingRuns} ariaLabel={`移除任务：${run.title}`} onClick={() => onDeleteRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
                  </div>
                </div>
              ) : (
                <span className={s.projectRunActions}>
                  <Button tone="danger" icon={Trash2} pending={isDeletingRuns} ariaLabel={`移除任务：${run.title}`} onClick={() => onDeleteRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
                </span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

type ReferenceCandidate = {
  id: string;
  title: string;
  detail: string;
  image?: DemoImage;
  meta?: string;
};

type SupplementalImageAttachment = {
  id: string;
  title: string;
  detail: string;
  image: DemoImage;
  source: string;
};

type ReferenceSourceGroup = {
  id: string;
  title: string;
  description: string;
  items: ReferenceCandidate[];
};

function TrainingSectionRail({
  activeSectionId,
  project,
  sections = project.sections,
}: {
  activeSectionId?: string;
  project: LoraTrainingProject;
  sections?: LoraTrainingSection[];
}) {
  const hrefForRoute = useRouteHref();
  return (
    <nav className={s.trainingSectionRail} aria-label="训练小节导航">
      <div className={s.trainingSectionRailHeader}>
        <strong>小节导航</strong>
        <span>{sections.length} 小节</span>
      </div>
      <div className={s.trainingSectionRailList}>
        {sections.map((section) => {
          const resultCount = project.resultPool.filter((result) => result.sectionId === section.id).length;
          return (
            <Link
              aria-current={activeSectionId === section.id ? "page" : undefined}
              className={cx(s.trainingSectionRailItem, activeSectionId === section.id && s.trainingSectionRailItemActive)}
              href={hrefForRoute(`/training/projects/${project.id}/sections/${section.id}`)}
              key={section.id}
            >
              <strong>{section.title}</strong>
              <span>{resultCount} 张结果</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TrainingSectionWorkspace({
  activeSectionId,
  children,
  project,
  sections,
}: {
  activeSectionId?: string;
  children: ReactNode;
  project: LoraTrainingProject;
  sections?: LoraTrainingSection[];
}) {
  return (
    <div className={s.trainingSectionWorkspace}>
      <div className={s.sectionScrollPane}>
        {children}
      </div>
      <TrainingSectionRail activeSectionId={activeSectionId} project={project} sections={sections} />
    </div>
  );
}

function SceneBlockCard({
  block,
  index,
  isEditing,
  onDelete,
  onEdit,
  onMove,
  onUpdate,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  isEditing?: boolean;
  onDelete?: (blockId: string) => void;
  onEdit?: (blockId: string | null) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  onUpdate?: (blockId: string, patch: SceneBlockPatch) => void;
  total: number;
}) {
  return (
    <article className={s.sceneBlockCard}>
      <div className={s.sceneBlockBody}>
        <span className={s.sceneBlockSource}>{block.source}</span>
        {isEditing ? (
          <div className={s.sceneBlockEditor}>
            <Field label="场景块标题" value={block.title} onChange={(value) => onUpdate?.(block.id, { title: value })} />
            <Field
              multiline
              features={{ clipboard: true, resize: true }}
              label="场景块文本"
              value={block.text}
              onChange={(value) => onUpdate?.(block.id, { text: value })}
            />
          </div>
        ) : (
          <>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </>
        )}
      </div>
      <div className={s.sceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={isEditing ? `收起场景块编辑：${block.title}` : `编辑场景块：${block.title}`} onClick={() => onEdit?.(isEditing ? null : block.id)}>{isEditing ? "收起" : "编辑"}</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移场景块：${block.title}`} feedback={{ title: "场景块已上移", detail: block.title }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移场景块：${block.title}`} feedback={{ title: "场景块已下移", detail: block.title }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除场景块：${block.title}`} feedback={{ tone: "warning", title: "场景块已从草稿移除", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}

function ReferencePicker({
  onPreviewReference,
  onAddReference,
  previewReference,
  referenceSourceTree,
  selectedReferenceIds: controlledSelectedReferenceIds,
}: {
  onAddReference?: (candidate: ReferenceCandidate) => void;
  onPreviewReference: (candidate: ReferenceCandidate) => void;
  previewReference: ReferenceCandidate | null;
  referenceSourceTree: ReferenceSourceGroup[];
  selectedReferenceIds?: Set<string>;
}) {
  const [localSelectedReferenceIds, setLocalSelectedReferenceIds] = useState<Set<string>>(new Set());
  const selectedReferenceIds = controlledSelectedReferenceIds ?? localSelectedReferenceIds;
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const previewAlreadyAdded = previewReference ? selectedReferenceIds.has(previewReference.id) : false;

  function handleAddReference() {
    if (!previewReference || previewAlreadyAdded) return;
    if (onAddReference) {
      onAddReference(previewReference);
      return;
    }
    setLocalSelectedReferenceIds((current) => new Set([...current, previewReference.id]));
  }

  return (
    <div className={s.referencePicker}>
      <div className={s.referenceSourceTree}>
        {referenceSourceTree.map((group) => (
          <section className={s.referenceSourceGroup} key={group.id}>
            <div className={s.referenceSourceGroupHeader}>
              <strong>{group.title}</strong>
              <span>{group.description}</span>
            </div>
            <div className={s.referenceCandidateList}>
              {group.items.map((candidate) => (
                <button
                  className={cx(s.referenceCandidate, previewReference?.id === candidate.id && s.referenceCandidateActive)}
                  key={candidate.id}
                  type="button"
                  onClick={() => onPreviewReference(candidate)}
                >
                  {candidate.image ? <ImagePreviewFrame image={candidate.image} /> : null}
                  <span>
                    <strong>{candidate.title}</strong>
                    <em>{candidate.meta ?? group.title}</em>
                    <small>{candidate.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <aside className={s.referencePreview} aria-label="引用预览">
        {previewReference?.image ? <ImagePreviewFrame image={previewReference.image} /> : null}
        <div>
          <strong>{previewReference?.title ?? "选择一个引用"}</strong>
          <p>{previewReference?.detail ?? "点击左侧候选只会更新预览，不会直接写入任务。确认后再添加引用。"}</p>
        </div>
        <Button
          icon={Plus}
          disabled={!previewReference || previewAlreadyAdded}
          onClick={handleAddReference}
          feedback={{ title: "引用已加入任务草稿", detail: previewReference?.title }}
        >
          {previewAlreadyAdded ? "已添加" : "添加引用"}
        </Button>
        {selectedReferences.length ? (
          <div className={s.selectedReferenceList} aria-label="已添加引用">
            <strong>已添加引用</strong>
            {selectedReferences.map((reference) => (
              <span key={reference.id}>{reference.title}</span>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function LoraTrainingProjectFormPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const projectReferenceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const isProductionTrainingRoute = pathname === "/training" || pathname.startsWith("/training/");
  const training = useTraining(data);
  const urlSearch = useUrlSearch();
  const newProjectTemplateHints = readNewProjectTemplateHints(urlSearch);
  const sourceTemplate = training.templates.find((template) => template.id === newProjectTemplateHints.templateId)
    ?? training.templates.find((template) => template.title === newProjectTemplateHints.templateTitle);
  const initialTemplate = sourceTemplate;
  const initialSectionSeeds = sourceTemplate?.sections ?? [];
  const projectTemplateContextId = initialTemplate?.id ?? "no-template";
  const fallbackCheckpointModels = data.models.filter((model) => model.modelType === "checkpoint");
  const [availableCheckpointModels, setAvailableCheckpointModels] = useState<TrainingModelOption[]>(fallbackCheckpointModels);
  const baseModelOptions = availableCheckpointModels.map((model) => model.name);
  const defaultProjectForm = {
    baseModel: baseModelOptions[0] ?? "继承训练默认模型",
    captionStrategy: "先触发词后描述",
    detailPrompt: "发型、眼睛、服装材质、常见构图和需要避免的变化。",
    perSectionImageCount: "4",
    templateContextId: projectTemplateContextId,
    templateTitle: sourceTemplate?.title ?? "不使用模板",
    title: "新角色 LoRA 项目",
    trainingSteps: "2400",
    usagePrompt: "角色触发词、服装和稳定身份描述。",
  };
  const [projectFormState, setProjectFormState] = useState(defaultProjectForm);
  const projectForm = projectFormState.templateContextId === projectTemplateContextId ? projectFormState : defaultProjectForm;
  const [projectReferenceUploadState, setProjectReferenceUploadState] = useState(() => ({
    templateContextId: projectTemplateContextId,
    uploads: [] as ProjectReferenceUploadDraft[],
  }));
  const stagedProjectReferenceUploads = projectReferenceUploadState.templateContextId === projectTemplateContextId
    ? projectReferenceUploadState.uploads
    : [];
  const referenceSourceTree: ReferenceSourceGroup[] = [
    {
      id: "existing-training-projects",
      title: "已有训练项目",
      description: "可复用资料",
      items: training.projects.slice(0, 3).map((project) => ({
        id: `project-${project.id}`,
        title: project.title,
        detail: project.profileSummary,
        image: project.referenceImages[0]?.image,
        meta: `${project.sectionCount} 小节`,
      })),
    },
    {
      id: "recent-training-results",
      title: "结果池样本",
      description: "最近已保留图",
      items: training.projects.flatMap((project) => project.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 2).map((result) => ({
        id: `result-${result.id}`,
        title: `${project.title} / ${result.sectionTitle}`,
        detail: result.caption,
        image: result.image,
        meta: "已保留",
      }))).slice(0, 4),
    },
    {
      id: "local-image-library",
      title: "本地图库",
      description: "资料候选",
      items: isProductionTrainingRoute ? [] : data.images.slice(0, 4).map((image) => ({
        id: `image-${image.id}`,
        title: image.label,
        detail: "作为新训练项目的原始参考图，确认后加入角色资料。",
        image,
        meta: image.status,
      })),
    },
    {
      id: "staged-uploaded-images",
      title: "本地上传",
      description: "创建后自动导入",
      items: stagedProjectReferenceUploads.map((upload) => upload.previewReference),
    },
  ].filter((group) => group.items.length > 0);
  const [projectReferenceSelectionState, setProjectReferenceSelectionState] = useState(() => ({
    previewReference: referenceSourceTree[0]?.items[0] ?? null,
    selectedReferenceIds: new Set<string>(),
    templateContextId: projectTemplateContextId,
  }));
  const [sectionSeedState, setSectionSeedState] = useState(() => ({
    sections: initialSectionSeeds,
    templateContextId: projectTemplateContextId,
  }));
  const sectionSeeds = sectionSeedState.templateContextId === projectTemplateContextId ? sectionSeedState.sections : initialSectionSeeds;
  const defaultTrainingDefaults = {
    autoFreezeDataset: true,
    autoGenerateSamples: true,
    templateContextId: projectTemplateContextId,
  };
  const [trainingDefaultsState, setTrainingDefaultsState] = useState(defaultTrainingDefaults);
  const trainingDefaults = trainingDefaultsState.templateContextId === projectTemplateContextId ? trainingDefaultsState : defaultTrainingDefaults;
  type CreatedProjectDraft = {
    autoFreezeDataset: boolean;
    autoGenerateSamples: boolean;
    baseModel: string;
    captionStrategy: string;
    detailPrompt: string;
    enabledSectionCount: number;
    perSectionImageCount: string;
    selectedReferenceCount: number;
    selectedReferenceTitles: string[];
    sectionCount: number;
    templateTitle: string;
    title: string;
    trainingSteps: string;
    usagePrompt: string;
  };
  const [createdProjectDraftState, setCreatedProjectDraftState] = useState<{
    draft: CreatedProjectDraft | null;
    templateContextId: string;
  }>(() => ({
    draft: null,
    templateContextId: projectTemplateContextId,
  }));
  const projectReferenceSelection = projectReferenceSelectionState.templateContextId === projectTemplateContextId ? projectReferenceSelectionState : {
    previewReference: referenceSourceTree[0]?.items[0] ?? null,
    selectedReferenceIds: new Set<string>(),
    templateContextId: projectTemplateContextId,
  };
  const activePreviewReference = projectReferenceSelection.previewReference ?? referenceSourceTree[0]?.items[0] ?? null;
  const selectedReferenceIds = projectReferenceSelection.selectedReferenceIds;
  const createdProjectDraft = createdProjectDraftState.templateContextId === projectTemplateContextId ? createdProjectDraftState.draft : null;
  const selectedProjectReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const stagedProjectReferenceUploadIds = new Set(stagedProjectReferenceUploads.map((upload) => upload.id));
  const selectedStagedProjectReferenceUploads = stagedProjectReferenceUploads.filter((upload) => selectedReferenceIds.has(upload.id));
  const selectedReferenceTitles = selectedProjectReferences.map((reference) => reference.title);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  useEffect(() => {
    if (!isProductionTrainingRoute) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/training/models?kind=checkpoint");
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload.data)) return;

        const nextModels = (payload.data as unknown[])
          .filter(isTrainingModelOption)
          .map((item) => ({
            modelType: item.modelType,
            name: item.name,
            relativePath: item.relativePath,
          }));

        if (!cancelled && nextModels.length > 0) {
          setAvailableCheckpointModels(nextModels);
        }
      } catch {
        // Keep the build-time fallback model list when the training model catalog is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isProductionTrainingRoute]);

  function setProjectForm(updater: (current: typeof projectForm) => typeof projectForm) {
    setProjectFormState((current) => updater(current.templateContextId === projectTemplateContextId ? current : projectForm));
  }

  function setTrainingDefaults(updater: (current: typeof trainingDefaults) => typeof trainingDefaults) {
    setTrainingDefaultsState((current) => ({
      ...updater(current.templateContextId === projectTemplateContextId ? current : defaultTrainingDefaults),
      templateContextId: projectTemplateContextId,
    }));
  }

  function setSectionSeeds(nextValue: LoraTrainingTemplateSeedSection[] | ((current: LoraTrainingTemplateSeedSection[]) => LoraTrainingTemplateSeedSection[])) {
    setSectionSeedState((current) => {
      const currentSections = current.templateContextId === projectTemplateContextId ? current.sections : sectionSeeds;
      const nextSections = typeof nextValue === "function" ? nextValue(currentSections) : nextValue;
      return {
        sections: nextSections,
        templateContextId: projectTemplateContextId,
      };
    });
  }

  function setSelectedReferenceIds(updater: (current: Set<string>) => Set<string>) {
    setProjectReferenceSelectionState((current) => {
      const active = current.templateContextId === projectTemplateContextId ? current : projectReferenceSelection;
      return {
        ...active,
        selectedReferenceIds: updater(active.selectedReferenceIds),
        templateContextId: projectTemplateContextId,
      };
    });
  }

  function setCreatedProjectDraft(draft: CreatedProjectDraft) {
    setCreatedProjectDraftState({
      draft,
      templateContextId: projectTemplateContextId,
    });
  }

  function handlePreviewProjectReference(candidate: ReferenceCandidate) {
    setProjectReferenceSelectionState((current) => {
      const active = current.templateContextId === projectTemplateContextId ? current : projectReferenceSelection;
      return {
        ...active,
        previewReference: candidate,
        templateContextId: projectTemplateContextId,
      };
    });
  }

  function handleUpdateProjectForm(field: keyof typeof projectForm, value: string) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function handleSelectTemplate(templateTitle: string) {
    handleUpdateProjectForm("templateTitle", templateTitle);
    const template = training.templates.find((item) => item.title === templateTitle);
    setSectionSeeds(template?.sections ?? []);
  }

  function handleCopySeedSection(section: LoraTrainingTemplateSeedSection) {
    setSectionSeeds((current) => {
      const copyNumber = nextSeedSectionCopyNumber(current, section.id);
      const copy = buildSeedSectionCopy(section, copyNumber);
      const sourceIndex = current.findIndex((item) => item.id === section.id);
      if (sourceIndex === -1) return [...current, copy];
      return [
        ...current.slice(0, sourceIndex + 1),
        copy,
        ...current.slice(sourceIndex + 1),
      ];
    });
  }

  function handleDeleteSeedSection(sectionId: string) {
    setSectionSeeds((current) => current.filter((section) => section.id !== sectionId));
  }

  function handleToggleSeedSection(sectionId: string) {
    setSectionSeeds((current) => current.map((section) => (
      section.id === sectionId ? { ...section, enabled: !section.enabled } : section
    )));
  }

  function handleAddProjectReference(candidate: ReferenceCandidate) {
    setSelectedReferenceIds((current) => new Set([...current, candidate.id]));
  }

  function handleUploadProjectReference() {
    projectReferenceUploadInputRef.current?.click();
  }

  function handleProjectReferenceFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;

    const nextUploads: ProjectReferenceUploadDraft[] = [];
    setProjectReferenceUploadState((current) => {
      const activeUploads = current.templateContextId === projectTemplateContextId ? current.uploads : [];
      const uploads = [...activeUploads];

      files.forEach((file) => {
        const duplicate = uploads.some((upload) => (
          upload.file.name === file.name
          && upload.file.size === file.size
          && upload.file.lastModified === file.lastModified
        ));
        if (duplicate) return;

        const id = `staged-upload-${Date.now()}-${uploads.length + 1}`;
        const nextUpload = {
          file,
          id,
          previewReference: buildProjectReferenceUploadPreview(file, id),
          title: file.name.replace(/\.[^.]+$/, "") || "本地上传图片",
        } satisfies ProjectReferenceUploadDraft;
        uploads.push(nextUpload);
        nextUploads.push(nextUpload);
      });

      return {
        templateContextId: projectTemplateContextId,
        uploads,
      };
    });

    if (nextUploads[0]) {
      handlePreviewProjectReference(nextUploads[0].previewReference);
      pushToast({
        tone: "success",
        title: "本地图片已加入候选",
        detail: nextUploads.length > 1 ? `${nextUploads.length} 张图片可加入新项目资料` : nextUploads[0].title,
      });
    } else {
      pushToast({
        tone: "warning",
        title: "没有新的本地图片加入候选",
        detail: "相同文件不会重复加入。",
      });
    }
    event.currentTarget.value = "";
  }

  async function uploadSelectedProjectReferenceDrafts(projectId: string) {
    const uploadedTitles: string[] = [];
    const failedTitles: string[] = [];

    for (const [index, upload] of selectedStagedProjectReferenceUploads.entries()) {
      const formData = new FormData();
      formData.append("file", upload.file);
      formData.append("role", "source");
      formData.append("sortOrder", String(index));

      try {
        const uploadResponse = await fetch(`/api/training/projects/${projectId}/character-images`, {
          method: "POST",
          body: formData,
        });
        const uploadPayload = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok || !uploadPayload?.ok || !uploadPayload?.data?.id) {
          failedTitles.push(upload.title);
          continue;
        }

        uploadedTitles.push(upload.title);
        await fetch(`/api/training/character-images/${uploadPayload.data.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: upload.title,
            note: "创建项目时本地上传的参考图",
            sortOrder: index,
          }),
        }).catch(() => null);
      } catch {
        failedTitles.push(upload.title);
      }
    }

    return {
      failedTitles,
      uploadedTitles,
    };
  }

  async function handleCreateProjectDraft() {
    const nextDraft = {
      autoFreezeDataset: trainingDefaults.autoFreezeDataset,
      autoGenerateSamples: trainingDefaults.autoGenerateSamples,
      baseModel: projectForm.baseModel,
      captionStrategy: projectForm.captionStrategy,
      detailPrompt: projectForm.detailPrompt,
      enabledSectionCount: sectionSeeds.filter((section) => section.enabled).length,
      perSectionImageCount: projectForm.perSectionImageCount,
      selectedReferenceCount: selectedProjectReferences.length,
      selectedReferenceTitles,
      sectionCount: sectionSeeds.length,
      templateTitle: projectForm.templateTitle,
      title: projectForm.title,
      trainingSteps: projectForm.trainingSteps,
      usagePrompt: projectForm.usagePrompt,
    };

    if (!isProductionTrainingRoute) {
      setCreatedProjectDraft(nextDraft);
      pushToast({
        tone: "success",
        title: createdProjectDraft ? "项目草稿已更新" : "训练项目草稿已创建",
        detail: projectForm.title,
      });
      return;
    }

    if (!sourceTemplate) {
      pushToast({
        tone: "error",
        title: "训练项目创建失败",
        detail: "请选择一个训练模板后再创建项目。",
      });
      return;
    }

    const checkpointAsset = availableCheckpointModels.find((model) => (
      model.modelType === "checkpoint"
      && (projectForm.baseModel === "继承训练默认模型" || model.name === projectForm.baseModel)
    ));

    if (!checkpointAsset) {
      pushToast({
        tone: "error",
        title: "训练项目创建失败",
        detail: "没有可用的 checkpoint 路径，请先选择基础模型。",
      });
      return;
    }

    if (isCreatingProject) return;

    setIsCreatingProject(true);
    try {
      const persistedSelectedReferenceIds = [...selectedReferenceIds].filter((referenceId) => !stagedProjectReferenceUploadIds.has(referenceId));
      const response = await fetch("/api/training/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: projectForm.title.trim(),
          characterName: projectForm.title.trim(),
          projectName: projectForm.title.trim(),
          triggerToken: buildTrainingProjectTriggerToken(projectForm.title),
          templateId: sourceTemplate.id,
          checkpointRelativePath: checkpointAsset.relativePath,
          baseModel: projectForm.baseModel,
          captionStrategy: projectForm.captionStrategy,
          usagePrompt: projectForm.usagePrompt,
          detailPrompt: projectForm.detailPrompt,
          perSectionImageCount: projectForm.perSectionImageCount,
          trainingSteps: projectForm.trainingSteps,
          selectedReferenceIds: persistedSelectedReferenceIds,
          sections: sectionSeeds,
          trainingDefaults: {
            autoGenerateSamples: trainingDefaults.autoGenerateSamples,
            autoFreezeDataset: trainingDefaults.autoFreezeDataset,
          },
          trainingTemplateId: sourceTemplate.id,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "训练项目创建失败",
          detail: payload?.error?.message ?? "训练项目创建请求失败",
        });
        return;
      }

        pushToast({
          tone: "success",
          title: "训练项目已创建",
          detail: projectForm.title,
        });

      if (selectedStagedProjectReferenceUploads.length > 0) {
        const stagedUploadResult = await uploadSelectedProjectReferenceDrafts(payload.data.id);
        if (stagedUploadResult.failedTitles.length > 0) {
          pushToast({
            tone: "warning",
            title: "训练项目已创建，部分参考图未上传",
            detail: stagedUploadResult.failedTitles.join("、"),
          });
        } else if (stagedUploadResult.uploadedTitles.length > 0) {
          pushToast({
            tone: "success",
            title: "本地参考图已同步到角色资料",
            detail: `${stagedUploadResult.uploadedTitles.length} 张`,
          });
        }
      }
      router.push(`/training/projects/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练项目创建失败",
        detail: error instanceof Error ? error.message : "训练项目创建请求失败",
      });
    } finally {
      setIsCreatingProject(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/projects", label: "返回训练项目" }}
        eyebrow="LoRA 训练"
        title="新建训练项目"
        subtitle="选择模板、填写角色资料，并创建初始小节。模板只作为创建时初始配置，创建后不会自动回写。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isCreatingProject}
            onClick={handleCreateProjectDraft}
          >
            {createdProjectDraft ? "更新项目草稿" : "创建项目"}
          </Button>
        )}
      />
      <div className={s.projectCreateWorkspace}>
        <div className={s.projectCreateMain}>
          <Panel title="项目基础信息" subtitle="沿用项目表单骨架，这里记录训练项目的初始配置。">
            <div className={s.formStack}>
              <Field label="项目名称" value={projectForm.title} onChange={(value) => handleUpdateProjectForm("title", value)} />
              <FloatingSelect label="从模板创建" value={projectForm.templateTitle} options={["不使用模板", ...training.templates.map((template) => template.title)]} onChange={handleSelectTemplate} />
              {sourceTemplate ? (
                <Field readOnly label="来源训练模板" value={`${sourceTemplate.title}${newProjectTemplateHints.sections ? ` · ${newProjectTemplateHints.sections} 个小节` : ""}`} />
              ) : null}
              <FloatingSelect label="基础模型" value={projectForm.baseModel} options={["继承训练默认模型", ...baseModelOptions]} onChange={(value) => handleUpdateProjectForm("baseModel", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色使用提示词" value={projectForm.usagePrompt} onChange={(value) => handleUpdateProjectForm("usagePrompt", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value={projectForm.detailPrompt} onChange={(value) => handleUpdateProjectForm("detailPrompt", value)} />
            </div>
          </Panel>
          <Panel
            title="参考资料"
            subtitle="先预览引用来源，再显式加入新项目资料。"
            actions={(
              <Button size="sm" icon={Upload} onClick={handleUploadProjectReference}>
                上传图片
              </Button>
            )}
          >
            <input
              ref={projectReferenceUploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={handleProjectReferenceFileChange}
            />
            <ReferencePicker
                referenceSourceTree={referenceSourceTree}
                previewReference={activePreviewReference}
                onPreviewReference={handlePreviewProjectReference}
                onAddReference={handleAddProjectReference}
                selectedReferenceIds={selectedReferenceIds}
              />
            </Panel>
        </div>
        <aside className={s.projectCreateAside}>
          <Panel title="初始小节" subtitle="模板小节只作为创建时初始小节，创建后独立管理。">
            <div className={s.sectionSeedList}>
              {sectionSeeds.length === 0 ? (
                <div className={s.emptyInline}>没有初始小节。选择一个训练模板后，会在这里生成可调整的小节种子。</div>
              ) : null}
              {sectionSeeds.map((section, index) => (
                <article className={s.sectionSeedCard} key={section.id}>
                  <div className={s.sectionSeedHeader}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.title}</strong>
                    <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
                  </div>
                  <p>{section.blockCount} 个场景块 · {section.scenePreview}</p>
                  <div className={s.sectionSeedActions}>
                    <Button size="sm" icon={Check} ariaLabel={section.enabled ? `停用初始小节：${section.title}` : `启用初始小节：${section.title}`} onClick={() => handleToggleSeedSection(section.id)} feedback={{ title: section.enabled ? "初始小节已停用" : "初始小节已启用", detail: section.title }}>{section.enabled ? "停用" : "启用"}</Button>
                    <Button size="sm" icon={Copy} ariaLabel={`复制初始小节：${section.title}`} onClick={() => handleCopySeedSection(section)} feedback={{ title: "初始小节已复制", detail: section.title }}>复制</Button>
                    <Button size="sm" tone="danger" icon={Trash2} ariaLabel={`删除初始小节：${section.title}`} onClick={() => handleDeleteSeedSection(section.id)} feedback={{ tone: "warning", title: "初始小节已移除", detail: section.title }}>删除</Button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="数据集与训练默认" subtitle="创建后用于首批图片生成、说明文本和训练任务草稿。">
            <div className={s.formStack}>
              <SwitchRow
                checked={trainingDefaults.autoGenerateSamples}
                onCheckedChange={(checked) => setTrainingDefaults((current) => ({ ...current, autoGenerateSamples: checked }))}
                title="创建后自动生成首批训练样本"
                subtitle="使用每个启用小节创建一轮训练集图片任务。"
              />
              <SwitchRow
                checked={trainingDefaults.autoFreezeDataset}
                onCheckedChange={(checked) => setTrainingDefaults((current) => ({ ...current, autoFreezeDataset: checked }))}
                title="说明文本完成后自动冻结数据集"
                subtitle="只冻结已保留图片；后续编辑不会回写冻结版本。"
              />
              <FloatingSelect label="说明文本策略" value={projectForm.captionStrategy} options={["先触发词后描述", "只补全缺失说明文本", "人工确认后写入"]} onChange={(value) => handleUpdateProjectForm("captionStrategy", value)} />
              <Field label="每小节初始图片数" value={projectForm.perSectionImageCount} onChange={(value) => handleUpdateProjectForm("perSectionImageCount", value)} />
              <Field label="训练步数草稿" value={projectForm.trainingSteps} onChange={(value) => handleUpdateProjectForm("trainingSteps", value)} />
            </div>
          </Panel>
          {createdProjectDraft ? (
            <Panel title="创建结果" subtitle="页面内已生成训练项目草稿，可继续调整后更新。">
              <dl className={s.createdProjectDraft}>
                <div><dt>项目</dt><dd>{createdProjectDraft.title}</dd></div>
                <div><dt>模板</dt><dd>{createdProjectDraft.templateTitle}</dd></div>
                <div><dt>基础模型</dt><dd>{createdProjectDraft.baseModel}</dd></div>
                <div><dt>参考资料</dt><dd>{createdProjectDraft.selectedReferenceCount} 个</dd></div>
                <div><dt>初始小节</dt><dd>{createdProjectDraft.enabledSectionCount} / {createdProjectDraft.sectionCount} 启用</dd></div>
                <div><dt>每小节图片</dt><dd>{createdProjectDraft.perSectionImageCount}</dd></div>
                <div><dt>训练步数</dt><dd>{createdProjectDraft.trainingSteps}</dd></div>
                <div><dt>说明文本策略</dt><dd>{createdProjectDraft.captionStrategy}</dd></div>
                <div><dt>自动生成样本</dt><dd>{createdProjectDraft.autoGenerateSamples ? "开启" : "关闭"}</dd></div>
                <div><dt>自动冻结数据集</dt><dd>{createdProjectDraft.autoFreezeDataset ? "开启" : "关闭"}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>已选资料</dt><dd>{createdProjectDraft.selectedReferenceTitles.join("、") || "未添加资料"}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>使用提示词</dt><dd>{createdProjectDraft.usagePrompt}</dd></div>
                <div className={s.createdProjectDraftWide}><dt>角色细节</dt><dd>{createdProjectDraft.detailPrompt}</dd></div>
              </dl>
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function LoraTrainingProjectDetailPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [projectArchiveState, setProjectArchiveState] = useState(() => ({
    archived: project?.status === "archived",
    projectId: project?.id ?? null,
  }));
  const [isUpdatingProjectArchive, setIsUpdatingProjectArchive] = useState(false);
  if (!project) return <EmptyPage title="没有训练项目数据" />;
  const sourceProject = project;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const isProjectArchived = projectArchiveState.projectId === sourceProject.id ? projectArchiveState.archived : sourceProject.status === "archived";
  const activeProject: LoraTrainingProject = isProjectArchived
    ? { ...sourceProject, status: "archived" }
    : sourceProject.status === "archived"
      ? { ...sourceProject, status: "ready" }
      : sourceProject;
  const recentRuns = training.runs.filter((run) => run.projectId === sourceProject.id).slice(0, 4);
  const recentResults = sourceProject.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 4);
  const latestRevision = sourceProject.datasetRevisions[0];

  async function handleToggleProjectArchive() {
    const currentArchived = projectArchiveState.projectId === sourceProject.id ? projectArchiveState.archived : sourceProject.status === "archived";
    const nextArchived = !currentArchived;

    const applyLocalArchiveState = () => {
      setProjectArchiveState({
        archived: nextArchived,
        projectId: sourceProject.id,
      });
    };

    if (!isProductionTrainingRoute) {
      applyLocalArchiveState();
      pushToast({
        tone: nextArchived ? "warning" : "success",
        title: nextArchived ? "训练项目已归档" : "训练项目已恢复",
        detail: sourceProject.title,
      });
      return;
    }

    if (isUpdatingProjectArchive) return;

    setIsUpdatingProjectArchive(true);
    try {
      const response = await fetch(`/api/training/projects/${sourceProject.id}/${currentArchived ? "restore" : "archive"}`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: currentArchived ? "恢复失败" : "归档失败",
          detail: payload?.error?.message ?? "训练项目状态更新请求失败",
        });
        return;
      }

      applyLocalArchiveState();
      pushToast({
        tone: nextArchived ? "warning" : "success",
        title: nextArchived ? "训练项目已归档" : "训练项目已恢复",
        detail: sourceProject.title,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: currentArchived ? "恢复失败" : "归档失败",
        detail: error instanceof Error ? error.message : "训练项目状态更新请求失败",
      });
    } finally {
      setIsUpdatingProjectArchive(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="overview"
        project={activeProject}
        subtitle={isProjectArchived ? `${sourceProject.profileSummary} · 已归档` : sourceProject.profileSummary}
        actions={(
          <Button
            tone={isProjectArchived ? "subtle" : "danger"}
            icon={Archive}
            pending={isUpdatingProjectArchive}
            onClick={handleToggleProjectArchive}
          >
            {isProjectArchived ? "恢复" : "归档"}
          </Button>
        )}
      />
      <div className={s.overviewGrid}>
        <Panel title="角色资料">
          <div className={s.stack}>
            <p className={s.bodyText}>{sourceProject.profileSummary}</p>
            <div className={s.heroStrip}>
              <ImageListSmall images={sourceProject.referenceImages.map((reference) => reference.image)} limit={sourceProject.referenceImages.length} />
            </div>
            <ButtonLink href={`/training/projects/${sourceProject.id}/profile`} icon={FileText} ariaLabel={`编辑训练项目资料：${sourceProject.title}`}>
              编辑资料
            </ButtonLink>
          </div>
        </Panel>
        <Panel title="训练入口" subtitle="总览只放启动判断，完整训练准备和冻结版本在数据集页处理。">
          <div className={s.readinessSummary}>
            <span><strong>{sourceProject.keptCount}</strong> 已保留</span>
            <span><strong>{sourceProject.captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{latestRevision?.version ?? sourceProject.datasetVersion}</strong> 当前版本</span>
          </div>
          <ButtonLink href={`/training/projects/${sourceProject.id}/dataset`} icon={Layers} tone="primary" ariaLabel={`打开训练项目数据集工作台：${sourceProject.title}`}>
            打开数据集工作台
          </ButtonLink>
        </Panel>
        <Panel title="最近任务">
          <RunRows project={sourceProject} runs={recentRuns} />
        </Panel>
        <Panel title="最近产物" subtitle="只展示最近保留结果，完整审查在结果池。">
          <TrainingResultGrid results={recentResults} title="最近产物" />
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingProjectProfilePage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const referenceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const project = findProject(data, projectId);
  const [referenceImageState, setLocalReferenceImages] = useState(() => ({
    images: project?.referenceImages ?? [],
    projectId: project?.id ?? null,
  }));
  const [profileFormState, setProfileForm] = useState(() => ({
    detailPrompt: project?.detailPrompt ?? "",
    profileSummary: project?.profileSummary ?? "",
    projectId: project?.id ?? null,
    usagePrompt: project?.usagePrompt ?? "",
  }));
  const [profileDraft, setProfileDraft] = useState<{
    detailPrompt: string;
    profileSummary: string;
    projectId: string;
    referenceImageCount: number;
    usagePrompt: string;
  } | null>(null);
  const [referenceResultState, setReferenceResultState] = useState(() => ({
    addedReferenceResultIds: new Set<string>(),
    projectId: project?.id ?? null,
  }));
  const [referenceResultRequestState, setReferenceResultRequestState] = useState(() => ({
    pendingReferenceIds: new Set<string>(),
    projectId: project?.id ?? null,
  }));
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingReferenceImage, setIsUploadingReferenceImage] = useState(false);
  if (!project) return <EmptyPage title="没有角色资料数据" />;
  const activeProject = project;
  const localReferenceImages = referenceImageState.projectId === activeProject.id ? referenceImageState.images : activeProject.referenceImages;
  const profileForm = profileFormState.projectId === activeProject.id ? profileFormState : {
    detailPrompt: activeProject.detailPrompt,
    profileSummary: activeProject.profileSummary,
    projectId: activeProject.id,
    usagePrompt: activeProject.usagePrompt,
  };
  const visibleProfileDraft = profileDraft?.projectId === activeProject.id ? profileDraft : null;
  const isProductionTrainingRoute = pathname === "/training" || pathname.startsWith("/training/");
  const addedReferenceResultIds = referenceResultState.projectId === activeProject.id ? referenceResultState.addedReferenceResultIds : new Set<string>();
  const pendingReferenceIds = referenceResultRequestState.projectId === activeProject.id ? referenceResultRequestState.pendingReferenceIds : new Set<string>();

  async function handleSaveProfile() {
    const nextDraft = {
      detailPrompt: profileForm.detailPrompt,
      profileSummary: profileForm.profileSummary,
      projectId: activeProject.id,
      referenceImageCount: localReferenceImages.length,
      usagePrompt: profileForm.usagePrompt,
    };

    if (!isProductionTrainingRoute) {
      setProfileDraft(nextDraft);
      pushToast({ tone: "success", title: visibleProfileDraft ? "资料保存草稿已更新" : "资料保存草稿已记录", detail: activeProject.title });
      return;
    }

    if (isSavingProfile) return;

    setIsSavingProfile(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          loraUsagePrompt: profileForm.usagePrompt,
          characterDetailPrompt: profileForm.detailPrompt,
          profileSummary: profileForm.profileSummary,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "资料保存失败",
          detail: payload?.error?.message ?? "训练资料保存请求失败",
        });
        return;
      }

      setProfileDraft(nextDraft);
      pushToast({
        tone: "success",
        title: visibleProfileDraft ? "资料已更新" : "资料已保存",
        detail: activeProject.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "资料保存失败",
        detail: error instanceof Error ? error.message : "训练资料保存请求失败",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleUpdateProfileForm(field: "detailPrompt" | "profileSummary" | "usagePrompt", value: string) {
    setProfileForm((current) => {
      const active = current.projectId === activeProject.id ? current : {
        detailPrompt: activeProject.detailPrompt,
        profileSummary: activeProject.profileSummary,
        projectId: activeProject.id,
        usagePrompt: activeProject.usagePrompt,
      };
      return {
        ...active,
        [field]: value,
        projectId: activeProject.id,
      };
    });
  }

  function handleUploadReferenceImage() {
    if (isProductionTrainingRoute) {
      referenceUploadInputRef.current?.click();
      return;
    }

    setLocalReferenceImages((current) => {
      const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
      const draftIndex = currentImages.length + 1;
      const image = activeProject.images[currentImages.length % activeProject.images.length] ?? currentImages[0]?.image;
      if (!image) return { images: currentImages, projectId: activeProject.id };
      return {
        images: [
          ...currentImages,
          {
            id: `${activeProject.id}-uploaded-reference-${draftIndex}`,
            image,
            kind: "auxiliary",
            label: `上传参考图 ${draftIndex}`,
            note: "页面内本地上传草稿，可继续作为角色辅助参考图管理。",
          },
        ],
        projectId: activeProject.id,
      };
    });
  }

  async function handleReferenceImageFileChange() {
    const input = referenceUploadInputRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    if (isUploadingReferenceImage) return;

    setIsUploadingReferenceImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", "source");
      formData.append("sortOrder", String(localReferenceImages.length));
      formData.append("provenance", JSON.stringify({ origin: "training_profile_upload" }));

      const response = await fetch(`/api/training/projects/${activeProject.id}/character-images`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id || !payload?.data?.relativePath) {
        pushToast({
          tone: "error",
          title: "参考图上传失败",
          detail: payload?.error?.message ?? "参考图上传请求失败",
        });
        return;
      }

      const nextIndex = localReferenceImages.length;
      const uploadedReference = buildUploadedReferenceImage({
        id: payload.data.id,
        index: nextIndex,
        label: payload.data.provenance?.originalName ?? `参考图 ${nextIndex + 1}`,
        note: typeof payload.data.role === "string" ? payload.data.role : "source",
        relativePath: payload.data.relativePath,
      });

      if (!uploadedReference) {
        pushToast({
          tone: "error",
          title: "参考图上传失败",
          detail: "上传成功，但无法解析参考图地址。",
        });
        return;
      }

      setLocalReferenceImages((current) => {
        const currentImages = current.projectId === activeProject.id ? current.images : activeProject.referenceImages;
        return {
          images: [...currentImages, uploadedReference],
          projectId: activeProject.id,
        };
      });
      pushToast({
        tone: "success",
        title: "参考图已上传",
        detail: uploadedReference.label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "参考图上传失败",
        detail: error instanceof Error ? error.message : "参考图上传请求失败",
      });
    } finally {
      if (input) {
        input.value = "";
      }
      setIsUploadingReferenceImage(false);
    }
  }

  async function handleAddReferenceImageToResults(referenceId: string, label: string) {
    const applyLocalAddedState = () => {
      setReferenceResultState((current) => ({
        addedReferenceResultIds: new Set([
          ...(current.projectId === activeProject.id ? current.addedReferenceResultIds : new Set<string>()),
          referenceId,
        ]),
        projectId: activeProject.id,
      }));
    };

    if (addedReferenceResultIds.has(referenceId) || pendingReferenceIds.has(referenceId)) {
      return;
    }

    if (!isProductionTrainingRoute) {
      applyLocalAddedState();
      pushToast({
        tone: "success",
        title: "参考图已加入结果池",
        detail: label,
      });
      return;
    }

    setReferenceResultRequestState((current) => ({
      pendingReferenceIds: new Set([
        ...(current.projectId === activeProject.id ? current.pendingReferenceIds : new Set<string>()),
        referenceId,
      ]),
      projectId: activeProject.id,
    }));
    try {
      const response = await fetch(`/api/training/character-images/${referenceId}/add-to-results`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "pending",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "加入结果池失败",
          detail: payload?.error?.message ?? "参考图入池请求失败",
        });
        return;
      }

      applyLocalAddedState();
      pushToast({
        tone: "success",
        title: "参考图已加入结果池",
        detail: label,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "加入结果池失败",
        detail: error instanceof Error ? error.message : "参考图入池请求失败",
      });
    } finally {
      setReferenceResultRequestState((current) => {
        const nextPending = new Set(current.projectId === activeProject.id ? current.pendingReferenceIds : new Set<string>());
        nextPending.delete(referenceId);
        return {
          pendingReferenceIds: nextPending,
          projectId: activeProject.id,
        };
      });
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="profile"
        project={activeProject}
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isSavingProfile}
            onClick={handleSaveProfile}
          >
            {visibleProfileDraft ? "更新资料" : "保存资料"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="角色文本">
          <div className={s.formStack}>
            <Field multiline features={{ resize: true, clipboard: true }} label="LoRA 使用提示词" value={profileForm.usagePrompt} onChange={(value) => handleUpdateProfileForm("usagePrompt", value)} />
            <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value={profileForm.detailPrompt} onChange={(value) => handleUpdateProfileForm("detailPrompt", value)} />
            <Field multiline features={{ resize: true, clipboard: true }} label="资料备注" value={profileForm.profileSummary} onChange={(value) => handleUpdateProfileForm("profileSummary", value)} />
          </div>
        </Panel>
        <Panel title="参考图" subtitle="original / generated / auxiliary 都作为自由参考图管理，不做 fixed slots。">
          <div className={s.stack}>
            <div className={s.referenceImageGrid}>
              {localReferenceImages.map((reference) => (
                <article className={s.referenceImageCard} key={reference.id}>
                  <ImagePreviewFrame image={reference.image} />
                  <div>
                    <span>{referenceKindLabel(reference.kind)}</span>
                    <strong>{reference.label}</strong>
                    <p>{reference.note}</p>
                    {addedReferenceResultIds.has(reference.id) ? <StatusBadge status="pending" label="已加入结果池" /> : null}
                    <Button
                      size="sm"
                      tone="subtle"
                      pending={pendingReferenceIds.has(reference.id)}
                      disabled={addedReferenceResultIds.has(reference.id)}
                      onClick={() => handleAddReferenceImageToResults(reference.id, reference.label)}
                    >
                      {addedReferenceResultIds.has(reference.id) ? "已加入结果池" : "加入结果池"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            <input
              ref={referenceUploadInputRef}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleReferenceImageFileChange}
            />
            <Button icon={ImagePlus} pending={isUploadingReferenceImage} onClick={handleUploadReferenceImage}>上传参考图</Button>
          </div>
        </Panel>
      </div>
      {visibleProfileDraft ? (
        <Panel title="资料保存草稿" subtitle="页面内已记录当前资料状态，可继续调整后再创建训练任务。">
          <dl className={s.profileDraft}>
            <div><dt>使用提示词</dt><dd>{visibleProfileDraft.usagePrompt}</dd></div>
            <div><dt>角色细节</dt><dd>{visibleProfileDraft.detailPrompt}</dd></div>
            <div><dt>资料备注</dt><dd>{visibleProfileDraft.profileSummary}</dd></div>
            <div><dt>参考图</dt><dd>{visibleProfileDraft.referenceImageCount} 张</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}

function SectionCard({
  index,
  onCopy,
  onDelete,
  project,
  section,
}: {
  index: number;
  onCopy?: (section: LoraTrainingSection) => void;
  onDelete?: (sectionId: string) => void;
  project: LoraTrainingProject;
  section: LoraTrainingSection;
}) {
  const hrefForRoute = useRouteHref();
  const { ref, style, handleProps } = useDemoSortable(section.id);

  return (
    <div ref={ref} style={style}>
      <article className={s.sectionCard}>
        <button
          type="button"
          className={s.dragHandle}
          aria-label={`拖拽排序小节：${section.title}`}
          {...handleProps}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <div className={s.sectionCardMain}>
          <div className={s.sectionCardHeader}>
            <Link href={hrefForRoute(`/training/projects/${project.id}/sections/${section.id}`)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{section.title}</strong>
            </Link>
            <div className={s.sectionHeaderActions}>
              <Button
                icon={Copy}
                iconOnly
                size="sm"
                tone="subtle"
                ariaLabel={`复制小节：${section.title}`}
                onClick={() => onCopy?.(section)}
                feedback={{ title: "小节已复制", detail: section.title }}
              />
              <Button
                icon={Trash2}
                iconOnly
                size="sm"
                tone="danger"
                ariaLabel={`删除小节：${section.title}`}
                onClick={() => onDelete?.(section.id)}
                feedback={{ tone: "warning", title: "小节已从项目草稿移除", detail: section.title }}
              />
            </div>
          </div>
            <Link
              aria-label={`打开第 ${index + 1} 个训练小节最近结果：${section.title}`}
              className={s.sectionImages}
              href={hrefForRoute(`/training/projects/${project.id}/sections/${section.id}`)}
            >
              <ImageListSmall images={section.images} limit={4} showCounts wide />
            </Link>
            <div className={s.sectionActions}>
              <span>更新 {section.updatedAt} · {section.blocks.length} 个场景块 · {section.enabled ? "已启用" : "已停用"}</span>
              <ButtonLink
                href={`/training/projects/${project.id}/sections/${section.id}/generation-tasks/new`}
                icon={ImagePlus}
                size="sm"
                ariaLabel={`生成小节样本：${section.title}`}
            >
              生成样本
            </ButtonLink>
          </div>
        </div>
      </article>
    </div>
  );
}

export function LoraTrainingProjectSectionsPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const project = findProject(data, projectId);
  const [localSectionState, setLocalSections] = useState(() => ({
    projectId: project?.id ?? null,
    sections: project?.sections ?? [],
  }));
  const [orderedSectionState, setOrderedSectionIds] = useState(() => ({
    ids: project?.sections.map((section) => section.id) ?? [],
    projectId: project?.id ?? null,
  }));
  const [isMutatingSections, setIsMutatingSections] = useState(false);
  if (!project) return <EmptyPage title="没有训练小节数据" />;
  const localSections = localSectionState.projectId === project.id ? localSectionState.sections : project.sections;
  const orderedSectionIds = orderedSectionState.projectId === project.id ? orderedSectionState.ids : project.sections.map((section) => section.id);
  const activeProject = project;
  const sectionMap = new Map(localSections.map((section) => [section.id, section]));
  const sections = orderedSectionIds
    .map((sectionId) => sectionMap.get(sectionId))
    .filter((section): section is LoraTrainingSection => Boolean(section));
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  async function handleCopySection(section: LoraTrainingSection) {
    const copyNumber = nextProjectSectionCopyNumber(localSections, section.id);
    const copyId = `${section.id}-copy-${copyNumber}`;
    const copy: LoraTrainingSection = {
      ...section,
      id: copyId,
      title: `${section.title} (副本)`,
      updatedAt: "刚刚",
    };
    const currentSections = localSections;
    const sourceIndex = currentSections.findIndex((item) => item.id === section.id);
    const nextSections = sourceIndex === -1
      ? [...currentSections, copy]
      : [
        ...currentSections.slice(0, sourceIndex + 1),
        copy,
        ...currentSections.slice(sourceIndex + 1),
      ];
    const currentIds = orderedSectionIds;
    const sourceOrderIndex = currentIds.indexOf(section.id);
    const nextIds = sourceOrderIndex === -1
      ? [...currentIds, copyId]
      : [
        ...currentIds.slice(0, sourceOrderIndex + 1),
        copyId,
        ...currentIds.slice(sourceOrderIndex + 1),
      ];

    setLocalSections({ projectId: activeProject.id, sections: nextSections });
    setOrderedSectionIds({ ids: nextIds, projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;
    if (isMutatingSections) return;

    setIsMutatingSections(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceSectionId: section.id,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "复制小节失败",
          detail: payload?.error?.message ?? "训练小节复制请求失败",
        });
        setLocalSections({ projectId: activeProject.id, sections: localSections });
        setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
        return;
      }
      const savedCopy = payload.data as LoraTrainingSection;
      const savedSections = sourceIndex === -1
        ? [...localSections, savedCopy]
        : [
          ...localSections.slice(0, sourceIndex + 1),
          savedCopy,
          ...localSections.slice(sourceIndex + 1),
        ];
      const savedIds = sourceOrderIndex === -1
        ? [...orderedSectionIds, savedCopy.id]
        : [
          ...orderedSectionIds.slice(0, sourceOrderIndex + 1),
          savedCopy.id,
          ...orderedSectionIds.slice(sourceOrderIndex + 1),
        ];
      setLocalSections({ projectId: activeProject.id, sections: savedSections });
      setOrderedSectionIds({ ids: savedIds, projectId: activeProject.id });
      pushToast({
        tone: "success",
        title: "小节已复制",
        detail: section.title,
      });
    } catch (error) {
      setLocalSections({ projectId: activeProject.id, sections: localSections });
      setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
      pushToast({
        tone: "error",
        title: "复制小节失败",
        detail: error instanceof Error ? error.message : "训练小节复制请求失败",
      });
    } finally {
      setIsMutatingSections(false);
    }
  }

  async function handleDeleteSection(sectionId: string) {
    const nextSections = localSections.filter((section) => section.id !== sectionId);
    const nextIds = orderedSectionIds.filter((id) => id !== sectionId);
    setLocalSections({ projectId: activeProject.id, sections: nextSections });
    setOrderedSectionIds({ ids: nextIds, projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;
    if (isMutatingSections) return;

    setIsMutatingSections(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections/${sectionId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "删除小节失败",
          detail: payload?.error?.message ?? "训练小节删除请求失败",
        });
        setLocalSections({ projectId: activeProject.id, sections: localSections });
        setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
        return;
      }
      pushToast({
        tone: "warning",
        title: "小节已移除",
        detail: sectionId,
      });
    } catch (error) {
      setLocalSections({ projectId: activeProject.id, sections: localSections });
      setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
      pushToast({
        tone: "error",
        title: "删除小节失败",
        detail: error instanceof Error ? error.message : "训练小节删除请求失败",
      });
    } finally {
      setIsMutatingSections(false);
    }
  }

  async function handleReorderSections(nextSectionIds: string[]) {
    setOrderedSectionIds({ ids: nextSectionIds, projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;
    if (isMutatingSections) return;

    const previousIds = orderedSectionIds;
    setIsMutatingSections(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections/reorder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderedSectionIds: nextSectionIds,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
        pushToast({
          tone: "error",
          title: "排序小节失败",
          detail: payload?.error?.message ?? "训练小节排序请求失败",
        });
        setOrderedSectionIds({ ids: previousIds, projectId: activeProject.id });
        return;
      }
      const savedSections = payload.data as LoraTrainingSection[];
      setLocalSections({ projectId: activeProject.id, sections: savedSections });
      setOrderedSectionIds({ ids: savedSections.map((section) => section.id), projectId: activeProject.id });
    } catch (error) {
      setOrderedSectionIds({ ids: previousIds, projectId: activeProject.id });
      pushToast({
        tone: "error",
        title: "排序小节失败",
        detail: error instanceof Error ? error.message : "训练小节排序请求失败",
      });
    } finally {
      setIsMutatingSections(false);
    }
  }

  async function handleAddSection() {
    const source = localSections[0];
    const draftNumber = nextProjectSectionDraftNumber(localSections);
    const draftId = `new-section-${draftNumber}`;
    const draftIndex = localSections.length + 1;
    const draft: LoraTrainingSection = source ? {
      ...source,
      id: draftId,
      title: `新小节 ${draftIndex}`,
      updatedAt: "刚刚",
      images: [],
      resultStatus: "pending",
    } : {
      id: draftId,
      title: `新小节 ${draftIndex}`,
      enabled: true,
      updatedAt: "刚刚",
      blocks: [
        { id: "draft-local-block", source: "本地", title: "本地场景描述", text: "补充这个小节的训练场景描述。" },
      ],
      resolvedScene: "补充这个小节的训练场景描述。",
      imagePrompt: "生成干净、可训练的角色样本。",
      images: [],
      resultStatus: "pending",
    };
    setLocalSections({ projectId: activeProject.id, sections: [...localSections, draft] });
    setOrderedSectionIds({ ids: [...orderedSectionIds, draft.id], projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;
    if (isMutatingSections) return;

    setIsMutatingSections(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "新建小节失败",
          detail: payload?.error?.message ?? "训练小节创建请求失败",
        });
        setLocalSections({ projectId: activeProject.id, sections: localSections });
        setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
        return;
      }
      const savedSection = payload.data as LoraTrainingSection;
      setLocalSections({ projectId: activeProject.id, sections: [...localSections, savedSection] });
      setOrderedSectionIds({ ids: [...orderedSectionIds, savedSection.id], projectId: activeProject.id });
      pushToast({
        tone: "success",
        title: "小节草稿已添加",
        detail: savedSection.title,
      });
    } catch (error) {
      setLocalSections({ projectId: activeProject.id, sections: localSections });
      setOrderedSectionIds({ ids: orderedSectionIds, projectId: activeProject.id });
      pushToast({
        tone: "error",
        title: "新建小节失败",
        detail: error instanceof Error ? error.message : "训练小节创建请求失败",
      });
    } finally {
      setIsMutatingSections(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        actions={<Button icon={Plus} tone="primary" onClick={handleAddSection} feedback={{ title: "小节草稿已添加", detail: `新小节 ${sections.length + 1}` }}>新建小节</Button>}
      />
      <TrainingSectionWorkspace activeSectionId={sections[0]?.id} project={project} sections={sections}>
        <div className={s.sectionGrid}>
          <SortableList items={orderedSectionIds} onReorder={handleReorderSections}>
            {orderedSectionIds.map((sectionId, index) => {
              const section = sectionMap.get(sectionId);
              if (!section) return null;

              return (
                <SectionCard
                  index={index}
                  key={section.id}
                  onCopy={handleCopySection}
                  onDelete={handleDeleteSection}
                  project={project}
                  section={section}
                />
              );
            })}
          </SortableList>
        </div>
      </TrainingSectionWorkspace>
    </div>
  );
}

export function LoraTrainingProjectSectionDetailPage({ data, projectId, sectionId }: { data: TrainingAppData; projectId?: string; sectionId?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingDemoData(data);
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  const [sectionSceneBlocksByKey, setSectionSceneBlocksByKey] = useState<Record<string, LoraTrainingSectionBlock[]>>(() => (
    project && section ? { [buildProjectSectionStateKey(project.id, section.id)]: section.blocks } : {}
  ));
  const [sectionResultsByProjectKey, setSectionResultsByProjectKey] = useState<Record<string, LoraTrainingImageResult[]>>(() => (
    project ? { [project.id]: project.resultPool } : {}
  ));
  const [editingSceneBlockState, setEditingSceneBlockState] = useState(() => ({
    blockId: null as string | null,
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
  }));
  const [presetImportOpen, setPresetImportOpen] = useState(false);
  const [selectedTrainingPresetId, setSelectedTrainingPresetId] = useState<string | null>(null);
  const [sectionDraftsByKey, setSectionDraftsByKey] = useState<Record<string, ProjectSectionDraftState>>({});
  const [isReviewingSectionResult, setIsReviewingSectionResult] = useState(false);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [isMutatingSceneBlocks, setIsMutatingSceneBlocks] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  if (!project || !section) return <EmptyPage title="没有训练小节详情" />;

  const activeProject = project;
  const activeSection = section;
  const projectSectionStateKey = buildProjectSectionStateKey(activeProject.id, activeSection.id);
  const sceneBlocks = sectionSceneBlocksByKey[projectSectionStateKey] ?? activeSection.blocks;
  const sectionResults = (sectionResultsByProjectKey[activeProject.id] ?? activeProject.resultPool)
    .filter((result) => result.sectionId === activeSection.id);
  const visibleSectionDraft = sectionDraftsByKey[projectSectionStateKey] ?? null;
  const visibleEditingSceneBlockId = editingSceneBlockState.projectId === activeProject.id && editingSceneBlockState.sectionId === activeSection.id ? editingSceneBlockState.blockId : null;
  const selectedTrainingPreset = training.presets.find((preset) => preset.id === selectedTrainingPresetId) ?? null;
  const scenePreview = sceneBlocks.map((block) => block.text).join("\n\n");

  function setEditingSceneBlockId(blockId: string | null) {
    setEditingSceneBlockState({
      blockId,
      projectId: activeProject.id,
      sectionId: activeSection.id,
    });
  }

  function updateSceneBlocks(updater: (current: LoraTrainingSectionBlock[]) => LoraTrainingSectionBlock[]) {
    setSectionSceneBlocksByKey((current) => ({
      ...current,
      [projectSectionStateKey]: updater(current[projectSectionStateKey] ?? activeSection.blocks),
    }));
  }

  function replaceSceneBlocks(blocks: LoraTrainingSectionBlock[]) {
    setSectionSceneBlocksByKey((current) => ({
      ...current,
      [projectSectionStateKey]: blocks,
    }));
  }

  function handleAddLocalSceneBlock() {
    const nextBlock = {
      source: "本地" as const,
      title: `本地补充块 ${nextSceneBlockOrdinal(sceneBlocks, `${activeSection.id}-local-block-`)}`,
      text: "补充这一小节的造型、动作或画面约束。",
    };

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => {
        const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-local-block-`);
        return [
          ...current,
          {
            id: `${activeSection.id}-local-block-${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      return;
    }

    if (isMutatingSceneBlocks) return;

    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "场景块创建失败",
            detail: payload?.error?.message ?? "场景块创建请求失败",
          });
          return;
        }
        replaceSceneBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "场景块创建失败",
          detail: error instanceof Error ? error.message : "场景块创建请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleImportPresetBlock(preset: LoraTrainingPreset | null) {
    if (!preset) return;
    const nextBlock = {
      source: "预制" as const,
      title: preset.title,
      text: preset.sceneDescriptionText,
    };

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => {
        const prefix = `${activeSection.id}-preset-block-${preset.id}-`;
        const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-preset-block-${preset.id}-`);
        return [
          ...current,
          {
            id: `${prefix}${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      setPresetImportOpen(false);
      return;
    }

    if (isMutatingSceneBlocks) return;

    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "场景块创建失败",
            detail: payload?.error?.message ?? "场景块创建请求失败",
          });
          return;
        }
        replaceSceneBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
        setPresetImportOpen(false);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "场景块创建失败",
          detail: error instanceof Error ? error.message : "场景块创建请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleMoveSceneBlock(index: number, direction: -1 | 1) {
    const reorderedBlocks = moveSceneBlock(sceneBlocks, index, direction);

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => moveSceneBlock(current, index, direction));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    replaceSceneBlocks(reorderedBlocks);
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks/reorder?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ids: reorderedBlocks.map((block) => block.id),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块排序失败",
            detail: payload?.error?.message ?? "场景块排序请求失败",
          });
          return;
        }
        replaceSceneBlocks(payload.data as LoraTrainingSectionBlock[]);
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块排序失败",
          detail: error instanceof Error ? error.message : "场景块排序请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleUpdateSceneBlock(blockId: string, patch: SceneBlockPatch) {
    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    const nextBlocks = sceneBlocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block));
    replaceSceneBlocks(nextBlocks);
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/blocks/${blockId}?projectId=${activeProject.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块保存失败",
            detail: payload?.error?.message ?? "场景块保存请求失败",
          });
          return;
        }
        replaceSceneBlocks(nextBlocks.map((block) => block.id === blockId ? payload.data as LoraTrainingSectionBlock : block));
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块保存失败",
          detail: error instanceof Error ? error.message : "场景块保存请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleDeleteSceneBlock(blockId: string) {
    if (!isProductionTrainingRoute) {
      if (visibleEditingSceneBlockId === blockId) setEditingSceneBlockId(null);
      updateSceneBlocks((current) => current.filter((block) => block.id !== blockId));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    if (visibleEditingSceneBlockId === blockId) setEditingSceneBlockId(null);
    replaceSceneBlocks(sceneBlocks.filter((block) => block.id !== blockId));
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/blocks/${blockId}?projectId=${activeProject.id}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块删除失败",
            detail: payload?.error?.message ?? "场景块删除请求失败",
          });
          return;
        }
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块删除失败",
          detail: error instanceof Error ? error.message : "场景块删除请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  async function handleReviewSectionResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    const reviewedResult = sectionResults.find((result) => result.id === resultId);

    const applyLocalReview = () => {
      setSectionResultsByProjectKey((current) => ({
        ...current,
        [activeProject.id]: (current[activeProject.id] ?? activeProject.resultPool).map((result) =>
          result.id === resultId ? { ...result, reviewStatus } : result,
        ),
      }));
    };

    if (!isProductionTrainingRoute) {
      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? activeSection.title,
      });
      return;
    }

    if (isReviewingSectionResult) return;

    setIsReviewingSectionResult(true);
    try {
      const response = await fetch(`/api/training/image-results/${resultId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: toTrainingImageReviewApiStatus(reviewStatus),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "结果审核失败",
          detail: payload?.error?.message ?? "训练结果审核请求失败",
        });
        return;
      }

      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? activeSection.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "结果审核失败",
        detail: error instanceof Error ? error.message : "训练结果审核请求失败",
      });
    } finally {
      setIsReviewingSectionResult(false);
    }
  }

  async function handleSaveSection() {
    const nextDraft = {
      blockCount: sceneBlocks.length,
      firstBlock: sceneBlocks[0]?.title ?? "无场景块",
      imagePrompt: activeSection.imagePrompt,
      projectId: activeProject.id,
      projectTitle: activeProject.title,
      scenePreview: scenePreview || activeSection.resolvedScene,
      sectionId: activeSection.id,
      sectionTitle: activeSection.title,
    };

    if (!isProductionTrainingRoute) {
      setSectionDraftsByKey((current) => ({
        ...current,
        [projectSectionStateKey]: nextDraft,
      }));
      pushToast({
        tone: "success",
        title: visibleSectionDraft ? "小节保存草稿已更新" : "小节保存草稿已记录",
        detail: activeSection.title,
      });
      return;
    }

    if (isSavingSection) return;

    setIsSavingSection(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections/${activeSection.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: activeSection.title,
          enabled: activeSection.enabled,
          blocks: sceneBlocks,
          resolvedScene: scenePreview || activeSection.resolvedScene,
          imagePrompt: activeSection.imagePrompt,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "小节保存失败",
          detail: payload?.error?.message ?? "训练小节保存请求失败",
        });
        return;
      }

      setSectionDraftsByKey((current) => ({
        ...current,
        [projectSectionStateKey]: nextDraft,
      }));
      pushToast({
        tone: "success",
        title: "训练小节已保存",
        detail: activeSection.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "小节保存失败",
        detail: error instanceof Error ? error.message : "训练小节保存请求失败",
      });
    } finally {
      setIsSavingSection(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${project.title} / ${section.title}`}
        actions={(
          <Button
            icon={Save}
            pending={isSavingSection}
            onClick={handleSaveSection}
          >
            {visibleSectionDraft ? "更新小节草稿" : "保存小节"}
          </Button>
        )}
      />
      <TrainingSectionWorkspace activeSectionId={section.id} project={project}>
        <div className={s.twoCol}>
          <Panel
            title="场景块"
            subtitle="预制块和本地块按合成顺序生效，可单独编辑、排序或删除。"
            actions={(
              <>
                <Button
                  size="sm"
                  icon={CopyPlus}
                  onClick={() => setPresetImportOpen(!presetImportOpen)}
                  feedback={{ title: presetImportOpen ? "预制选择已收起" : "预制选择已打开", detail: section.title }}
                >
                  {presetImportOpen ? "收起预制" : "选择预制"}
                </Button>
                <Button
                  size="sm"
                  icon={Check}
                  disabled={!selectedTrainingPreset}
                  onClick={() => handleImportPresetBlock(selectedTrainingPreset)}
                  feedback={{ title: "预制已导入场景块", detail: selectedTrainingPreset?.title ?? section.title }}
                >
                  导入所选
                </Button>
                <Button size="sm" icon={Plus} onClick={handleAddLocalSceneBlock} feedback={{ title: "本地块已添加", detail: section.title }}>添加本地块</Button>
              </>
            )}
          >
            {presetImportOpen ? (
              <div className={s.trainingPresetImportPanel} aria-label="训练预制候选">
                <div className={s.trainingPresetImportHeader}>
                  <strong>选择要导入的小节预制</strong>
                  <span>{selectedTrainingPreset ? `已选择 ${selectedTrainingPreset.title}` : "先选择一个预制，再导入为场景块"}</span>
                </div>
                <div className={s.trainingPresetImportGrid}>
                  {training.presets.map((preset) => {
                    const isSelected = selectedTrainingPresetId === preset.id;
                    return (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        className={cx(s.trainingPresetImportItem, isSelected && s.trainingPresetImportItemSelected)}
                        key={preset.id}
                        onClick={() => setSelectedTrainingPresetId(preset.id)}
                      >
                        <span className={s.trainingPresetImportItemTop}>
                          <strong>{preset.title}</strong>
                          <em>{preset.category} / {preset.folder}</em>
                        </span>
                        <span className={s.trainingPresetImportStatus}>{preset.status === "active" ? "启用" : "停用"}</span>
                        <p>{preset.sceneDescriptionText}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className={s.sceneBlockList}>
              {sceneBlocks.map((block, index) => (
                <SceneBlockCard
                  block={block}
                  index={index}
                  isEditing={visibleEditingSceneBlockId === block.id}
                  key={block.id}
                  onDelete={handleDeleteSceneBlock}
                  onEdit={setEditingSceneBlockId}
                  onMove={handleMoveSceneBlock}
                  onUpdate={handleUpdateSceneBlock}
                  total={sceneBlocks.length}
                />
              ))}
            </div>
          </Panel>
          <Panel title="合成预览">
            <div className={s.formStack}>
              <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={scenePreview || section.resolvedScene} />
              <Field readOnly multiline features={{ clipboard: true }} label="图片提示词" value={section.imagePrompt} />
            </div>
          </Panel>
        </div>
        {visibleSectionDraft ? (
          <Panel title="小节保存草稿" subtitle="页面内记录当前场景块、合成场景和图片提示词。">
            <dl className={s.sectionDraftGrid}>
              <div><dt>项目</dt><dd>{visibleSectionDraft.projectTitle}</dd></div>
              <div><dt>小节</dt><dd>{visibleSectionDraft.sectionTitle}</dd></div>
              <div><dt>场景块</dt><dd>{visibleSectionDraft.blockCount} 个 · {visibleSectionDraft.firstBlock}</dd></div>
              <div><dt>图片提示词</dt><dd>{visibleSectionDraft.imagePrompt}</dd></div>
              <div><dt>合成场景</dt><dd>{visibleSectionDraft.scenePreview}</dd></div>
            </dl>
          </Panel>
        ) : null}
        <div id="section-results">
          <Panel title="小节结果">
            <TrainingResultGrid
              onReviewStatusChange={handleReviewSectionResult}
              results={sectionResults}
              title={`${section.title} 结果`}
            />
          </Panel>
        </div>
      </TrainingSectionWorkspace>
    </div>
  );
}

export function LoraTrainingGenerationComposePage({ data, projectId, sectionId }: { data: TrainingAppData; projectId?: string; sectionId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const supplementalImageInputRef = useRef<HTMLInputElement | null>(null);
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  const referenceSourceTree: ReferenceSourceGroup[] = project && section ? [
    {
      id: "profile",
      title: "角色资料",
      description: "文本源",
      items: [
        { id: "profile-usage", title: "使用提示词", detail: project.usagePrompt, meta: "默认选入" },
        { id: "profile-detail", title: "角色细节", detail: project.detailPrompt, meta: "默认选入" },
      ],
    },
    {
      id: "section",
      title: "小节场景",
      description: "当前小节",
      items: [
        { id: "section-scene", title: section.title, detail: section.resolvedScene, meta: "合成场景" },
        { id: "section-prompt", title: "图片提示词", detail: section.imagePrompt, meta: "生成提示词" },
      ],
    },
    {
      id: "references",
      title: "参考图",
      description: "自由候选",
      items: project.referenceImages.map((reference) => ({
        id: reference.id,
        title: reference.label,
        detail: reference.note,
        image: reference.image,
        meta: referenceKindLabel(reference.kind),
      })),
    },
    {
      id: "result-pool",
      title: "结果池",
      description: "最近产物",
      items: project.resultPool.slice(0, 4).map((result) => ({
        id: result.id,
        title: result.sourceLabel,
        detail: result.caption,
        image: result.image,
        meta: reviewStatusLabel(result.reviewStatus),
      })),
    },
  ] : [];
  const [referenceSelectionState, setReferenceSelectionState] = useState(() => ({
    previewReference: referenceSourceTree[0]?.items[0] ?? null,
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
    selectedReferenceIds: new Set<string>(),
  }));
  const [generationFormState, setGenerationForm] = useState(() => ({
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
    supplementalPrompt: DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT,
    taskType: "训练集图片生成",
  }));
  const [generationTaskDraftTransportState, setGenerationTaskDraftTransportState] = useState(() => ({
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
    taskId: null as string | null,
  }));
  const [supplementalImageAttachmentState, setSupplementalImageAttachments] = useState(() => ({
    attachments: [] as SupplementalImageAttachment[],
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
  }));
  const [generationTaskDraft, setGenerationTaskDraft] = useState<{
    finalInput: string;
    projectId: string;
    selectedReferenceTitles: string[];
    sectionId: string;
    sectionTitle: string;
    supplementalImageCount: number;
    supplementalImageTitles: string[];
    supplementalPrompt: string;
      taskType: string;
  } | null>(null);
  const [isQueueingGenerationTask, setIsQueueingGenerationTask] = useState(false);
  const [isUploadingSupplementalImage, setIsUploadingSupplementalImage] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  if (!project || !section) return <EmptyPage title="没有生成任务上下文" />;
  const activeProject = project;
  const activeSection = section;
  const referenceSelection = referenceSelectionState.projectId === activeProject.id && referenceSelectionState.sectionId === activeSection.id ? referenceSelectionState : {
    previewReference: referenceSourceTree[0]?.items[0] ?? null,
    projectId: activeProject.id,
    sectionId: activeSection.id,
    selectedReferenceIds: new Set<string>(),
  };
  const activePreviewReference = referenceSelection.previewReference ?? referenceSourceTree[0]?.items[0] ?? null;
  const selectedReferenceIds = referenceSelection.selectedReferenceIds;
  const generationForm = generationFormState.projectId === activeProject.id && generationFormState.sectionId === activeSection.id ? generationFormState : {
    projectId: activeProject.id,
    sectionId: activeSection.id,
    supplementalPrompt: DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT,
    taskType: "训练集图片生成",
  };
  const draftTaskId = generationTaskDraftTransportState.projectId === activeProject.id && generationTaskDraftTransportState.sectionId === activeSection.id
    ? generationTaskDraftTransportState.taskId
    : null;
  const supplementalImageAttachments = supplementalImageAttachmentState.projectId === activeProject.id && supplementalImageAttachmentState.sectionId === activeSection.id
    ? supplementalImageAttachmentState.attachments
    : [];
  const supplementalImageCandidates: SupplementalImageAttachment[] = [
    ...activeProject.referenceImages.slice(0, 3).map((reference) => ({
      detail: reference.note,
      id: `reference-${reference.id}`,
      image: reference.image,
      source: referenceKindLabel(reference.kind),
      title: reference.label,
    })),
    ...activeProject.resultPool.slice(0, 3).map((result) => ({
      detail: result.caption,
      id: `result-${result.id}`,
      image: result.image,
      source: reviewStatusLabel(result.reviewStatus),
      title: result.sourceLabel,
    })),
  ];
  const visibleGenerationTaskDraft = generationTaskDraft?.projectId === activeProject.id && generationTaskDraft.sectionId === activeSection.id ? generationTaskDraft : null;
  const sectionTitle = activeSection.title;
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const selectedReferenceTitles = selectedReferences.map((reference) => reference.title);
  const selectedReferenceDetails = selectedReferences
    .map((reference) => `- ${reference.title}: ${reference.detail}`)
    .join("\n");
  const supplementalImageDetails = supplementalImageAttachments
    .map((attachment) => `- ${attachment.title}: ${attachment.detail}`)
    .join("\n");
  const finalInputText = [
    activeProject.usagePrompt,
    activeSection.resolvedScene,
    selectedReferenceDetails ? `显式引用\n${selectedReferenceDetails}` : "",
    supplementalImageDetails ? `补充图片附件\n${supplementalImageDetails}` : "",
    generationForm.supplementalPrompt,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  function handleUpdateGenerationForm(field: "supplementalPrompt" | "taskType", value: string) {
    setGenerationForm((current) => {
      const active = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current : generationForm;
      return {
        ...active,
        [field]: value,
        projectId: activeProject.id,
        sectionId: activeSection.id,
      };
    });
  }

  async function ensureGenerationDraftTaskId() {
    if (draftTaskId) {
      const patchResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplementalPrompt: generationForm.supplementalPrompt,
          taskType: generationForm.taskType,
        }),
      });
      const patchPayload = await patchResponse.json().catch(() => null);
      if (!patchResponse.ok || !patchPayload?.ok) {
        throw new Error(patchPayload?.error?.message ?? "生成任务草稿更新失败");
      }
      return draftTaskId;
    }

    const createDraftResponse = await fetch(`/api/training/projects/${activeProject.id}/generation-tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sectionId: activeSection.id,
        supplementalPrompt: generationForm.supplementalPrompt,
        taskType: generationForm.taskType,
      }),
    });
    const createDraftPayload = await createDraftResponse.json().catch(() => null);

    if (!createDraftResponse.ok || !createDraftPayload?.ok || !createDraftPayload?.data?.id) {
      throw new Error(createDraftPayload?.error?.message ?? "生成任务草稿创建失败");
    }

    const nextTaskId = createDraftPayload.data.id as string;
    setGenerationTaskDraftTransportState({
      projectId: activeProject.id,
      sectionId: activeSection.id,
      taskId: nextTaskId,
    });
    return nextTaskId;
  }

  function handlePreviewTaskReference(candidate: ReferenceCandidate) {
    setReferenceSelectionState((current) => {
      const selectedReferenceIds = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current.selectedReferenceIds : new Set<string>();
      return {
        previewReference: candidate,
        projectId: activeProject.id,
        sectionId: activeSection.id,
        selectedReferenceIds,
      };
    });
  }

  function handleAddTaskReference(candidate: ReferenceCandidate) {
    setReferenceSelectionState((current) => {
      const selectedReferenceIds = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current.selectedReferenceIds : new Set<string>();
      return {
        previewReference: candidate,
        projectId: activeProject.id,
        sectionId: activeSection.id,
        selectedReferenceIds: new Set([...selectedReferenceIds, candidate.id]),
      };
    });
  }

  function handleAddSupplementalImage(candidate: SupplementalImageAttachment) {
    setSupplementalImageAttachments((current) => {
      const activeAttachments = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current.attachments : [];
      if (activeAttachments.some((attachment) => attachment.id === candidate.id)) {
        return {
          attachments: activeAttachments,
          projectId: activeProject.id,
          sectionId: activeSection.id,
        };
      }
      return {
        attachments: [...activeAttachments, candidate],
        projectId: activeProject.id,
        sectionId: activeSection.id,
      };
    });
  }

  function handleRemoveSupplementalImage(attachmentId: string) {
    setSupplementalImageAttachments((current) => ({
      attachments: current.projectId === activeProject.id && current.sectionId === activeSection.id
        ? current.attachments.filter((attachment) => attachment.id !== attachmentId)
        : [],
      projectId: activeProject.id,
      sectionId: activeSection.id,
    }));
  }

  function handleUploadSupplementalImage() {
    supplementalImageInputRef.current?.click();
  }

  async function handleSupplementalImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (isUploadingSupplementalImage) return;

    if (!isProductionTrainingRoute) {
      const previewImage = activeProject.referenceImages[0]?.image ?? activeProject.resultPool[0]?.image ?? activeProject.images[0];
      if (previewImage) {
        setSupplementalImageAttachments((current) => {
          const activeAttachments = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current.attachments : [];
          return {
            attachments: [
              ...activeAttachments,
              {
                detail: "页面内本地上传草稿，可继续作为补充图片使用。",
                id: `uploaded-supplemental-${Date.now()}`,
                image: previewImage,
                source: "上传",
                title: file.name.replace(/\.[^.]+$/, "") || "补充图片",
              },
            ],
            projectId: activeProject.id,
            sectionId: activeSection.id,
          };
        });
      }
      event.currentTarget.value = "";
      return;
    }

    setIsUploadingSupplementalImage(true);
    try {
      const ensuredDraftTaskId = await ensureGenerationDraftTaskId();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, "") || "补充图片");
      formData.append("detail", "上传补充图片");

      const response = await fetch(`/api/training/generation-tasks/${ensuredDraftTaskId}/supplemental-images`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id || !payload?.data?.relativePath) {
        pushToast({
          tone: "error",
          title: "补充图片上传失败",
          detail: payload?.error?.message ?? "补充图片上传请求失败",
        });
        return;
      }

      const uploadedAttachment = buildUploadedSupplementalImage({
        detail: payload.data.detail ?? "上传补充图片",
        id: payload.data.id,
        relativePath: payload.data.relativePath,
        title: payload.data.title ?? (file.name.replace(/\.[^.]+$/, "") || "补充图片"),
      });

      if (!uploadedAttachment) {
        pushToast({
          tone: "error",
          title: "补充图片上传失败",
          detail: "上传成功，但无法解析补充图片地址。",
        });
        return;
      }

      setSupplementalImageAttachments((current) => {
        const activeAttachments = current.projectId === activeProject.id && current.sectionId === activeSection.id ? current.attachments : [];
        return {
          attachments: [...activeAttachments, uploadedAttachment],
          projectId: activeProject.id,
          sectionId: activeSection.id,
        };
      });
      pushToast({
        tone: "success",
        title: "补充图片已上传",
        detail: uploadedAttachment.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "补充图片上传失败",
        detail: error instanceof Error ? error.message : "补充图片上传请求失败",
      });
    } finally {
      setIsUploadingSupplementalImage(false);
      event.currentTarget.value = "";
    }
  }

  async function handleQueueGenerationTask() {
    const nextDraft = {
      finalInput: finalInputText,
      projectId: activeProject.id,
      selectedReferenceTitles,
      sectionId: activeSection.id,
      sectionTitle,
      supplementalImageCount: supplementalImageAttachments.length,
      supplementalImageTitles: supplementalImageAttachments.map((attachment) => attachment.title),
      supplementalPrompt: generationForm.supplementalPrompt,
      taskType: generationForm.taskType,
    };

    if (!isProductionTrainingRoute) {
      setGenerationTaskDraft(nextDraft);
      pushToast({
        tone: "success",
        title: visibleGenerationTaskDraft ? "生成任务草稿已更新" : "生成任务草稿已排队",
        detail: activeSection.title,
      });
      return;
    }

    if (isQueueingGenerationTask) return;
    const explicitReferenceIds = [...new Set([...selectedReferenceIds].map(normalizeGenerationDraftReferenceId))];
    const supplementalDraftReferenceIds = [...new Set(
      supplementalImageAttachments
        .filter((attachment) => attachment.source !== "上传")
        .map((attachment) => normalizeGenerationDraftReferenceId(attachment.id)),
    )];

    setIsQueueingGenerationTask(true);
    try {
        const draftTaskId = await ensureGenerationDraftTaskId();

          for (const referenceId of explicitReferenceIds) {
            const inputResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/inputs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceId,
            role: "reference",
          }),
        });
        const inputPayload = await inputResponse.json().catch(() => null);
        if (!inputResponse.ok || !inputPayload?.ok) {
          pushToast({
            tone: "error",
            title: "生成任务创建失败",
            detail: inputPayload?.error?.message ?? "生成任务引用写入失败",
          });
          return;
        }
      }

      for (const referenceId of supplementalDraftReferenceIds) {
        const inputResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/inputs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            referenceId,
            role: "supplemental_image",
          }),
        });
        const inputPayload = await inputResponse.json().catch(() => null);
        if (!inputResponse.ok || !inputPayload?.ok) {
          pushToast({
            tone: "error",
            title: "生成任务创建失败",
            detail: inputPayload?.error?.message ?? "补充图片写入失败",
          });
          return;
        }
      }

      const previewResponse = await fetch(`/api/training/generation-tasks/${draftTaskId}/preview`, {
        method: "POST",
      });
      const previewPayload = await previewResponse.json().catch(() => null);
      if (!previewResponse.ok || !previewPayload?.ok || typeof previewPayload?.data?.finalInput !== "string") {
        pushToast({
          tone: "error",
          title: "生成任务创建失败",
          detail: previewPayload?.error?.message ?? "生成任务预览请求失败",
        });
        return;
      }

      const response = await fetch(`/api/training/generation-tasks/${draftTaskId}/run`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "生成任务创建失败",
          detail: payload?.error?.message ?? "生成任务执行请求失败",
        });
        return;
      }

      setGenerationTaskDraft(nextDraft);
      setGenerationTaskDraft({
        ...nextDraft,
        finalInput: previewPayload.data.finalInput,
      });
      setGenerationTaskDraftTransportState({
        projectId: activeProject.id,
        sectionId: activeSection.id,
        taskId: null,
      });
      pushToast({
        tone: "success",
        title: "生成任务已创建",
        detail: activeSection.title,
      });
      router.push(`/training/runs/generation/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "生成任务创建失败",
        detail: error instanceof Error ? error.message : "生成任务创建请求失败",
      });
    } finally {
      setIsQueueingGenerationTask(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${section.title} / 新建生成任务`}
        subtitle="显式选择引用，补充提示词和图片附件，预览最终输入后再运行。"
        actions={(
          <Button
            tone="primary"
            icon={Play}
            pending={isQueueingGenerationTask}
            onClick={handleQueueGenerationTask}
          >
            {visibleGenerationTaskDraft ? "更新任务草稿" : "运行生成"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="引用源">
          <ReferencePicker
            referenceSourceTree={referenceSourceTree}
            previewReference={activePreviewReference}
            onPreviewReference={handlePreviewTaskReference}
            onAddReference={handleAddTaskReference}
            selectedReferenceIds={selectedReferenceIds}
          />
        </Panel>
        <Panel title="任务内容">
          <div className={s.formStack}>
            <FloatingSelect label="任务类型" value={generationForm.taskType} options={["训练集图片生成", "角色描述生成", "说明文本补全"]} onChange={(value) => handleUpdateGenerationForm("taskType", value)} />
            <Field multiline features={{ resize: true, clipboard: true }} label="补充提示词" value={generationForm.supplementalPrompt} onChange={(value) => handleUpdateGenerationForm("supplementalPrompt", value)} />
            <section className={s.supplementalImageBlock} aria-label="补充图片附件">
              <div className={s.supplementalImageHeader}>
                <div>
                  <strong>补充图片附件</strong>
                  <span>{supplementalImageAttachments.length ? `${supplementalImageAttachments.length} 张已附加` : "点击下方参考图或结果池图片附加"}</span>
                </div>
                <Button size="sm" icon={Upload} pending={isUploadingSupplementalImage} onClick={handleUploadSupplementalImage}>上传图片</Button>
              </div>
              <input
                ref={supplementalImageInputRef}
                hidden
                accept="image/png,image/jpeg,image/webp"
                type="file"
                onChange={handleSupplementalImageFileChange}
              />
              <div className={s.supplementalImageCandidateList}>
                {supplementalImageCandidates.map((candidate) => {
                  const alreadyAttached = supplementalImageAttachments.some((attachment) => attachment.id === candidate.id);
                  return (
                    <button
                      className={cx(s.supplementalImageCandidate, alreadyAttached && s.supplementalImageCandidateAttached)}
                      disabled={alreadyAttached}
                      key={candidate.id}
                      type="button"
                      onClick={() => handleAddSupplementalImage(candidate)}
                    >
                      <ImagePreviewFrame image={candidate.image} />
                      <span>
                        <strong>{candidate.title}</strong>
                        <em>{alreadyAttached ? "已附加" : candidate.source}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className={s.supplementalImageList}>
                {supplementalImageAttachments.length ? supplementalImageAttachments.map((attachment) => (
                  <article className={s.supplementalImageAttachment} key={attachment.id}>
                    <ImagePreviewFrame image={attachment.image} />
                    <span>
                      <strong>{attachment.title}</strong>
                      <small>{attachment.source} · {attachment.detail}</small>
                    </span>
                    <Button
                      size="sm"
                      tone="danger"
                      icon={Trash2}
                      onClick={() => handleRemoveSupplementalImage(attachment.id)}
                      feedback={{ tone: "warning", title: "已移除补充图片", detail: attachment.title }}
                    >
                      移除
                    </Button>
                  </article>
                )) : (
                  <p>还没有补充图片，最终输入会先使用资料、小节场景和已选引用。</p>
                )}
              </div>
            </section>
            <Field readOnly multiline features={{ clipboard: true }} label="最终输入预览" value={finalInputText} />
          </div>
        </Panel>
      </div>
      {visibleGenerationTaskDraft ? (
        <Panel title="生成任务草稿" subtitle="页面内已记录本次生成请求，可继续调整引用和最终输入后更新。">
          <dl className={s.generationTaskDraft}>
            <div><dt>任务类型</dt><dd>{visibleGenerationTaskDraft.taskType}</dd></div>
            <div><dt>小节</dt><dd>{visibleGenerationTaskDraft.sectionTitle}</dd></div>
            <div><dt>已选引用</dt><dd>{visibleGenerationTaskDraft.selectedReferenceTitles.join("、") || "未添加引用"}</dd></div>
            <div><dt>补充图片</dt><dd>{visibleGenerationTaskDraft.supplementalImageCount ? `${visibleGenerationTaskDraft.supplementalImageCount} 张 · ${visibleGenerationTaskDraft.supplementalImageTitles.join("、")}` : "未附加图片"}</dd></div>
            <div><dt>补充提示词</dt><dd>{visibleGenerationTaskDraft.supplementalPrompt || "未填写"}</dd></div>
            <div><dt>最终输入</dt><dd>{visibleGenerationTaskDraft.finalInput.split("\n")[0]}</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}

export function LoraTrainingProjectResultsPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const project = findProject(data, projectId);
  const [resultInteractionState, setResultInteractionState] = useState(() => ({
    filter: "all" as TrainingResultFilter,
    projectId: project?.id ?? null,
    selectedResultIds: new Set<string>(),
  }));
  const [resultState, setLocalResults] = useState(() => ({
    projectId: project?.id ?? null,
    results: project?.resultPool ?? [],
  }));
  const [isReviewingResults, setIsReviewingResults] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const localResults = resultState.projectId === project?.id ? resultState.results : project?.resultPool ?? [];
  if (!project) return <EmptyPage title="没有训练结果池数据" />;
  const activeProject = project;
  const resultInteraction = resultInteractionState.projectId === activeProject.id ? resultInteractionState : {
    filter: "all" as TrainingResultFilter,
    projectId: activeProject.id,
    selectedResultIds: new Set<string>(),
  };
  const filter = resultInteraction.filter;
  const selectedResultIds = resultInteraction.selectedResultIds;
  const results = filter === "all" ? localResults : localResults.filter((result) => result.reviewStatus === filter);
  const visibleResultIds = new Set(results.map((result) => result.id));
  const selectedVisibleResultIds = new Set([...selectedResultIds].filter((resultId) => visibleResultIds.has(resultId)));
  const selectedVisibleCount = selectedVisibleResultIds.size;
  const allVisibleResultsSelected = results.length > 0 && selectedVisibleCount === results.length;

  function updateLocalResults(updater: (current: LoraTrainingImageResult[]) => LoraTrainingImageResult[]) {
    setLocalResults((current) => ({
      projectId: activeProject.id,
      results: updater(current.projectId === activeProject.id ? current.results : activeProject.resultPool),
    }));
  }

  function updateResultInteraction(updater: (current: typeof resultInteraction) => typeof resultInteraction) {
    setResultInteractionState((current) => {
      const active = current.projectId === activeProject.id ? current : {
        filter: "all" as TrainingResultFilter,
        projectId: activeProject.id,
        selectedResultIds: new Set<string>(),
      };
      return {
        ...updater(active),
        projectId: activeProject.id,
      };
    });
  }

  function updateResultSelection(updater: (current: Set<string>) => Set<string>) {
    updateResultInteraction((current) => ({
      ...current,
      selectedResultIds: updater(current.selectedResultIds),
    }));
  }

  function handleResultFilterChange(nextFilter: TrainingResultFilter) {
    updateResultInteraction((current) => ({
      ...current,
      filter: nextFilter,
    }));
  }

  function applyReviewedResults(reviewIds: Set<string>, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    updateLocalResults((current) => current.map((result) =>
      reviewIds.has(result.id) ? { ...result, reviewStatus } : result,
    ));
    updateResultSelection((current) => new Set([...current].filter((resultId) => !reviewIds.has(resultId))));
  }

  async function persistReviewedResults(resultIds: string[], reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    if (!resultIds.length) return;

    const reviewedResults = localResults.filter((result) => resultIds.includes(result.id));
    const reviewedResultTitles = reviewedResults.map((result) => result.sourceLabel);

    if (!isProductionTrainingRoute) {
      applyReviewedResults(new Set(resultIds), reviewStatus);
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: resultIds.length === 1 ? (reviewedResultTitles[0] ?? activeProject.title) : `${resultIds.length} 张训练结果`,
      });
      return;
    }

    if (isReviewingResults) return;

    setIsReviewingResults(true);
    const completedIds = new Set<string>();
    try {
      for (const resultId of resultIds) {
        const response = await fetch(`/api/training/image-results/${resultId}/review`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reviewStatus: toTrainingImageReviewApiStatus(reviewStatus),
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          if (completedIds.size > 0) {
            applyReviewedResults(completedIds, reviewStatus);
          }
          pushToast({
            tone: "error",
            title: "结果审核失败",
            detail: payload?.error?.message ?? "训练结果审核请求失败",
          });
          return;
        }

        completedIds.add(resultId);
      }

      applyReviewedResults(completedIds, reviewStatus);
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: completedIds.size === 1 ? (reviewedResultTitles[0] ?? activeProject.title) : `${completedIds.size} 张训练结果`,
      });
    } catch (error) {
      if (completedIds.size > 0) {
        applyReviewedResults(completedIds, reviewStatus);
      }
      pushToast({
        tone: "error",
        title: "结果审核失败",
        detail: error instanceof Error ? error.message : "训练结果审核请求失败",
      });
    } finally {
      setIsReviewingResults(false);
    }
  }

  function handleReviewResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    void persistReviewedResults([resultId], reviewStatus);
  }

  function toggleResultSelection(resultId: string) {
    updateResultSelection((current) => {
      const next = new Set(current);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }

  function toggleVisibleResultSelection() {
    updateResultSelection((current) => {
      if (allVisibleResultsSelected) {
        const next = new Set(current);
        results.forEach((result) => next.delete(result.id));
        return next;
      }
      return new Set([...current, ...visibleResultIds]);
    });
  }

  function handleBatchReviewResults(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    void persistReviewedResults([...selectedVisibleResultIds], reviewStatus);
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="results"
        project={project}
        actions={<Button icon={Check} onClick={toggleVisibleResultSelection} disabled={results.length === 0}>{allVisibleResultsSelected ? "取消全选当前" : "全选当前"}</Button>}
      />
      <Panel title="结果池" subtitle="待审、已保留和已拒绝的图片都在项目级结果池审查，说明文本摘要随图片一起处理。">
        <div className={s.stack}>
          <SegmentedControl
            ariaLabel="筛选训练结果"
            role="tablist"
            items={RESULT_FILTER_ITEMS.map((item) => ({ ...item, count: item.value === "all" ? localResults.length : localResults.filter((result) => result.reviewStatus === item.value).length }))}
            value={filter}
            onChange={handleResultFilterChange}
          />
          {selectedVisibleCount > 0 ? (
            <SelectionBatchBar
              selectedCount={selectedVisibleCount}
              subject="张训练结果"
              onClear={() => updateResultSelection(() => new Set())}
              actions={(
                <>
                  <Button icon={Check} tone="primary" onClick={() => handleBatchReviewResults("kept")}>
                    批量保留
                  </Button>
                  <Button icon={Trash2} tone="danger" onClick={() => handleBatchReviewResults("rejected")}>
                    批量拒绝
                  </Button>
                </>
              )}
            />
          ) : null}
          <TrainingResultGrid
            onReviewStatusChange={handleReviewResult}
            onToggleSelected={toggleResultSelection}
            results={results}
            selectedIds={selectedResultIds}
            title="结果池"
          />
        </div>
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectDatasetPage({ data, projectId }: { data: TrainingAppData; projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const hrefForRoute = useRouteHref();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [datasetResultState, setDatasetResultState] = useState<{
    hasOverride: boolean;
    projectId: string | null;
    results: LoraTrainingImageResult[] | null;
  }>(() => ({
    hasOverride: false,
    projectId: project?.id ?? null,
    results: null,
  }));
  const [datasetRevisionState, setDatasetRevisionState] = useState<{
    datasetVersion: string | null;
    hasOverride: boolean;
    projectId: string | null;
    revisions: LoraTrainingProject["datasetRevisions"] | null;
  }>(() => ({
    datasetVersion: null,
    hasOverride: false,
    projectId: project?.id ?? null,
    revisions: null,
  }));
  const [trainingDraftState, setTrainingDraft] = useState<{
    draft: {
      captionMissingCount: number;
      keptCount: number;
      stepCount: number;
      version: string;
    } | null;
    projectId: string | null;
  }>(() => ({
    draft: null,
    projectId: project?.id ?? null,
  }));
  const [isGeneratingDatasetCaptions, setIsGeneratingDatasetCaptions] = useState(false);
  const [isFreezingDataset, setIsFreezingDataset] = useState(false);
  const [isStartingTraining, setIsStartingTraining] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  if (!project) return <EmptyPage title="没有训练数据集数据" />;
  const activeProject = project;
  const hasDatasetResultOverride = datasetResultState.projectId === activeProject.id && datasetResultState.hasOverride;
  const resultPool = hasDatasetResultOverride ? (datasetResultState.results ?? activeProject.resultPool) : activeProject.resultPool;
  const keptResults = resultPool.filter((result) => result.reviewStatus === "kept");
  const keptCount = hasDatasetResultOverride ? keptResults.length : activeProject.keptCount;
  const captionMissingCount = hasDatasetResultOverride
    ? keptResults.filter((result) => captionMissing(result.caption)).length
    : activeProject.captionMissingCount;
  const hasDatasetRevisionOverride = datasetRevisionState.projectId === activeProject.id && datasetRevisionState.hasOverride;
  const datasetVersion = hasDatasetRevisionOverride ? (datasetRevisionState.datasetVersion ?? activeProject.datasetVersion) : activeProject.datasetVersion;
  const datasetRevisions = hasDatasetRevisionOverride ? (datasetRevisionState.revisions ?? activeProject.datasetRevisions) : activeProject.datasetRevisions;
  const trainingDraft = trainingDraftState.projectId === activeProject.id ? trainingDraftState.draft : null;
  const latestRevision = datasetRevisions[0] ?? null;
  const activeTrainingRuns = training.runs.filter((run) =>
    run.kind === "training"
    && run.projectId === activeProject.id
    && (run.status === "queued" || run.status === "running"));
  const activeTrainingRun = activeTrainingRuns[0] ?? null;
  const hasActiveTrainingRun = activeTrainingRuns.length > 0;
  const startTrainingBlockedReason = hasActiveTrainingRun
    ? `同一训练项目不能同时存在多个进行中训练任务。当前任务：${activeTrainingRun?.title ?? "训练中"}`
    : keptCount === 0
      ? "至少保留 1 张训练图片后才能启动训练。"
      : captionMissingCount > 0
        ? `还有 ${captionMissingCount} 张保留图片缺少说明文本，请先补齐。`
        : null;
  const startTrainingActionLabel = hasActiveTrainingRun
    ? "训练进行中"
    : startTrainingBlockedReason
      ? "准备数据集"
      : trainingDraft
        ? "更新训练草稿"
        : "启动训练";

  async function handleGenerateDatasetCaptions() {
    if (isGeneratingDatasetCaptions || captionMissingCount === 0) return;

    if (!isProductionTrainingRoute) {
      const nextResults = resultPool.map((result) => {
        if (result.reviewStatus !== "kept" || !captionMissing(result.caption)) return result;
        return {
          ...result,
          caption: deriveDatasetCaption(result),
        };
      });
      setDatasetResultState({
        hasOverride: true,
        projectId: activeProject.id,
        results: nextResults,
      });
      pushToast({
        tone: "success",
        title: "说明文本已批量生成",
        detail: `${captionMissingCount} 张图片已补全`,
      });
      return;
    }

    setIsGeneratingDatasetCaptions(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/captions/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "kept_without_captions",
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "批量生成说明文本失败",
          detail: payload?.error?.message ?? "说明文本批量生成请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: "说明文本已批量生成",
        detail: typeof payload?.data?.taskCount === "number" ? `${payload.data.taskCount} 张图片已补全` : activeProject.title,
      });
      setDatasetResultState({
        hasOverride: false,
        projectId: activeProject.id,
        results: null,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "批量生成说明文本失败",
        detail: error instanceof Error ? error.message : "说明文本批量生成请求失败",
      });
    } finally {
      setIsGeneratingDatasetCaptions(false);
    }
  }

  async function handleFreezeDatasetRevision() {
    if (isFreezingDataset) return;
    const nextVersion = nextDatasetVersionLabel(datasetVersion);

    if (!isProductionTrainingRoute) {
      const nextRevision = buildLocalDatasetRevision(activeProject.id, resultPool, nextVersion);
      setDatasetRevisionState({
        datasetVersion: nextVersion,
        hasOverride: true,
        projectId: activeProject.id,
        revisions: [nextRevision, ...datasetRevisions],
      });
      pushToast({
        tone: "success",
        title: "数据集版本已冻结",
        detail: nextVersion,
      });
      return;
    }

    setIsFreezingDataset(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/dataset-revisions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "冻结数据集失败",
          detail: payload?.error?.message ?? "数据集冻结请求失败",
        });
        return;
      }

      pushToast({
        tone: "success",
        title: "数据集版本已冻结",
        detail: nextVersion,
      });
      setDatasetRevisionState({
        datasetVersion: null,
        hasOverride: false,
        projectId: activeProject.id,
        revisions: null,
      });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "冻结数据集失败",
        detail: error instanceof Error ? error.message : "数据集冻结请求失败",
      });
    } finally {
      setIsFreezingDataset(false);
    }
  }

  async function handleOpenTrainingDraft() {
    if (startTrainingBlockedReason) {
      pushToast({
        tone: "warning",
        title: hasActiveTrainingRun ? "训练任务已在进行中" : "请先准备数据集",
        detail: startTrainingBlockedReason,
      });
      return;
    }

    const nextDraft = {
      draft: {
        captionMissingCount,
        keptCount,
        stepCount: 2400,
        version: datasetVersion,
      },
      projectId: activeProject.id,
    };

    if (!isProductionTrainingRoute) {
      setTrainingDraft(nextDraft);
      pushToast({
        tone: "success",
        title: trainingDraft ? "训练配置草稿已更新" : "训练配置草稿已打开",
        detail: datasetVersion,
      });
      return;
    }

    if (isStartingTraining) return;

    setIsStartingTraining(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/training-runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          revisionId: latestRevision?.id,
          config: {
            overrides: {
              ordinary: {
                targetSteps: nextDraft.draft.stepCount,
              },
            },
          },
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: "训练任务创建失败",
          detail: payload?.error?.message ?? "训练任务创建请求失败",
        });
        return;
      }

      setTrainingDraft(nextDraft);
      pushToast({
        tone: "success",
        title: "训练任务已创建",
        detail: datasetVersion,
      });
      router.push(`/training/runs/training/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练任务创建失败",
        detail: error instanceof Error ? error.message : "训练任务创建请求失败",
      });
    } finally {
      setIsStartingTraining(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="dataset"
        project={activeProject}
        actions={(
          <>
            <Button
              icon={Snowflake}
              disabled={keptCount === 0}
              pending={isFreezingDataset}
              onClick={handleFreezeDatasetRevision}
            >
              冻结当前版本
            </Button>
            <Button
              tone="primary"
              icon={Play}
              disabled={Boolean(startTrainingBlockedReason) || isStartingTraining}
              pending={!startTrainingBlockedReason && isStartingTraining}
              onClick={handleOpenTrainingDraft}
            >
              {startTrainingActionLabel}
            </Button>
          </>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="训练准备" subtitle="只有已保留图片进入冻结版本，后续编辑不会回写已冻结版本。">
          <div className={s.readinessSummary}>
            <span><strong>{keptCount}</strong> 已保留图片</span>
            <span><strong>{captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{datasetVersion}</strong> 当前版本</span>
          </div>
          <p className={s.bodyText}>准备信息保持在训练入口附近，完整样本与冻结快照继续由下方草稿和版本列表承载。</p>
          {startTrainingBlockedReason ? <p className={s.bodyText}>{startTrainingBlockedReason}</p> : null}
        </Panel>
        <Panel title="冻结版本">
          <div className={s.entityRowsSurface}>
            <div className={s.entityRows}>
              {datasetRevisions.map((revision) => (
                <Link className={s.entityRow} href={hrefForRoute(`/training/projects/${activeProject.id}/dataset/revisions/${revision.id}`)} key={revision.id}>
                  <div>
                    <strong>{revision.version}</strong>
                    <span>{revision.itemCount} 张 · 缺说明文本 {revision.captionMissingCount} · {revision.manifestName}</span>
                  </div>
                  <StatusBadge status={revision.status} label={revision.status === "ready" ? "可训练" : revision.status === "draft" ? "草稿" : "训练中"} />
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>
      {trainingDraft ? (
        <Panel title="训练配置草稿" subtitle="基于当前数据集版本生成，可继续调整结果池和数据集后更新。">
          <dl className={s.trainingDraft}>
            <div><dt>数据集版本</dt><dd>{trainingDraft.version}</dd></div>
            <div><dt>已保留图片</dt><dd>{trainingDraft.keptCount} 张</dd></div>
            <div><dt>缺说明文本</dt><dd>{trainingDraft.captionMissingCount}</dd></div>
            <div><dt>训练步数</dt><dd>{trainingDraft.stepCount}</dd></div>
          </dl>
        </Panel>
      ) : null}
      <Panel
        title="已保留草稿"
        actions={(
          <Button
            icon={FileText}
            disabled={captionMissingCount === 0}
            pending={isGeneratingDatasetCaptions}
            onClick={handleGenerateDatasetCaptions}
          >
            批量生成说明文本
          </Button>
        )}
      >
        <TrainingResultGrid results={keptResults} title="已保留草稿" />
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectDatasetRevisionPage({ data, projectId, revisionId }: { data: TrainingAppData; projectId?: string; revisionId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const revision = project?.datasetRevisions.find((item) => item.id === revisionId);
  if (!project || !revision) return <EmptyPage title="没有冻结版本数据" />;
  const revisionResults = revision.samples.map((sample) => ({
    id: sample.id,
    sectionId: sample.sectionTitle,
    sectionTitle: sample.sectionTitle,
    image: sample.image,
    reviewStatus: "kept" as const,
    caption: sample.captionSnapshot,
    sourceLabel: `${sample.label} · ${sample.filePathSnapshot}`,
  }));
  const relatedRuns = training.runs.filter((run) => revision.relatedTrainingRunIds.includes(run.id) || run.datasetRevisionId === revision.id);

  return (
    <div className={s.page}>
      <ProjectHeader active="dataset" project={project} title={`${project.title} / 数据集 ${revision.version}`} />
      <div className={s.twoCol}>
        <Panel title="版本快照">
          <dl className={s.statGrid}>
            <div><dt>状态</dt><dd>{revision.status}</dd></div>
            <div><dt>图片</dt><dd>{revision.itemCount} 张</dd></div>
            <div><dt>缺说明文本</dt><dd>{revision.captionMissingCount}</dd></div>
            <div><dt>文件清单</dt><dd>{revision.manifestName}</dd></div>
          </dl>
        </Panel>
        <Panel title="关联训练">
          <RunRows project={project} runs={relatedRuns} />
        </Panel>
      </div>
      <Panel title="样本快照与说明文本">
        <TrainingResultGrid results={revisionResults} title={`${revision.version} 样本快照`} />
      </Panel>
      <Panel title="文件清单">
        <div className={s.manifestListSurface}>
          <ol className={s.manifestList}>
            {revision.manifestRows.map((row) => <li key={row}>{row}</li>)}
          </ol>
        </div>
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectScopedRunsPage({
  data,
  kind,
  projectId,
}: {
  data: TrainingAppData;
  kind: LoraTrainingTaskKind;
  projectId?: string;
}) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [projectRunInteractionState, setProjectRunInteractionState] = useState(() => ({
    hiddenProjectRunIds: new Set<string>(),
    kind,
    projectId: project?.id ?? null,
    retriedProjectRunIds: new Set<string>(),
    status: "completed" as LoraTrainingTaskStatus,
  }));
  const [isRetryingProjectRuns, setIsRetryingProjectRuns] = useState(false);
  const [isDeletingProjectRuns, setIsDeletingProjectRuns] = useState(false);
  if (!project) return <EmptyPage title="没有项目任务数据" />;
  const activeProject = project;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const projectRunInteraction = projectRunInteractionState.projectId === activeProject.id && projectRunInteractionState.kind === kind ? projectRunInteractionState : {
    hiddenProjectRunIds: new Set<string>(),
    kind,
    projectId: activeProject.id,
    retriedProjectRunIds: new Set<string>(),
    status: "completed" as LoraTrainingTaskStatus,
  };
  const status = projectRunInteraction.status;
  const hiddenProjectRunIds = projectRunInteraction.hiddenProjectRunIds;
  const retriedProjectRunIds = projectRunInteraction.retriedProjectRunIds;
  const projectRuns = training.runs.filter((run) => run.projectId === activeProject.id && run.kind === kind && !hiddenProjectRunIds.has(run.id));
  const visibleRuns = projectRuns.filter((run) => run.status === status);

  function updateProjectRunInteraction(updater: (current: typeof projectRunInteraction) => typeof projectRunInteraction) {
    setProjectRunInteractionState((current) => {
      const active = current.projectId === activeProject.id && current.kind === kind ? current : {
        hiddenProjectRunIds: new Set<string>(),
        kind,
        projectId: activeProject.id,
        retriedProjectRunIds: new Set<string>(),
        status: "completed" as LoraTrainingTaskStatus,
      };
      return {
        ...updater(active),
        kind,
        projectId: activeProject.id,
      };
    });
  }

  function handleProjectRunStatusChange(nextStatus: LoraTrainingTaskStatus) {
    updateProjectRunInteraction((current) => ({
      ...current,
      status: nextStatus,
    }));
  }

  function applyLocalProjectRunDelete(runId: string) {
    updateProjectRunInteraction((current) => {
      const retriedProjectRunIds = new Set(current.retriedProjectRunIds);
      retriedProjectRunIds.delete(runId);
      return {
        ...current,
        hiddenProjectRunIds: new Set([...current.hiddenProjectRunIds, runId]),
        retriedProjectRunIds,
      };
    });
  }

  async function handleDeleteProjectRun(runId: string) {
    const run = projectRuns.find((candidate) => candidate.id === runId);
    if (!run) return;

    if (!isProductionTrainingRoute) {
      applyLocalProjectRunDelete(runId);
      pushToast({
        tone: "warning",
        title: "任务已从项目列表移除",
        detail: run.title,
      });
      return;
    }

    if (isDeletingProjectRuns) return;

    setIsDeletingProjectRuns(true);
    try {
      const response = await fetch(
        run.kind === "generation"
          ? `/api/training/generation-tasks/${run.id}`
          : `/api/training/training-runs/${run.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "删除失败",
          detail: payload?.error?.message ?? "任务移除请求失败",
        });
        return;
      }

      applyLocalProjectRunDelete(runId);
      pushToast({
        tone: "warning",
        title: "任务已从项目列表移除",
        detail: run.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "删除失败",
        detail: error instanceof Error ? error.message : "任务移除请求失败",
      });
    } finally {
      setIsDeletingProjectRuns(false);
    }
  }

  async function handleRetryProjectRun(runId: string) {
    const run = projectRuns.find((candidate) => candidate.id === runId);
    if (!run) return;

    const applyLocalRetryState = () => {
      updateProjectRunInteraction((current) => ({
        ...current,
        retriedProjectRunIds: new Set([...current.retriedProjectRunIds, runId]),
      }));
    };

    if (!isProductionTrainingRoute) {
      applyLocalRetryState();
      pushToast({
        tone: "success",
        title: "重试已排队",
        detail: run.title,
      });
      return;
    }

    if (isRetryingProjectRuns) return;

    setIsRetryingProjectRuns(true);
    try {
      const response = run.kind === "generation"
        ? await (async () => {
            if (!run.sectionId) {
              throw new Error("当前生成任务缺少小节上下文，无法重试。");
            }
            return fetch(`/api/training/sections/${run.sectionId}/runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                parentRunId: run.id,
                projectId: activeProject.id,
              }),
            });
          })()
        : await (async () => {
            if (!run.datasetRevisionId) {
              throw new Error("当前训练任务缺少数据集版本，无法重试。");
            }
            return fetch(`/api/training/projects/${activeProject.id}/training-runs`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                revisionId: run.datasetRevisionId,
                config: {
                  overrides: {
                    ordinary: {
                      targetSteps: run.targetSteps,
                    },
                  },
                },
              }),
            });
          })();
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "重试失败",
          detail: payload?.error?.message ?? "重试请求失败",
        });
        return;
      }

      applyLocalRetryState();
      pushToast({
        tone: "success",
        title: "重试已排队",
        detail: run.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "重试失败",
        detail: error instanceof Error ? error.message : "重试请求失败",
      });
    } finally {
      setIsRetryingProjectRuns(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active={kind === "generation" ? "generation" : "training"}
        project={project}
        title={`${project.title} / ${kind === "generation" ? "生成任务" : "训练任务"}`}
      />
      <SegmentedControl
        ariaLabel="切换任务状态"
        panel
        role="tablist"
        items={STATUS_ITEMS.map((item) => ({ ...item, count: projectRuns.filter((run) => run.status === item.value).length }))}
        value={status}
        onChange={handleProjectRunStatusChange}
      />
      <Panel title={kind === "generation" ? "项目生成任务" : "项目训练任务"}>
        <RunRows
          onDeleteRun={handleDeleteProjectRun}
          isDeletingRuns={isDeletingProjectRuns}
          onRetryRun={handleRetryProjectRun}
          project={project}
          retriedRunIds={retriedProjectRunIds}
          runs={visibleRuns}
        />
      </Panel>
    </div>
  );
}

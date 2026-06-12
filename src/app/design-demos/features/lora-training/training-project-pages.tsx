"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore } from "react";
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
  Trash2,
} from "lucide-react";

import type { DemoData, DemoImage } from "../../data";
import { cx, demoHref } from "../../routing";
import { ImageListSmall } from "../../shared/media/image-list-small";
import { ImagePreviewFrame } from "../../shared/media/image-preview-frame";
import { ImagePreviewLarge } from "../../shared/media/image-preview-large";
import { Button, ButtonLink } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { SwitchRow } from "../../shared/primitives/switch-row";
import { SelectionBatchBar } from "../../shared/patterns";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingImageResult, LoraTrainingProject, LoraTrainingReferenceImage, LoraTrainingRun, LoraTrainingSection, LoraTrainingSectionBlock, LoraTrainingTaskKind, LoraTrainingTaskStatus, LoraTrainingTemplate } from "./types";
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
const DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT = "保持角色正面可训练，避免复杂遮挡和多人构图。";

type NewProjectTemplateHints = {
  sections: string;
  templateId: string;
  templateTitle: string;
};

function useTraining(data: DemoData) {
  return buildLoraTrainingDemoData(data);
}

function findProject(data: DemoData, projectId?: string) {
  const training = buildLoraTrainingDemoData(data);
  return training.projects.find((project) => project.id === projectId) ?? training.projects[0];
}

function findSection(project: LoraTrainingProject | undefined, sectionId?: string) {
  return project?.sections.find((section) => section.id === sectionId) ?? project?.sections[0];
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

function subscribeToUrlSearch(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getUrlSearchSnapshot() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function getServerUrlSearchSnapshot() {
  return "";
}

function useUrlSearch() {
  return useSyncExternalStore(subscribeToUrlSearch, getUrlSearchSnapshot, getServerUrlSearchSnapshot);
}

function readNewProjectTemplateHints(search: string): NewProjectTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    sections: searchParams.get("sections") ?? "",
    templateId: searchParams.get("templateId") ?? "",
    templateTitle: searchParams.get("template") ?? "",
  };
}

function ProjectNav({ active, project }: { active: (typeof PROJECT_TABS)[number]["key"]; project: LoraTrainingProject }) {
  return (
    <nav className={s.projectNav} aria-label="训练项目页面">
      {PROJECT_TABS.map((item) => (
        <Link
          aria-current={item.key === active ? "page" : undefined}
          className={cx(s.projectNavItem, item.key === active && s.projectNavItemActive)}
          href={demoHref(`/training/projects/${project.id}${item.path}`)}
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
  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);
  const activeResult = activeResultIndex === null ? null : results[activeResultIndex] ?? null;

  if (results.length === 0) return <div className={s.emptyInline}>没有训练结果图片</div>;

  return (
    <>
      <div className={s.trainingResultGrid}>
        {results.map((result, index) => {
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
                onClick={() => setActiveResultIndex(index)}
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
          onClose={() => setActiveResultIndex(null)}
          onNext={() => setActiveResultIndex((current) => current === null ? 0 : (current + 1) % results.length)}
          onPrevious={() => setActiveResultIndex((current) => current === null ? 0 : (current + results.length - 1) % results.length)}
          actions={(
            <>
              <Button icon={Check} onClick={() => onReviewStatusChange?.(activeResult.id, "kept")} feedback={{ title: "图片已保留", detail: activeResult.sourceLabel }}>保留</Button>
              <Button tone="danger" icon={Trash2} onClick={() => onReviewStatusChange?.(activeResult.id, "rejected")} feedback={{ tone: "warning", title: "图片已拒绝", detail: activeResult.sourceLabel }}>拒绝</Button>
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

function copyProjectRunMessage(message: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  void navigator.clipboard.writeText(message).catch(() => undefined);
}

function ProjectRunFailureBlock({ message }: { message: string }) {
  return (
    <div className={s.projectRunFailureBlock} role="status">
      <div className={s.projectRunFailureHeader}>
        <CircleAlert aria-hidden="true" />
        <span>失败原因</span>
      </div>
      <p>{message}</p>
    </div>
  );
}

function RunRows({
  onHideRun,
  onRetryRun,
  project,
  retriedRunIds = new Set<string>(),
  runs,
}: {
  onHideRun?: (runId: string) => void;
  onRetryRun?: (runId: string) => void;
  project: LoraTrainingProject;
  retriedRunIds?: Set<string>;
  runs: LoraTrainingRun[];
}) {
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
              <Link className={s.projectRunMain} href={demoHref(`/training/runs/${type}/${run.id}`)}>
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
                    <Button size="sm" tone="subtle" icon={Copy} onClick={() => copyProjectRunMessage(failureMessage)} feedback={{ title: "报错已复制", detail: failureMessage }}>复制</Button>
                    <Button size="sm" tone="subtle" icon={Play} onClick={() => onRetryRun?.(run.id)} feedback={{ title: "已排队重试", detail: run.title }}>重试</Button>
                    <Button size="sm" tone="danger" icon={Trash2} onClick={() => onHideRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
                  </div>
                </div>
              ) : (
                <span className={s.projectRunActions}>
                  <Button tone="danger" icon={Trash2} onClick={() => onHideRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
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
              href={demoHref(`/training/projects/${project.id}/sections/${section.id}`)}
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

export function LoraTrainingProjectFormPage({ data }: { data: DemoData }) {
  const training = useTraining(data);
  const urlSearch = useUrlSearch();
  const newProjectTemplateHints = readNewProjectTemplateHints(urlSearch);
  const sourceTemplate = training.templates.find((template) => template.id === newProjectTemplateHints.templateId)
    ?? training.templates.find((template) => template.title === newProjectTemplateHints.templateTitle);
  const initialTemplate = sourceTemplate ?? training.templates[0];
  const initialSectionSeeds = sourceTemplate?.sections ?? initialTemplate?.sections ?? [];
  const projectTemplateContextId = initialTemplate?.id ?? "no-template";
  const baseModelOptions = data.models.filter((model) => model.modelType === "checkpoint").map((model) => model.name);
  const [projectFormState, setProjectFormState] = useState({
    baseModel: baseModelOptions[0] ?? "继承训练默认模型",
    captionStrategy: "先触发词后描述",
    detailPrompt: "发型、眼睛、服装材质、常见构图和需要避免的变化。",
    perSectionImageCount: "4",
    templateContextId: projectTemplateContextId,
    templateTitle: initialTemplate?.title ?? "不使用模板",
    title: "新角色 LoRA 项目",
    trainingSteps: "2400",
    usagePrompt: "角色触发词、服装和稳定身份描述。",
  });
  const projectForm = projectFormState.templateContextId === projectTemplateContextId ? projectFormState : {
    ...projectFormState,
    templateContextId: projectTemplateContextId,
    templateTitle: initialTemplate?.title ?? "不使用模板",
  };
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
      id: "uploaded-images",
      title: "上传图片",
      description: "资料候选",
      items: data.images.slice(0, 4).map((image) => ({
        id: `image-${image.id}`,
        title: image.label,
        detail: "作为新训练项目的原始参考图，确认后加入角色资料。",
        image,
        meta: image.status,
      })),
    },
  ].filter((group) => group.items.length > 0);
  const [previewReference, setPreviewReference] = useState<ReferenceCandidate | null>(referenceSourceTree[0]?.items[0] ?? null);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set());
  const [sectionSeedState, setSectionSeedState] = useState(() => ({
    sections: initialSectionSeeds,
    templateContextId: projectTemplateContextId,
  }));
  const sectionSeeds = sectionSeedState.templateContextId === projectTemplateContextId ? sectionSeedState.sections : initialSectionSeeds;
  const [trainingDefaults, setTrainingDefaults] = useState({
    autoFreezeDataset: true,
    autoGenerateSamples: true,
  });
  const [createdProjectDraft, setCreatedProjectDraft] = useState<{
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
  } | null>(null);
  const activePreviewReference = previewReference ?? referenceSourceTree[0]?.items[0] ?? null;
  const selectedProjectReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const selectedReferenceTitles = selectedProjectReferences.map((reference) => reference.title);

  function setProjectForm(updater: (current: typeof projectForm) => typeof projectForm) {
    setProjectFormState((current) => updater(current.templateContextId === projectTemplateContextId ? current : projectForm));
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

  function handleCreateProjectDraft() {
    setCreatedProjectDraft({
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
    });
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
            onClick={handleCreateProjectDraft}
            feedback={{ title: createdProjectDraft ? "项目草稿已更新" : "训练项目草稿已创建", detail: projectForm.title }}
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
                <Field readOnly label="来源训练模板" value={`${sourceTemplate.title}${newProjectTemplateHints.sections ? ` · ${newProjectTemplateHints.sections} 个小节` : ""}${newProjectTemplateHints.templateId ? ` · ${newProjectTemplateHints.templateId}` : ""}`} />
              ) : null}
              <FloatingSelect label="基础模型" value={projectForm.baseModel} options={["继承训练默认模型", ...baseModelOptions]} onChange={(value) => handleUpdateProjectForm("baseModel", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色使用提示词" value={projectForm.usagePrompt} onChange={(value) => handleUpdateProjectForm("usagePrompt", value)} />
              <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value={projectForm.detailPrompt} onChange={(value) => handleUpdateProjectForm("detailPrompt", value)} />
            </div>
          </Panel>
          <Panel title="参考资料" subtitle="先预览引用来源，再显式加入新项目资料。">
            <ReferencePicker
                referenceSourceTree={referenceSourceTree}
                previewReference={activePreviewReference}
                onPreviewReference={setPreviewReference}
                onAddReference={handleAddProjectReference}
                selectedReferenceIds={selectedReferenceIds}
              />
            </Panel>
        </div>
        <aside className={s.projectCreateAside}>
          <Panel title="初始小节" subtitle="模板小节只作为创建时初始小节，创建后独立管理。">
            <div className={s.sectionSeedList}>
              {sectionSeeds.map((section, index) => (
                <article className={s.sectionSeedCard} key={section.id}>
                  <div className={s.sectionSeedHeader}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{section.title}</strong>
                    <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
                  </div>
                  <p>{section.blockCount} 个场景块 · {section.scenePreview}</p>
                  <div className={s.sectionSeedActions}>
                    <Button size="sm" icon={Check} onClick={() => handleToggleSeedSection(section.id)} feedback={{ title: section.enabled ? "初始小节已停用" : "初始小节已启用", detail: section.title }}>{section.enabled ? "停用" : "启用"}</Button>
                    <Button size="sm" icon={Copy} onClick={() => handleCopySeedSection(section)} feedback={{ title: "初始小节已复制", detail: section.title }}>复制</Button>
                    <Button size="sm" tone="danger" icon={Trash2} onClick={() => handleDeleteSeedSection(section.id)} feedback={{ tone: "warning", title: "初始小节已移除", detail: section.title }}>删除</Button>
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

export function LoraTrainingProjectDetailPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [projectArchiveState, setProjectArchiveState] = useState(() => ({
    archived: project?.status === "archived",
    projectId: project?.id ?? null,
  }));
  if (!project) return <EmptyPage title="没有训练项目数据" />;
  const isProjectArchived = projectArchiveState.projectId === project.id ? projectArchiveState.archived : project.status === "archived";
  const activeProject: LoraTrainingProject = isProjectArchived
    ? { ...project, status: "archived" }
    : project.status === "archived"
      ? { ...project, status: "ready" }
      : project;
  const recentRuns = training.runs.filter((run) => run.projectId === project.id).slice(0, 4);
  const recentResults = project.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 4);
  const latestRevision = project.datasetRevisions[0];
  const saveAsTemplateHref = `/training/templates/new?${new URLSearchParams({
    projectId: project.id,
    sections: String(project.sections.length),
    sourceProject: project.title,
  }).toString()}`;

  function handleToggleProjectArchive() {
    setProjectArchiveState((current) => {
      const currentArchived = current.projectId === project.id ? current.archived : project.status === "archived";
      return { archived: !currentArchived, projectId: project.id };
    });
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="overview"
        project={activeProject}
        subtitle={isProjectArchived ? `${project.profileSummary} · 已归档` : project.profileSummary}
        actions={(
          <>
            <ButtonLink href={`/training/projects/${project.id}/dataset`} icon={Play} tone="primary">启动训练</ButtonLink>
            <ButtonLink href={saveAsTemplateHref} icon={CopyPlus}>保存为模板</ButtonLink>
            <Button
              tone={isProjectArchived ? "subtle" : "danger"}
              icon={Archive}
              onClick={handleToggleProjectArchive}
              feedback={{ tone: isProjectArchived ? "success" : "warning", title: isProjectArchived ? "训练项目已恢复" : "训练项目已归档", detail: project.title }}
            >
              {isProjectArchived ? "恢复" : "归档"}
            </Button>
          </>
        )}
      />
      <div className={s.overviewGrid}>
        <Panel title="角色资料">
          <div className={s.stack}>
            <p className={s.bodyText}>{project.profileSummary}</p>
            <div className={s.heroStrip}>
              <ImageListSmall images={project.referenceImages.map((reference) => reference.image)} limit={project.referenceImages.length} />
            </div>
            <ButtonLink href={`/training/projects/${project.id}/profile`} icon={FileText}>编辑资料</ButtonLink>
          </div>
        </Panel>
        <Panel title="训练入口" subtitle="总览只放启动判断，完整训练准备和冻结版本在数据集页处理。">
          <div className={s.readinessSummary}>
            <span><strong>{project.keptCount}</strong> 已保留</span>
            <span><strong>{project.captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{latestRevision?.version ?? project.datasetVersion}</strong> 当前版本</span>
          </div>
          <ButtonLink href={`/training/projects/${project.id}/dataset`} icon={Layers} tone="primary">打开数据集工作台</ButtonLink>
        </Panel>
        <Panel title="最近任务">
          <RunRows project={project} runs={recentRuns} />
        </Panel>
        <Panel title="最近产物" subtitle="只展示最近保留结果，完整审查在结果池。">
          <TrainingResultGrid results={recentResults} title="最近产物" />
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingProjectProfilePage({ data, projectId }: { data: DemoData; projectId?: string }) {
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
    referenceImageCount: number;
    usagePrompt: string;
  } | null>(null);
  if (!project) return <EmptyPage title="没有角色资料数据" />;
  const localReferenceImages = referenceImageState.projectId === project.id ? referenceImageState.images : project.referenceImages;
  const profileForm = profileFormState.projectId === project.id ? profileFormState : {
    detailPrompt: project.detailPrompt,
    profileSummary: project.profileSummary,
    projectId: project.id,
    usagePrompt: project.usagePrompt,
  };

  function handleSaveProfile() {
    setProfileDraft({
      detailPrompt: profileForm.detailPrompt,
      profileSummary: profileForm.profileSummary,
      referenceImageCount: localReferenceImages.length,
      usagePrompt: profileForm.usagePrompt,
    });
  }

  function handleUpdateProfileForm(field: "detailPrompt" | "profileSummary" | "usagePrompt", value: string) {
    setProfileForm((current) => {
      const active = current.projectId === project.id ? current : {
        detailPrompt: project.detailPrompt,
        profileSummary: project.profileSummary,
        projectId: project.id,
        usagePrompt: project.usagePrompt,
      };
      return {
        ...active,
        [field]: value,
        projectId: project.id,
      };
    });
  }

  function handleUploadReferenceImage() {
    setLocalReferenceImages((current) => {
      const currentImages = current.projectId === project.id ? current.images : project.referenceImages;
      const draftIndex = currentImages.length + 1;
      const image = project.images[currentImages.length % project.images.length] ?? currentImages[0]?.image;
      if (!image) return { images: currentImages, projectId: project.id };
      return {
        images: [
          ...currentImages,
          {
            id: `${project.id}-uploaded-reference-${draftIndex}`,
            image,
            kind: "auxiliary",
            label: `上传参考图 ${draftIndex}`,
            note: "页面内本地上传草稿，可继续作为角色辅助参考图管理。",
          },
        ],
        projectId: project.id,
      };
    });
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="profile"
        project={project}
        actions={(
          <Button
            tone="primary"
            icon={Save}
            onClick={handleSaveProfile}
            feedback={{ title: profileDraft ? "资料保存草稿已更新" : "资料保存草稿已记录", detail: project.title }}
          >
            {profileDraft ? "更新资料草稿" : "保存资料"}
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
                  </div>
                </article>
              ))}
            </div>
            <Button icon={ImagePlus} onClick={handleUploadReferenceImage} feedback={{ title: "参考图已加入本地草稿", detail: `${localReferenceImages.length + 1} 张参考图` }}>上传参考图</Button>
          </div>
        </Panel>
      </div>
      {profileDraft ? (
        <Panel title="资料保存草稿" subtitle="页面内已记录当前资料状态，可继续调整后再创建训练任务。">
          <dl className={s.profileDraft}>
            <div><dt>使用提示词</dt><dd>{profileDraft.usagePrompt}</dd></div>
            <div><dt>角色细节</dt><dd>{profileDraft.detailPrompt}</dd></div>
            <div><dt>资料备注</dt><dd>{profileDraft.profileSummary}</dd></div>
            <div><dt>参考图</dt><dd>{profileDraft.referenceImageCount} 张</dd></div>
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
            <Link href={demoHref(`/training/projects/${project.id}/sections/${section.id}`)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{section.title}</strong>
            </Link>
            <div className={s.sectionHeaderActions}>
              <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
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
          <Link className={s.sectionImages} href={demoHref(`/training/projects/${project.id}/sections/${section.id}`)}>
            <ImageListSmall images={section.images} limit={4} showCounts wide />
          </Link>
          <div className={s.sectionActions}>
            <span>更新 {section.updatedAt} · {section.blocks.length} 个场景块</span>
            <ButtonLink href={`/training/projects/${project.id}/sections/${section.id}/generation-tasks/new`} icon={ImagePlus} size="sm">生成样本</ButtonLink>
          </div>
        </div>
      </article>
    </div>
  );
}

export function LoraTrainingProjectSectionsPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  const [localSectionState, setLocalSections] = useState(() => ({
    projectId: project?.id ?? null,
    sections: project?.sections ?? [],
  }));
  const [orderedSectionState, setOrderedSectionIds] = useState(() => ({
    ids: project?.sections.map((section) => section.id) ?? [],
    projectId: project?.id ?? null,
  }));
  if (!project) return <EmptyPage title="没有训练小节数据" />;
  const localSections = localSectionState.projectId === project.id ? localSectionState.sections : project.sections;
  const orderedSectionIds = orderedSectionState.projectId === project.id ? orderedSectionState.ids : project.sections.map((section) => section.id);
  const sectionMap = new Map(localSections.map((section) => [section.id, section]));
  const sections = orderedSectionIds
    .map((sectionId) => sectionMap.get(sectionId))
    .filter((section): section is LoraTrainingSection => Boolean(section));

  function handleCopySection(section: LoraTrainingSection) {
    const copyNumber = nextProjectSectionCopyNumber(localSections, section.id);
    const copyId = `${section.id}-copy-${copyNumber}`;
    const copy: LoraTrainingSection = {
      ...section,
      id: copyId,
      title: `${section.title} (副本)`,
      updatedAt: "刚刚",
    };
    setLocalSections((current) => {
      const currentSections = current.projectId === project.id ? current.sections : project.sections;
      const sourceIndex = currentSections.findIndex((item) => item.id === section.id);
      const sections = sourceIndex === -1
        ? [...currentSections, copy]
        : [
          ...currentSections.slice(0, sourceIndex + 1),
          copy,
          ...currentSections.slice(sourceIndex + 1),
        ];
      return { projectId: project.id, sections };
    });
    setOrderedSectionIds((current) => {
      const currentIds = current.projectId === project.id ? current.ids : project.sections.map((item) => item.id);
      const sourceIndex = currentIds.indexOf(section.id);
      const ids = sourceIndex === -1
        ? [...currentIds, copyId]
        : [
          ...currentIds.slice(0, sourceIndex + 1),
          copyId,
          ...currentIds.slice(sourceIndex + 1),
        ];
      return { ids, projectId: project.id };
    });
  }

  function handleDeleteSection(sectionId: string) {
    setLocalSections((current) => {
      const currentSections = current.projectId === project.id ? current.sections : project.sections;
      return {
        projectId: project.id,
        sections: currentSections.filter((section) => section.id !== sectionId),
      };
    });
    setOrderedSectionIds((current) => {
      const currentIds = current.projectId === project.id ? current.ids : project.sections.map((section) => section.id);
      return {
        ids: currentIds.filter((id) => id !== sectionId),
        projectId: project.id,
      };
    });
  }

  function handleReorderSections(nextSectionIds: string[]) {
    setOrderedSectionIds({ ids: nextSectionIds, projectId: project.id });
  }

  function handleAddSection() {
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
    setLocalSections((current) => {
      const currentSections = current.projectId === project.id ? current.sections : project.sections;
      return { projectId: project.id, sections: [...currentSections, draft] };
    });
    setOrderedSectionIds((current) => {
      const currentIds = current.projectId === project.id ? current.ids : project.sections.map((section) => section.id);
      return { ids: [...currentIds, draft.id], projectId: project.id };
    });
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

export function LoraTrainingProjectSectionDetailPage({ data, projectId, sectionId }: { data: DemoData; projectId?: string; sectionId?: string }) {
  const training = buildLoraTrainingDemoData(data);
  const project = training.projects.find((item) => item.id === projectId) ?? training.projects[0];
  const section = findSection(project, sectionId);
  const [sceneBlockState, setSceneBlocks] = useState(() => ({
    blocks: section?.blocks ?? [],
    sectionId: section?.id ?? null,
  }));
  const [sectionResultState, setSectionResults] = useState(() => ({
    projectId: project?.id ?? null,
    results: project?.resultPool ?? [],
  }));
  const [editingSceneBlockId, setEditingSceneBlockId] = useState<string | null>(null);
  const [sectionDraft, setSectionDraft] = useState<{
    blockCount: number;
    firstBlock: string;
    imagePrompt: string;
    projectTitle: string;
    scenePreview: string;
    sectionId: string;
    sectionTitle: string;
  } | null>(null);
  const sceneBlocks = sceneBlockState.sectionId === section?.id ? sceneBlockState.blocks : section?.blocks ?? [];
  const sectionResults = (sectionResultState.projectId === project?.id ? sectionResultState.results : project?.resultPool ?? [])
    .filter((result) => result.sectionId === section?.id);
  const visibleSectionDraft = sectionDraft?.sectionId === section?.id ? sectionDraft : null;
  if (!project || !section) return <EmptyPage title="没有训练小节详情" />;

  const activeProject = project;
  const activeSection = section;
  const importedPreset = training.presets[0];
  const scenePreview = sceneBlocks.map((block) => block.text).join("\n\n");

  function updateSceneBlocks(updater: (current: LoraTrainingSectionBlock[]) => LoraTrainingSectionBlock[]) {
    setSceneBlocks((current) => ({
      blocks: updater(current.sectionId === activeSection.id ? current.blocks : activeSection.blocks),
      sectionId: activeSection.id,
    }));
  }

  function handleAddLocalSceneBlock() {
    updateSceneBlocks((current) => {
      const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-local-block-`);
      return [
        ...current,
        {
          id: `${activeSection.id}-local-block-${ordinal}`,
          source: "本地",
          title: `本地补充块 ${ordinal}`,
          text: "补充这一小节的造型、动作或画面约束。",
        },
      ];
    });
  }

  function handleImportPresetBlock() {
    if (!importedPreset) return;
    updateSceneBlocks((current) => {
      const prefix = `${activeSection.id}-preset-block-${importedPreset.id}-`;
      const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-preset-block-${importedPreset.id}-`);
      return [
        ...current,
        {
          id: `${prefix}${ordinal}`,
          source: "预制",
          title: importedPreset.title,
          text: importedPreset.sceneDescriptionText,
        },
      ];
    });
  }

  function handleMoveSceneBlock(index: number, direction: -1 | 1) {
    updateSceneBlocks((current) => moveSceneBlock(current, index, direction));
  }

  function handleUpdateSceneBlock(blockId: string, patch: SceneBlockPatch) {
    updateSceneBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function handleDeleteSceneBlock(blockId: string) {
    if (editingSceneBlockId === blockId) setEditingSceneBlockId(null);
    updateSceneBlocks((current) => current.filter((block) => block.id !== blockId));
  }

  function handleReviewSectionResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    setSectionResults((current) => ({
      projectId: activeProject.id,
      results: (current.projectId === activeProject.id ? current.results : activeProject.resultPool).map((result) =>
        result.id === resultId ? { ...result, reviewStatus } : result,
      ),
    }));
  }

  function handleSaveSection() {
    setSectionDraft({
      blockCount: sceneBlocks.length,
      firstBlock: sceneBlocks[0]?.title ?? "无场景块",
      imagePrompt: activeSection.imagePrompt,
      projectTitle: activeProject.title,
      scenePreview: scenePreview || activeSection.resolvedScene,
      sectionId: activeSection.id,
      sectionTitle: activeSection.title,
    });
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${project.title} / ${section.title}`}
        actions={(
          <>
            <Button
              icon={Save}
              onClick={handleSaveSection}
              feedback={{ title: visibleSectionDraft ? "小节保存草稿已更新" : "小节保存草稿已记录", detail: section.title }}
            >
              {visibleSectionDraft ? "更新小节草稿" : "保存小节"}
            </Button>
            <ButtonLink href={`/training/projects/${project.id}/sections/${section.id}/generation-tasks/new`} icon={ImagePlus} tone="primary">生成样本</ButtonLink>
          </>
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
                  disabled={!importedPreset}
                  onClick={handleImportPresetBlock}
                  feedback={{ title: "预制已导入场景块", detail: importedPreset?.title ?? section.title }}
                >
                  导入预制
                </Button>
                <Button size="sm" icon={Plus} onClick={handleAddLocalSceneBlock} feedback={{ title: "本地块已添加", detail: section.title }}>添加本地块</Button>
              </>
            )}
          >
            <div className={s.sceneBlockList}>
              {sceneBlocks.map((block, index) => (
                <SceneBlockCard
                  block={block}
                  index={index}
                  isEditing={editingSceneBlockId === block.id}
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
        <Panel title="小节结果">
          <TrainingResultGrid
            onReviewStatusChange={handleReviewSectionResult}
            results={sectionResults}
            title={`${section.title} 结果`}
          />
        </Panel>
      </TrainingSectionWorkspace>
    </div>
  );
}

export function LoraTrainingGenerationComposePage({ data, projectId, sectionId }: { data: DemoData; projectId?: string; sectionId?: string }) {
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
  const [generationTaskDraft, setGenerationTaskDraft] = useState<{
    finalInput: string;
    selectedReferenceTitles: string[];
    sectionTitle: string;
    supplementalPrompt: string;
    taskType: string;
  } | null>(null);

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
  const sectionTitle = activeSection.title;
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const selectedReferenceTitles = selectedReferences.map((reference) => reference.title);
  const selectedReferenceDetails = selectedReferences
    .map((reference) => `- ${reference.title}: ${reference.detail}`)
    .join("\n");
  const finalInputText = [
    activeProject.usagePrompt,
    activeSection.resolvedScene,
    selectedReferenceDetails ? `显式引用\n${selectedReferenceDetails}` : "",
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

  function handleQueueGenerationTask() {
    setGenerationTaskDraft({
      finalInput: finalInputText,
      selectedReferenceTitles,
      sectionTitle,
      supplementalPrompt: generationForm.supplementalPrompt,
      taskType: generationForm.taskType,
    });
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
            onClick={handleQueueGenerationTask}
            feedback={{ title: generationTaskDraft ? "生成任务草稿已更新" : "生成任务草稿已排队", detail: section.title }}
          >
            {generationTaskDraft ? "更新任务草稿" : "运行生成"}
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
            <Field readOnly multiline features={{ clipboard: true }} label="最终输入预览" value={finalInputText} />
          </div>
        </Panel>
      </div>
      {generationTaskDraft ? (
        <Panel title="生成任务草稿" subtitle="页面内已记录本次生成请求，可继续调整引用和最终输入后更新。">
          <dl className={s.generationTaskDraft}>
            <div><dt>任务类型</dt><dd>{generationTaskDraft.taskType}</dd></div>
            <div><dt>小节</dt><dd>{generationTaskDraft.sectionTitle}</dd></div>
            <div><dt>已选引用</dt><dd>{generationTaskDraft.selectedReferenceTitles.join("、") || "未添加引用"}</dd></div>
            <div><dt>补充提示词</dt><dd>{generationTaskDraft.supplementalPrompt || "未填写"}</dd></div>
            <div><dt>最终输入</dt><dd>{generationTaskDraft.finalInput.split("\n")[0]}</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}

export function LoraTrainingProjectResultsPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  const [filter, setFilter] = useState<TrainingResultFilter>("all");
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [resultState, setLocalResults] = useState(() => ({
    projectId: project?.id ?? null,
    results: project?.resultPool ?? [],
  }));
  const localResults = resultState.projectId === project?.id ? resultState.results : project?.resultPool ?? [];
  if (!project) return <EmptyPage title="没有训练结果池数据" />;
  const activeProject = project;
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

  function handleReviewResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    updateLocalResults((current) => current.map((result) =>
      result.id === resultId ? { ...result, reviewStatus } : result,
    ));
    setSelectedResultIds((current) => {
      const next = new Set(current);
      next.delete(resultId);
      return next;
    });
  }

  function toggleResultSelection(resultId: string) {
    setSelectedResultIds((current) => {
      const next = new Set(current);
      if (next.has(resultId)) next.delete(resultId);
      else next.add(resultId);
      return next;
    });
  }

  function toggleVisibleResultSelection() {
    setSelectedResultIds((current) => {
      if (allVisibleResultsSelected) {
        const next = new Set(current);
        results.forEach((result) => next.delete(result.id));
        return next;
      }
      return new Set([...current, ...visibleResultIds]);
    });
  }

  function handleBatchReviewResults(reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    const selectedIds = new Set(selectedVisibleResultIds);
    updateLocalResults((current) => current.map((result) =>
      selectedIds.has(result.id) ? { ...result, reviewStatus } : result,
    ));
    setSelectedResultIds((current) => new Set([...current].filter((resultId) => !selectedIds.has(resultId))));
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
            onChange={setFilter}
          />
          {selectedVisibleCount > 0 ? (
            <SelectionBatchBar
              selectedCount={selectedVisibleCount}
              subject="张训练结果"
              onClear={() => setSelectedResultIds(new Set())}
              actions={(
                <>
                  <Button icon={Check} tone="primary" onClick={() => handleBatchReviewResults("kept")} feedback={{ title: "已保留所选图片", detail: `${selectedVisibleCount} 张训练结果` }}>
                    批量保留
                  </Button>
                  <Button icon={Trash2} tone="danger" onClick={() => handleBatchReviewResults("rejected")} feedback={{ tone: "warning", title: "已拒绝所选图片", detail: `${selectedVisibleCount} 张训练结果` }}>
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

export function LoraTrainingProjectDatasetPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  const [trainingDraft, setTrainingDraft] = useState<{
    captionMissingCount: number;
    keptCount: number;
    stepCount: number;
    version: string;
  } | null>(null);
  if (!project) return <EmptyPage title="没有训练数据集数据" />;

  function handleOpenTrainingDraft() {
    setTrainingDraft({
      captionMissingCount: project.captionMissingCount,
      keptCount: project.keptCount,
      stepCount: 2400,
      version: project.datasetVersion,
    });
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="dataset"
        project={project}
        actions={(
          <Button
            tone="primary"
            icon={Play}
            onClick={handleOpenTrainingDraft}
            feedback={{ title: trainingDraft ? "训练配置草稿已更新" : "训练配置草稿已打开", detail: project.datasetVersion }}
          >
            {trainingDraft ? "更新训练草稿" : "启动训练"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="训练准备" subtitle="只有已保留图片进入冻结版本，后续编辑不会回写已冻结版本。">
          <div className={s.readinessSummary}>
            <span><strong>{project.keptCount}</strong> 已保留图片</span>
            <span><strong>{project.captionMissingCount}</strong> 缺说明文本</span>
            <span><strong>{project.datasetVersion}</strong> 当前版本</span>
          </div>
          <p className={s.bodyText}>准备信息保持在训练入口附近，完整样本与冻结快照继续由下方草稿和版本列表承载。</p>
        </Panel>
        <Panel title="冻结版本">
          <div className={s.entityRowsSurface}>
            <div className={s.entityRows}>
              {project.datasetRevisions.map((revision) => (
                <Link className={s.entityRow} href={demoHref(`/training/projects/${project.id}/dataset/revisions/${revision.id}`)} key={revision.id}>
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
      <Panel title="已保留草稿">
        <TrainingResultGrid results={project.resultPool.filter((result) => result.reviewStatus === "kept")} title="已保留草稿" />
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectDatasetRevisionPage({ data, projectId, revisionId }: { data: DemoData; projectId?: string; revisionId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const revision = project?.datasetRevisions.find((item) => item.id === revisionId) ?? project?.datasetRevisions[0];
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
  data: DemoData;
  kind: LoraTrainingTaskKind;
  projectId?: string;
}) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  const [status, setStatus] = useState<LoraTrainingTaskStatus>("completed");
  const [hiddenProjectRunIds, setHiddenProjectRunIds] = useState<Set<string>>(new Set());
  const [retriedProjectRunIds, setRetriedProjectRunIds] = useState<Set<string>>(new Set());
  if (!project) return <EmptyPage title="没有项目任务数据" />;
  const projectRuns = training.runs.filter((run) => run.projectId === project.id && run.kind === kind && !hiddenProjectRunIds.has(run.id));
  const visibleRuns = projectRuns.filter((run) => run.status === status);

  function handleHideProjectRun(runId: string) {
    setHiddenProjectRunIds((current) => new Set([...current, runId]));
    setRetriedProjectRunIds((current) => {
      const next = new Set(current);
      next.delete(runId);
      return next;
    });
  }

  function handleRetryProjectRun(runId: string) {
    setRetriedProjectRunIds((current) => new Set([...current, runId]));
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active={kind === "generation" ? "generation" : "training"}
        project={project}
        title={`${project.title} / ${kind === "generation" ? "生成任务" : "训练任务"}`}
        actions={kind === "generation" ? <ButtonLink href={`/training/projects/${project.id}/sections/${project.sections[0]?.id ?? "stage-light"}/generation-tasks/new`} icon={Plus} tone="primary">新建生成任务</ButtonLink> : <ButtonLink href={`/training/projects/${project.id}/dataset`} icon={Play} tone="primary">启动训练</ButtonLink>}
      />
      <SegmentedControl
        ariaLabel="切换任务状态"
        panel
        role="tablist"
        items={STATUS_ITEMS.map((item) => ({ ...item, count: projectRuns.filter((run) => run.status === item.value).length }))}
        value={status}
        onChange={setStatus}
      />
      <Panel title={kind === "generation" ? "项目生成任务" : "项目训练任务"}>
        <RunRows
          onHideRun={handleHideProjectRun}
          onRetryRun={handleRetryProjectRun}
          project={project}
          retriedRunIds={retriedProjectRunIds}
          runs={visibleRuns}
        />
      </Panel>
    </div>
  );
}

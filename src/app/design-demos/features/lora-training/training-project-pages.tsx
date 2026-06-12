"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
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
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { SwitchRow } from "../../shared/primitives/switch-row";
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

function buildSeedSectionCopy(section: LoraTrainingTemplateSeedSection, copyNumber: number): LoraTrainingTemplateSeedSection {
  return {
    ...section,
    id: `${section.id}-copy-${copyNumber}`,
    title: `${section.title} 副本 ${copyNumber}`,
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

function StatGrid({ project }: { project: LoraTrainingProject }) {
  return (
    <dl className={s.statGrid}>
      <div><dt>资料</dt><dd>{project.readiness}</dd></div>
      <div><dt>小节</dt><dd>{project.sectionCount} 个</dd></div>
      <div><dt>结果池</dt><dd>{project.keptCount} 已保留</dd></div>
      <div><dt>Caption</dt><dd>{project.captionMissingCount} 缺失</dd></div>
    </dl>
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
  results,
  title = "训练结果",
}: {
  onReviewStatusChange?: (resultId: string, status: LoraTrainingImageResult["reviewStatus"]) => void;
  results: LoraTrainingImageResult[];
  title?: string;
}) {
  const [activeResultIndex, setActiveResultIndex] = useState<number | null>(null);
  const activeResult = activeResultIndex === null ? null : results[activeResultIndex] ?? null;

  if (results.length === 0) return <div className={s.emptyInline}>没有训练结果图片</div>;

  return (
    <>
      <div className={s.trainingResultGrid}>
        {results.map((result, index) => (
          <button
            className={s.trainingResultCard}
            data-review-status={result.reviewStatus}
            key={result.id}
            type="button"
            onClick={() => setActiveResultIndex(index)}
          >
            <ImagePreviewFrame image={result.image} />
            <span className={s.trainingResultMeta}>
              <strong>{result.sourceLabel}</strong>
              <StatusBadge status={reviewStatusTone(result.reviewStatus)} label={reviewStatusLabel(result.reviewStatus)} />
            </span>
            <p className={s.trainingResultCaption}>{result.caption}</p>
          </button>
        ))}
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
    <div className={s.projectRunRows}>
      {runs.map((run) => {
        const type = run.kind === "generation" ? "generation" : "training";
        const previewImages = runPreviewImages(run, project);
        const retried = retriedRunIds.has(run.id);
        return (
          <article className={s.projectRunRow} key={run.id}>
            <Link className={s.projectRunMain} href={demoHref(`/training/runs/${type}/${run.id}`)}>
              <span className={s.projectRunText}>
                <strong>{run.title}</strong>
                <span>{run.summary} · {run.timestamp}</span>
                {run.outputLabel ? <em>{run.outputLabel}</em> : null}
                {run.waitReason ? <em>{run.waitReason}</em> : null}
                {retried ? <em>已排队重试</em> : null}
                {run.errorMessage ? <em className={s.projectRunError}>{run.errorMessage}</em> : null}
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
            <span className={s.projectRunActions}>
              {run.status === "failed" && !retried ? (
                <Button icon={Play} onClick={() => onRetryRun?.(run.id)} feedback={{ title: "已排队重试", detail: run.title }}>重试</Button>
              ) : null}
              <Button tone="danger" icon={Trash2} onClick={() => onHideRun?.(run.id)} feedback={{ tone: "warning", title: "任务已从项目列表移除", detail: run.title }}>移除</Button>
            </span>
          </article>
        );
      })}
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
  previewReference,
  referenceSourceTree,
}: {
  onPreviewReference: (candidate: ReferenceCandidate) => void;
  previewReference: ReferenceCandidate | null;
  referenceSourceTree: ReferenceSourceGroup[];
}) {
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<Set<string>>(new Set());
  const selectedReferences = referenceSourceTree
    .flatMap((group) => group.items)
    .filter((candidate) => selectedReferenceIds.has(candidate.id));
  const previewAlreadyAdded = previewReference ? selectedReferenceIds.has(previewReference.id) : false;

  function handleAddReference() {
    if (!previewReference) return;
    setSelectedReferenceIds((current) => new Set([...current, previewReference.id]));
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
          disabled={!previewReference}
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
  const initialTemplate = training.templates[0];
  const baseModelOptions = data.models.filter((model) => model.modelType === "checkpoint").map((model) => model.name);
  const [projectForm, setProjectForm] = useState({
    baseModel: baseModelOptions[0] ?? "继承训练默认模型",
    captionStrategy: "先触发词后描述",
    detailPrompt: "发型、眼睛、服装材质、常见构图和需要避免的变化。",
    perSectionImageCount: "4",
    templateTitle: initialTemplate?.title ?? "不使用模板",
    title: "新角色 LoRA 项目",
    trainingSteps: "2400",
    usagePrompt: "角色触发词、服装和稳定身份描述。",
  });
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
      description: "最近 kept 图",
      items: training.projects.flatMap((project) => project.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 2).map((result) => ({
        id: `result-${result.id}`,
        title: `${project.title} / ${result.sectionTitle}`,
        detail: result.caption,
        image: result.image,
        meta: "kept",
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
  const [sectionSeeds, setSectionSeeds] = useState(() => initialTemplate?.sections ?? []);
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
    sectionCount: number;
    templateTitle: string;
    title: string;
    trainingSteps: string;
    usagePrompt: string;
  } | null>(null);
  const activePreviewReference = previewReference ?? referenceSourceTree[0]?.items[0] ?? null;

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
      const copyNumber = current.filter((item) => item.id === section.id || item.id.startsWith(`${section.id}-copy-`)).length;
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

  function handleCreateProjectDraft() {
    setCreatedProjectDraft({
      autoFreezeDataset: trainingDefaults.autoFreezeDataset,
      autoGenerateSamples: trainingDefaults.autoGenerateSamples,
      baseModel: projectForm.baseModel,
      captionStrategy: projectForm.captionStrategy,
      detailPrompt: projectForm.detailPrompt,
      enabledSectionCount: sectionSeeds.filter((section) => section.enabled).length,
      perSectionImageCount: projectForm.perSectionImageCount,
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
        subtitle="选择模板、填写角色资料，并创建初始小节。模板只作为 seed，创建后不会 live 回写。"
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
          <Panel title="项目基础信息" subtitle="沿用项目表单骨架，但这里只写训练项目 seed 数据。">
            <div className={s.formStack}>
              <Field label="项目名称" value={projectForm.title} onChange={(value) => handleUpdateProjectForm("title", value)} />
              <FloatingSelect label="从模板创建" value={projectForm.templateTitle} options={["不使用模板", ...training.templates.map((template) => template.title)]} onChange={handleSelectTemplate} />
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
            />
          </Panel>
        </div>
        <aside className={s.projectCreateAside}>
          <Panel title="初始小节" subtitle="模板小节只是创建时 seed，创建后独立管理。">
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
          <Panel title="数据集与训练默认" subtitle="创建后用于首批图片生成、caption 和训练任务草稿。">
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
                title="Caption 完成后自动冻结数据集"
                subtitle="只冻结 kept 图片；后续编辑不会回写 revision。"
              />
              <FloatingSelect label="caption 策略" value={projectForm.captionStrategy} options={["先触发词后描述", "只补全缺失 caption", "人工确认后写入"]} onChange={(value) => handleUpdateProjectForm("captionStrategy", value)} />
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
                <div><dt>初始小节</dt><dd>{createdProjectDraft.enabledSectionCount} / {createdProjectDraft.sectionCount} 启用</dd></div>
                <div><dt>每小节图片</dt><dd>{createdProjectDraft.perSectionImageCount}</dd></div>
                <div><dt>训练步数</dt><dd>{createdProjectDraft.trainingSteps}</dd></div>
                <div><dt>Caption 策略</dt><dd>{createdProjectDraft.captionStrategy}</dd></div>
                <div><dt>自动生成样本</dt><dd>{createdProjectDraft.autoGenerateSamples ? "开启" : "关闭"}</dd></div>
                <div><dt>自动冻结数据集</dt><dd>{createdProjectDraft.autoFreezeDataset ? "开启" : "关闭"}</dd></div>
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
        <Panel title="训练入口" subtitle="总览只放启动判断，完整 readiness 和 revision 在数据集页处理。">
          <div className={s.readinessSummary}>
            <span><strong>{project.keptCount}</strong> kept</span>
            <span><strong>{project.captionMissingCount}</strong> 缺 caption</span>
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
  return (
    <article className={s.sectionCard}>
      <Button className={s.dragHandle} icon={GripVertical} iconOnly tone="subtle" ariaLabel={`拖拽排序小节：${section.title}`} />
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
              feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.title }}
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
  );
}

export function LoraTrainingProjectSectionsPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  const [localSections, setLocalSections] = useState(() => project?.sections ?? []);
  if (!project) return <EmptyPage title="没有训练小节数据" />;
  const sections = localSections;

  function handleCopySection(section: LoraTrainingSection) {
    const copy: LoraTrainingSection = {
      ...section,
      id: `${section.id}-copy-${Date.now()}`,
      title: `${section.title} (副本)`,
      updatedAt: "刚刚",
    };
    setLocalSections((current) => [...current, copy]);
  }

  function handleDeleteSection(sectionId: string) {
    setLocalSections((current) => current.filter((section) => section.id !== sectionId));
  }

  function handleAddSection() {
    setLocalSections((current) => {
      const source = current[0];
      const draftIndex = current.length + 1;
      const draft: LoraTrainingSection = source ? {
        ...source,
        id: `new-section-${Date.now()}`,
        title: `新小节 ${draftIndex}`,
        updatedAt: "刚刚",
        images: [],
        resultStatus: "pending",
      } : {
        id: `new-section-${Date.now()}`,
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
      return [...current, draft];
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
          {sections.map((section, index) => (
            <SectionCard
              index={index}
              key={section.id}
              onCopy={handleCopySection}
              onDelete={handleDeleteSection}
              project={project}
              section={section}
            />
          ))}
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
    updateSceneBlocks((current) => [
      ...current,
      {
        id: `${activeSection.id}-local-block-${current.length + 1}`,
        source: "本地",
        title: `本地补充块 ${current.length + 1}`,
        text: "补充这一小节的造型、动作或画面约束。",
      },
    ]);
  }

  function handleImportPresetBlock() {
    if (!importedPreset) return;
    updateSceneBlocks((current) => [
      ...current,
      {
        id: `${activeSection.id}-preset-block-${importedPreset.id}-${current.length + 1}`,
        source: "预制",
        title: importedPreset.title,
        text: importedPreset.sceneDescriptionText,
      },
    ]);
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
  const [previewReference, setPreviewReference] = useState<ReferenceCandidate | null>(referenceSourceTree[0]?.items[0] ?? null);
  const [generationFormState, setGenerationForm] = useState(() => ({
    projectId: project?.id ?? null,
    sectionId: section?.id ?? null,
    supplementalPrompt: DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT,
    taskType: "训练集图片生成",
  }));
  const [generationTaskDraft, setGenerationTaskDraft] = useState<{
    finalInput: string;
    referenceTitle: string;
    sectionTitle: string;
    supplementalPrompt: string;
    taskType: string;
  } | null>(null);
  const activePreviewReference = previewReference ?? referenceSourceTree[0]?.items[0] ?? null;

  if (!project || !section) return <EmptyPage title="没有生成任务上下文" />;
  const activeProject = project;
  const activeSection = section;
  const generationForm = generationFormState.projectId === activeProject.id && generationFormState.sectionId === activeSection.id ? generationFormState : {
    projectId: activeProject.id,
    sectionId: activeSection.id,
    supplementalPrompt: DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT,
    taskType: "训练集图片生成",
  };
  const sectionTitle = activeSection.title;
  const finalInputText = [activeProject.usagePrompt, activeSection.resolvedScene, generationForm.supplementalPrompt]
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

  function handleQueueGenerationTask() {
    setGenerationTaskDraft({
      finalInput: finalInputText,
      referenceTitle: activePreviewReference?.title ?? "未选择引用",
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
            onPreviewReference={setPreviewReference}
          />
        </Panel>
        <Panel title="任务内容">
          <div className={s.formStack}>
            <FloatingSelect label="任务类型" value={generationForm.taskType} options={["训练集图片生成", "角色描述生成", "caption 补全"]} onChange={(value) => handleUpdateGenerationForm("taskType", value)} />
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
            <div><dt>当前引用</dt><dd>{generationTaskDraft.referenceTitle}</dd></div>
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
  const [resultState, setLocalResults] = useState(() => ({
    projectId: project?.id ?? null,
    results: project?.resultPool ?? [],
  }));
  const localResults = resultState.projectId === project?.id ? resultState.results : project?.resultPool ?? [];
  if (!project) return <EmptyPage title="没有训练结果池数据" />;
  const activeProject = project;
  const results = filter === "all" ? localResults : localResults.filter((result) => result.reviewStatus === filter);

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
  }

  function handleKeepVisibleResults() {
    const visibleIds = new Set(results.map((result) => result.id));
    updateLocalResults((current) => current.map((result) =>
      visibleIds.has(result.id) ? { ...result, reviewStatus: "kept" } : result,
    ));
  }

  return (
    <div className={s.page}>
      <ProjectHeader active="results" project={project} actions={<Button icon={Check} tone="primary" onClick={handleKeepVisibleResults} feedback={{ title: "已保留当前筛选图片" }}>批量保留</Button>} />
      <Panel title="结果池" subtitle="pending / kept / rejected 都在项目级结果池审查，caption 摘要随图片一起处理。">
        <div className={s.stack}>
          <SegmentedControl
            ariaLabel="筛选训练结果"
            role="tablist"
            items={RESULT_FILTER_ITEMS.map((item) => ({ ...item, count: item.value === "all" ? localResults.length : localResults.filter((result) => result.reviewStatus === item.value).length }))}
            value={filter}
            onChange={setFilter}
          />
          <TrainingResultGrid onReviewStatusChange={handleReviewResult} results={results} title="结果池" />
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
        <Panel title="Readiness" subtitle="只有 kept 图片进入冻结版本，后续编辑不会回写已冻结 revision。">
          <StatGrid project={project} />
        </Panel>
        <Panel title="冻结版本">
          <div className={s.entityRows}>
            {project.datasetRevisions.map((revision) => (
              <Link className={s.entityRow} href={demoHref(`/training/projects/${project.id}/dataset/revisions/${revision.id}`)} key={revision.id}>
                <div>
                  <strong>{revision.version}</strong>
                  <span>{revision.itemCount} 张 · 缺 caption {revision.captionMissingCount} · {revision.manifestName}</span>
                </div>
                <StatusBadge status={revision.status} label={revision.status === "ready" ? "可训练" : revision.status === "draft" ? "草稿" : "训练中"} />
              </Link>
            ))}
          </div>
        </Panel>
      </div>
      {trainingDraft ? (
        <Panel title="训练配置草稿" subtitle="基于当前数据集版本生成，可继续调整结果池和数据集后更新。">
          <dl className={s.trainingDraft}>
            <div><dt>数据集版本</dt><dd>{trainingDraft.version}</dd></div>
            <div><dt>Kept 图片</dt><dd>{trainingDraft.keptCount} 张</dd></div>
            <div><dt>缺 caption</dt><dd>{trainingDraft.captionMissingCount}</dd></div>
            <div><dt>训练步数</dt><dd>{trainingDraft.stepCount}</dd></div>
          </dl>
        </Panel>
      ) : null}
      <Panel title="Kept 草稿">
        <TrainingResultGrid results={project.resultPool.filter((result) => result.reviewStatus === "kept")} title="Kept 草稿" />
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
            <div><dt>缺 caption</dt><dd>{revision.captionMissingCount}</dd></div>
            <div><dt>Manifest</dt><dd>{revision.manifestName}</dd></div>
          </dl>
        </Panel>
        <Panel title="关联训练">
          <RunRows project={project} runs={relatedRuns} />
        </Panel>
      </div>
      <Panel title="Snapshot 样本与 caption">
        <TrainingResultGrid results={revisionResults} title={`${revision.version} snapshot`} />
      </Panel>
      <Panel title="Manifest 清单">
        <ol className={s.manifestList}>
          {revision.manifestRows.map((row) => <li key={row}>{row}</li>)}
        </ol>
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

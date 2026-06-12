"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Archive,
  Check,
  CopyPlus,
  FileText,
  GripVertical,
  ImagePlus,
  Layers,
  Play,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import type { DemoData } from "../../data";
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
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingImageResult, LoraTrainingProject, LoraTrainingReferenceImage, LoraTrainingRun, LoraTrainingSection, LoraTrainingTaskKind, LoraTrainingTaskStatus } from "./types";
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
  results,
  title = "训练结果",
}: {
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
              <Button icon={Check} feedback={{ title: "图片已加入保留队列", detail: activeResult.sourceLabel }}>保留</Button>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "图片已加入拒绝队列", detail: activeResult.sourceLabel }}>拒绝</Button>
            </>
          )}
        />
      ) : null}
    </>
  );
}

function RunRows({ runs }: { runs: LoraTrainingRun[] }) {
  if (runs.length === 0) return <div className={s.emptyInline}>没有任务记录</div>;

  return (
    <div className={s.entityRows}>
      {runs.map((run) => {
        const type = run.kind === "generation" ? "generation" : "training";
        return (
          <Link className={s.entityRow} href={demoHref(`/training/runs/${type}/${run.id}`)} key={run.id}>
            <div>
              <strong>{run.title}</strong>
              <span>{run.summary} · {run.timestamp}</span>
            </div>
            <StatusBadge status={run.status === "completed" ? "done" : run.status} label={run.status === "completed" ? "完成" : run.status === "running" ? "进行中" : run.status === "queued" ? "排队" : "失败"} />
          </Link>
        );
      })}
    </div>
  );
}

export function LoraTrainingProjectFormPage({ data }: { data: DemoData }) {
  const training = useTraining(data);

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/projects", label: "返回训练项目" }}
        eyebrow="LoRA 训练"
        title="新建训练项目"
        subtitle="选择模板、填写角色资料，并创建初始小节。模板只作为 seed，创建后不会 live 回写。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "训练项目已创建", detail: "后续接入 POST /api/training/projects" }}>创建项目</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="项目基础信息">
          <div className={s.formStack}>
            <Field label="项目名称" value="新角色 LoRA 项目" />
            <FloatingSelect label="从模板创建" value={training.templates[0]?.title ?? "不使用模板"} options={["不使用模板", ...training.templates.map((template) => template.title)]} />
            <Field multiline features={{ resize: true, clipboard: true }} label="角色使用提示词" value="角色触发词、服装和稳定身份描述。" />
            <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value="发型、眼睛、服装材质、常见构图和需要避免的变化。" />
          </div>
        </Panel>
        <Panel title="初始小节">
          <div className={s.entityRows}>
            {training.templates[0]?.sections.map((section) => (
              <div className={s.entityRow} key={section.id}>
                <div>
                  <strong>{section.title}</strong>
                  <span>{section.blockCount} 个场景块 · {section.scenePreview}</span>
                </div>
                <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingProjectDetailPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const training = useTraining(data);
  const project = findProject(data, projectId);
  if (!project) return <EmptyPage title="没有训练项目数据" />;
  const recentRuns = training.runs.filter((run) => run.projectId === project.id).slice(0, 4);
  const recentResults = project.resultPool.filter((result) => result.reviewStatus === "kept").slice(0, 4);
  const latestRevision = project.datasetRevisions[0];

  return (
    <div className={s.page}>
      <ProjectHeader
        active="overview"
        project={project}
        actions={(
          <>
            <ButtonLink href={`/training/projects/${project.id}/dataset`} icon={Play} tone="primary">启动训练</ButtonLink>
            <Button icon={CopyPlus} feedback={{ title: "保存为模板入口已预览", detail: project.title }}>保存为模板</Button>
            <Button tone="danger" icon={Archive} feedback={{ tone: "warning", title: "归档项目需要确认", detail: project.title }}>归档</Button>
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
          <RunRows runs={recentRuns} />
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
  if (!project) return <EmptyPage title="没有角色资料数据" />;

  return (
    <div className={s.page}>
      <ProjectHeader active="profile" project={project} actions={<Button tone="primary" icon={Save} feedback="角色资料已保存">保存资料</Button>} />
      <div className={s.twoCol}>
        <Panel title="角色文本">
          <div className={s.formStack}>
            <Field multiline features={{ resize: true, clipboard: true }} label="LoRA 使用提示词" value={project.usagePrompt} />
            <Field multiline features={{ resize: true, clipboard: true }} label="角色细节描述" value={project.detailPrompt} />
            <Field multiline features={{ resize: true, clipboard: true }} label="资料备注" value={project.profileSummary} />
          </div>
        </Panel>
        <Panel title="参考图" subtitle="original / generated / auxiliary 都作为自由参考图管理，不做 fixed slots。">
          <div className={s.stack}>
            <div className={s.referenceImageGrid}>
              {project.referenceImages.map((reference) => (
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
            <Button icon={ImagePlus} feedback={{ title: "上传参考图入口已预览", detail: project.title }}>上传参考图</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SectionCard({ index, project, section }: { index: number; project: LoraTrainingProject; section: LoraTrainingSection }) {
  return (
    <article className={s.sectionCard}>
      <Button className={s.dragHandle} icon={GripVertical} iconOnly tone="subtle" ariaLabel={`拖拽排序小节：${section.title}`} />
      <div className={s.sectionCardMain}>
        <div className={s.sectionCardHeader}>
          <Link href={demoHref(`/training/projects/${project.id}/sections/${section.id}`)}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.title}</strong>
          </Link>
          <StatusBadge status={section.enabled ? "ready" : "draft"} label={section.enabled ? "启用" : "停用"} />
        </div>
        <Link className={s.sectionImages} href={demoHref(`/training/projects/${project.id}/sections/${section.id}`)}>
          <ImageListSmall images={section.images} limit={section.images.length} showCounts wide />
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
  if (!project) return <EmptyPage title="没有训练小节数据" />;

  return (
    <div className={s.page}>
      <ProjectHeader active="sections" project={project} actions={<Button icon={Plus} tone="primary" feedback={{ title: "新建小节入口已预览" }}>新建小节</Button>} />
      <div className={s.sectionGrid}>
        {project.sections.map((section, index) => <SectionCard index={index} key={section.id} project={project} section={section} />)}
      </div>
    </div>
  );
}

export function LoraTrainingProjectSectionDetailPage({ data, projectId, sectionId }: { data: DemoData; projectId?: string; sectionId?: string }) {
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  if (!project || !section) return <EmptyPage title="没有训练小节详情" />;

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${project.title} / ${section.title}`}
        actions={<ButtonLink href={`/training/projects/${project.id}/sections/${section.id}/generation-tasks/new`} icon={ImagePlus} tone="primary">生成样本</ButtonLink>}
      />
      <div className={s.twoCol}>
        <Panel title="场景块">
          <div className={s.entityRows}>
            {section.blocks.map((block) => (
              <div className={s.entityRow} key={block.id}>
                <div>
                  <strong>{block.title}</strong>
                  <span>{block.source} · {block.text}</span>
                </div>
                <Button icon={Trash2} iconOnly size="sm" tone="danger" ariaLabel={`移除场景块：${block.title}`} feedback={{ tone: "warning", title: "移除场景块需要确认", detail: block.title }} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="合成预览">
          <div className={s.formStack}>
            <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={section.resolvedScene} />
            <Field readOnly multiline features={{ clipboard: true }} label="图片提示词" value={section.imagePrompt} />
          </div>
        </Panel>
      </div>
      <Panel title="小节结果">
        <TrainingResultGrid results={project.resultPool.filter((result) => result.sectionId === section.id)} title={`${section.title} 结果`} />
      </Panel>
    </div>
  );
}

export function LoraTrainingGenerationComposePage({ data, projectId, sectionId }: { data: DemoData; projectId?: string; sectionId?: string }) {
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  if (!project || !section) return <EmptyPage title="没有生成任务上下文" />;

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${section.title} / 新建生成任务`}
        subtitle="显式选择引用，补充提示词和图片附件，预览最终输入后再运行。"
        actions={<Button tone="primary" icon={Play} feedback={{ title: "生成任务已加入队列", detail: section.title }}>运行生成</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="引用源">
          <div className={s.entityRows}>
            <div className={s.entityRow}><div><strong>角色资料</strong><span>{project.usagePrompt}</span></div><StatusBadge status="ready" label="已选" /></div>
            <div className={s.entityRow}><div><strong>小节场景</strong><span>{section.resolvedScene}</span></div><StatusBadge status="ready" label="已选" /></div>
            <div className={s.entityRow}><div><strong>参考图</strong><span>{project.images.slice(0, 3).length} 张候选，点击只预览，需显式添加。</span></div><Button size="sm" icon={Plus}>添加</Button></div>
          </div>
        </Panel>
        <Panel title="任务内容">
          <div className={s.formStack}>
            <FloatingSelect label="任务类型" value="训练集图片生成" options={["训练集图片生成", "角色描述生成", "caption 补全"]} />
            <Field multiline features={{ resize: true, clipboard: true }} label="补充提示词" value="保持角色正面可训练，避免复杂遮挡和多人构图。" />
            <Field readOnly multiline features={{ clipboard: true }} label="最终输入预览" value={`${project.usagePrompt}\n${section.resolvedScene}\n保持角色身份稳定，生成 1 张干净训练样本。`} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function LoraTrainingProjectResultsPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  const [filter, setFilter] = useState<TrainingResultFilter>("all");
  if (!project) return <EmptyPage title="没有训练结果池数据" />;
  const results = filter === "all" ? project.resultPool : project.resultPool.filter((result) => result.reviewStatus === filter);

  return (
    <div className={s.page}>
      <ProjectHeader active="results" project={project} actions={<Button icon={Check} tone="primary" feedback={{ title: "已保留所选图片" }}>批量保留</Button>} />
      <Panel title="结果池" subtitle="pending / kept / rejected 都在项目级结果池审查，caption 摘要随图片一起处理。">
        <div className={s.stack}>
          <SegmentedControl
            ariaLabel="筛选训练结果"
            role="tablist"
            items={RESULT_FILTER_ITEMS.map((item) => ({ ...item, count: item.value === "all" ? project.resultPool.length : project.resultPool.filter((result) => result.reviewStatus === item.value).length }))}
            value={filter}
            onChange={setFilter}
          />
          <TrainingResultGrid results={results} title="结果池" />
        </div>
      </Panel>
    </div>
  );
}

export function LoraTrainingProjectDatasetPage({ data, projectId }: { data: DemoData; projectId?: string }) {
  const project = findProject(data, projectId);
  if (!project) return <EmptyPage title="没有训练数据集数据" />;

  return (
    <div className={s.page}>
      <ProjectHeader active="dataset" project={project} actions={<Button tone="primary" icon={Play} feedback={{ title: "启动训练配置已打开", detail: project.datasetVersion }}>启动训练</Button>} />
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
          <RunRows runs={relatedRuns} />
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
  if (!project) return <EmptyPage title="没有项目任务数据" />;
  const projectRuns = training.runs.filter((run) => run.projectId === project.id && run.kind === kind);
  const visibleRuns = projectRuns.filter((run) => run.status === status);

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
        <RunRows runs={visibleRuns} />
      </Panel>
    </div>
  );
}

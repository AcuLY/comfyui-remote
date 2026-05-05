"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Archive, ArrowLeft, ArrowRight, Check, CheckSquare, ChevronDown, ChevronUp, Copy, Download, Edit3, Eye, GripVertical, ImageIcon, ListChecks, Play, Plus, Rows3, Save, SlidersHorizontal, Square, Star, Trash2 } from "lucide-react";

import type { DemoData, DemoImage, DemoProject, DemoSection } from "./design-demo-data";
import s from "./design-demo.module.css";
import { Button, ButtonLink, DemoTabs, EmptyPage, Field, ImageGrid, ImageStrip, OperationStateStrip, PageHeader, Panel, SelectLike, StatusBadge, SwitchRow, TextAreaField } from "./design-demo-ui";
import { compactFileName, cx, demoHref, filterImages, projectPresetSummary, rawSectionId, sectionAnchorId, sectionRunStatus, selectionToggleLabel } from "./design-demo-utils";
import type { ProjectCardView, ResultDemoFilter, SectionNavMode } from "./design-demo-utils";
import { QueuePage } from "./runs-page";
export function RootPage({ data }: { data: DemoData }) {
  return <QueuePage data={data} />;
}

export function ProjectsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title="项目列表"
        subtitle={`${data.projects.length} 个项目 · ${data.metrics.sections} 个小节`}
        actions={<ButtonLink href="/projects/new" tone="primary" icon={Plus}>创建项目</ButtonLink>}
      />
      <div className={s.projectListGrid}>
        {data.projects.map((project) => (
          <Link className={cx(s.card, s.projectListCard)} href={demoHref(`/projects/${project.id}`)} key={project.id}>
            <ImageStrip images={project.images} />
            <div className={s.cardHeader}>
                <div className={s.projectCardTitle}>
                  <strong>{project.title}</strong>
                  <span>{projectPresetSummary(project)}</span>
                </div>
              <StatusBadge status={project.status} />
            </div>
            <div className={s.projectCardStats}>
              <span className={s.badge}>{project.sectionCount} 小节</span>
              <span className={s.badge}>{compactFileName(project.checkpointName)}</span>
            </div>
            <div className={cx(s.small, s.faint)}>更新：{project.updatedAt}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProjectDetailPage({
  project,
  initialView = "sections",
}: {
  project: DemoProject | undefined;
  initialView?: ProjectCardView;
}) {
  const [compact, setCompact] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  if (!project) return <EmptyPage title="没有项目数据" />;
  const sections = project.sections;
  const projectImages = sections.flatMap((section) => section.images);
  const isResultView = initialView === "results";
  const allSelected = selectedIds.size === sections.length && sections.length > 0;

  function toggleSectionSelection(sectionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function toggleAllSections() {
    setSelectedIds((current) => (
      current.size === sections.length
        ? new Set()
        : new Set(sections.map((section) => section.id))
    ));
  }

  function toggleCollapsed(sectionId: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/projects", label: "返回项目列表" }}
        eyebrow="项目"
        title={project.title}
        subtitle={project.notes || `${project.sectionCount} 个小节`}
        actions={
          <>
            <ButtonLink href={`/projects/${project.id}/edit`} icon={Edit3}>编辑</ButtonLink>
            <ButtonLink href={`/projects/${project.id}/batch-create`} tone="primary" icon={Rows3}>批量创建</ButtonLink>
          </>
        }
      />
      {!isResultView ? <ProjectActionStrip project={project} selectedCount={selectedIds.size} /> : null}
      <ProjectSectionShell project={project} mode={isResultView ? "project-results" : "detail"}>
        <div className={s.sectionContentGrid}>
          <div className={s.projectSectionToolbar}>
            <div>
              <strong>{isResultView ? "小节结果" : "小节配置"}</strong>
              <span>
                {isResultView
                  ? `${projectImages.length} 张图片 · ${projectImages.filter((image) => image.status === "pending").length} 张待审`
                  : `${sections.length} 个小节 · ${selectedIds.size} 个已选`}
              </span>
            </div>
            <div className={s.toolbar}>
              <ProjectViewToggle projectId={project.id} value={initialView} />
              {isResultView ? (
                <DemoTabs
                  tabs={[
                    { key: "all", label: "全部", count: projectImages.length },
                    { key: "pending", label: "待审", count: projectImages.filter((image) => image.status === "pending").length },
                    { key: "kept", label: "保留", count: projectImages.filter((image) => image.status === "kept").length },
                    { key: "pstation", label: "p站", count: projectImages.filter((image) => image.featured).length },
                    { key: "preview", label: "预览", count: projectImages.filter((image) => image.featured2).length },
                    { key: "cover", label: "封面", count: projectImages.filter((image) => image.cover).length },
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              ) : (
                <>
                  <Button tone="subtle" pressed={allSelected} onClick={toggleAllSections} icon={allSelected ? CheckSquare : Square}>
                    {selectionToggleLabel(selectedIds.size, sections.length)}
                  </Button>
                  <Button tone="subtle" pressed={compact} onClick={() => setCompact((value) => !value)} icon={ListChecks}>
                    {compact ? "标准" : "紧凑"}
                  </Button>
                  {selectedIds.size > 0 ? (
                    <>
                      <Button icon={Play} feedback={{ title: "批量运行已加入任务", detail: `${selectedIds.size} 个小节` }}>批量运行</Button>
                      <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "批量删除需要确认", detail: `${selectedIds.size} 个小节` }}>批量删除</Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div className={cx(s.sectionCardList, compact && !isResultView && s.sectionCardListCompact)}>
            {sections.map((section, index) => (
              isResultView ? (
                <ProjectSectionResultCard
                  collapsed={collapsedSections.has(section.id)}
                  images={filterImages(section.images, filter)}
                  index={index}
                  key={section.id}
                  onToggleCollapsed={() => toggleCollapsed(section.id)}
                  project={project}
                  section={section}
                  totalCount={section.images.length}
                />
              ) : (
                <ProjectSectionCard
                  compact={compact}
                  index={index}
                  key={section.id}
                  project={project}
                  section={section}
                  selected={selectedIds.has(section.id)}
                  onToggleSelection={() => toggleSectionSelection(section.id)}
                />
              )
            ))}
          </div>
        </div>
      </ProjectSectionShell>
    </div>
  );
}

function ProjectViewToggle({ projectId, value }: { projectId: string; value: ProjectCardView }) {
  return (
    <div className={cx(s.segmented, s.projectViewToggle)} aria-label="项目视图">
      <Link
        aria-current={value === "sections" ? "page" : undefined}
        className={cx(s.segment, value === "sections" && s.segmentActive)}
        href={demoHref(`/projects/${projectId}`)}
      >
        小节
      </Link>
      <Link
        aria-current={value === "results" ? "page" : undefined}
        className={cx(s.segment, value === "results" && s.segmentActive)}
        href={demoHref(`/projects/${projectId}/results`)}
      >
        结果
      </Link>
    </div>
  );
}

function ProjectActionStrip({ project, selectedCount }: { project: DemoProject; selectedCount: number }) {
  return (
    <section className={s.projectActionStrip} aria-label="项目操作">
      <div className={s.projectActionMain}>
        <div>
          <strong>项目操作</strong>
          <span>{project.sectionCount} 小节 · {selectedCount ? `${selectedCount} 个已选` : "未选择小节"}</span>
        </div>
        <div className={s.batchQuickFill} aria-label="批量张数快捷值">
          <span>批量张数</span>
          {[1, 2, 4, 8, 16].map((value) => (
            <button type="button" key={value}>{value}</button>
          ))}
        </div>
      </div>
      <div className={s.projectActionButtons}>
        <Button icon={Play} feedback={{ title: "整组运行已加入任务", detail: `${project.sectionCount} 个小节` }}>整组运行</Button>
        <Button icon={Download} feedback={{ title: "导入模板面板已准备" }}>导入模板</Button>
        <Button icon={ImageIcon} feedback={{ title: "图片整合已加入导出队列" }}>图片整合</Button>
        <Button icon={Save} feedback={{ title: "已保存为项目模板", detail: "使用当前小节结构和参数。" }}>保存模板</Button>
      </div>
      <OperationStateStrip
        items={[
          { label: "保存队列", value: "空", tone: "success" },
          { label: "排序", value: "释放后保存", tone: "info" },
          { label: "错误", value: "0", tone: "success" },
        ]}
      />
    </section>
  );
}

function ProjectSectionCard({
  compact,
  index,
  project,
  section,
  selected,
  onToggleSelection,
}: {
  compact: boolean;
  index: number;
  project: DemoProject;
  section: DemoSection;
  selected: boolean;
  onToggleSelection: () => void;
}) {
  const runStatus = sectionRunStatus(section, index);
  const pendingCount = section.images.filter((image) => image.status === "pending").length;
  const featuredCount = section.images.filter((image) => image.featured || image.featured2).length;

  return (
    <article
      className={cx(s.sectionCard, compact && s.sectionCardCompact, selected && s.sectionCardSelected)}
      data-section-card={section.id}
      id={sectionAnchorId(section)}
    >
      <div className={s.sectionCardMain}>
        <button className={s.dragHandle} type="button" aria-label="排序手柄">
          <GripVertical className={s.icon} />
        </button>
        <button
          aria-pressed={selected}
          className={s.sectionSelectButton}
          type="button"
          onClick={onToggleSelection}
        >
          {selected ? <CheckSquare className={s.icon} /> : <Square className={s.icon} />}
        </button>
        <Link className={s.sectionCardContent} href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`)}>
          <div className={s.sectionCardHeader}>
            <div className={s.sectionCardTitle}>
              <div className={s.sectionCardTitleLine}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{section.name}</strong>
              </div>
              <p>{section.aspectRatio} · 批量 {section.batchSize} · {section.shortSidePx}px · {section.promptBlockCount} 块</p>
            </div>
            <StatusBadge status={runStatus.status} label={runStatus.label} />
          </div>
          <div className={s.sectionCardBody}>
            {!compact ? <ImageStrip images={section.images} wide /> : null}
            <div className={s.sectionMetaGrid}>
              <span>{section.loraCount} LoRA</span>
              <span>{section.seedPolicy1} / {section.seedPolicy2}</span>
              <span>{pendingCount} 待审</span>
              <span>{featuredCount} p站/预览</span>
            </div>
          </div>
        </Link>
      </div>
      <div className={s.sectionCardActions}>
        <Button icon={Play} feedback={{ title: "小节运行已加入任务", detail: section.name }}>运行</Button>
        <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}`} icon={SlidersHorizontal}>编辑</ButtonLink>
        <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>结果</ButtonLink>
        <Button tone="subtle" icon={Copy} feedback={{ title: "小节已复制", detail: section.name }}>复制</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.name }}>删除</Button>
      </div>
    </article>
  );
}

function sectionNavHref(project: DemoProject, section: DemoSection, mode: SectionNavMode) {
  if (mode === "detail") return `${demoHref(`/projects/${project.id}`)}#${sectionAnchorId(section)}`;
  if (mode === "project-results") return `${demoHref(`/projects/${project.id}/results`)}#${sectionAnchorId(section)}`;
  if (mode === "section-results") return demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}/results`);
  return demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}`);
}

export function ProjectSectionShell({
  project,
  activeSection,
  mode,
  children,
}: {
  project: DemoProject;
  activeSection?: DemoSection;
  mode: SectionNavMode;
  children: React.ReactNode;
}) {
  const defaultActiveSectionId = activeSection?.id ?? project.sections[0]?.id ?? null;
  const [activeSectionState, setActiveSectionState] = useState({
    projectId: project.id,
    sectionId: defaultActiveSectionId,
  });
  const activeSectionId = activeSectionState.projectId === project.id ? activeSectionState.sectionId : defaultActiveSectionId;
  const displayedActiveSectionId =
    (mode === "editor" || mode === "section-results") && activeSection
      ? activeSection.id
      : activeSectionId ?? defaultActiveSectionId;
  const contentRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const syncSourceRef = useRef<"content" | "rail" | null>(null);
  const unlockTimerRef = useRef<number | null>(null);

  const syncScroll = useCallback((source: "content" | "rail", targetTop: number) => {
    syncSourceRef.current = source;
    const target = source === "content" ? railRef.current : contentRef.current;
    if (target) target.scrollTop = targetTop;
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    unlockTimerRef.current = window.setTimeout(() => {
      syncSourceRef.current = null;
      unlockTimerRef.current = null;
    }, 120);
  }, []);

  useEffect(() => {
    const contentElement = contentRef.current;
    const railElement = railRef.current;
    if (!contentElement || !railElement) return;
    const contentNode = contentElement;
    const railNode = railElement;

    function progress(element: HTMLElement) {
      const max = Math.max(element.scrollHeight - element.clientHeight, 0);
      return max === 0 ? 0 : element.scrollTop / max;
    }

    function maxTop(element: HTMLElement) {
      return Math.max(element.scrollHeight - element.clientHeight, 0);
    }

    function handleContentScroll() {
      if (syncSourceRef.current === "rail") return;
      syncScroll("content", progress(contentNode) * maxTop(railNode));

      const cards = Array.from(contentNode.querySelectorAll<HTMLElement>("[data-section-card]"));
      const containerTop = contentNode.getBoundingClientRect().top;
      let nextId = cards[0]?.dataset.sectionCard ?? null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const card of cards) {
        const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 8);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextId = card.dataset.sectionCard ?? nextId;
        }
      }
      if (nextId) setActiveSectionState({ projectId: project.id, sectionId: nextId });
    }

    function handleRailScroll() {
      if (syncSourceRef.current === "content") return;
      syncScroll("rail", progress(railNode) * maxTop(contentNode));
    }

    contentNode.addEventListener("scroll", handleContentScroll, { passive: true });
    railNode.addEventListener("scroll", handleRailScroll, { passive: true });
    handleContentScroll();

    return () => {
      contentNode.removeEventListener("scroll", handleContentScroll);
      railNode.removeEventListener("scroll", handleRailScroll);
      if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current);
    };
  }, [project.id, syncScroll]);

  function handleNavigateSection(section: DemoSection) {
    setActiveSectionState({ projectId: project.id, sectionId: section.id });
    if (mode !== "detail" && mode !== "project-results") return;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`#${CSS.escape(sectionAnchorId(section))}`);
    if (!content || !target) return;
    const targetTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTop = targetTop;
  }

  return (
    <div className={s.projectSectionShell}>
      <div className={s.projectScrollPane} ref={contentRef}>
        {children}
      </div>
      <SectionRail
        ref={railRef}
        project={project}
        activeSectionId={displayedActiveSectionId}
        mode={mode}
        onNavigateSection={handleNavigateSection}
      />
    </div>
  );
}

const SectionRail = forwardRef<HTMLElement, {
  project: DemoProject;
  activeSection?: DemoSection;
  activeSectionId?: string | null;
  mode?: SectionNavMode;
  onNavigateSection?: (section: DemoSection) => void;
}>(function SectionRail(
  {
    project,
    activeSection,
    activeSectionId,
    mode = "editor",
    onNavigateSection,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? activeSection?.id ?? project.sections[0]?.id ?? null;
  return (
    <nav className={s.sectionRail} ref={ref} aria-label="小节导航">
      <div className={s.railHeading}>
        <strong>小节导航</strong>
        <span>{project.sections.length} 小节</span>
      </div>
      {project.sections.map((section) => (
        <Link
          className={cx(s.railItem, resolvedActiveId === section.id && s.railItemActive)}
          href={sectionNavHref(project, section, mode)}
          key={section.id}
          onClick={(event) => {
            if (mode === "detail" || mode === "project-results") {
              event.preventDefault();
            }
            onNavigateSection?.(section);
          }}
        >
          <strong>{section.name}</strong>
          <span className={cx(s.small, s.muted)}>批量 {section.batchSize}</span>
        </Link>
      ))}
    </nav>
  );
});

export function ProjectFormPage({ project, mode }: { project?: DemoProject; mode: "new" | "edit" }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title={mode === "new" ? "创建新项目" : `编辑项目：${project?.title ?? "项目"}`}
        subtitle="基础信息、预设绑定、默认参数和小节种子策略。"
        actions={<Button tone="primary" icon={Save}>{mode === "new" ? "创建" : "保存"}</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="基础信息">
          <div className={s.grid}>
            <div className={s.fieldGrid}>
              <Field label="项目名称" value={project?.title ?? "新图像项目"} />
              <Field label="Slug" value={project?.slug ?? "new-project"} />
              <SelectLike label="状态" value={project?.status ?? "draft"} />
              <SelectLike label="Checkpoint" value={project?.checkpointName ?? "继承默认模型"} />
            </div>
            <TextAreaField label="备注" value={project?.notes || "项目级说明、输出目标和人工备注。"} />
          </div>
        </Panel>
        <Panel title="默认运行参数">
          <div className={s.grid}>
            <SwitchRow title="继承模板参数" subtitle="创建小节时自动填充模板默认值。" />
            <div className={s.fieldGrid}>
              <Field label="默认比例" value="2:3" />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={2} />
              <Field label="放大倍率" value="2x" />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProjectSectionResultCard({
  collapsed,
  images,
  index,
  onToggleCollapsed,
  project,
  section,
  totalCount,
}: {
  collapsed: boolean;
  images: DemoImage[];
  index: number;
  onToggleCollapsed: () => void;
  project: DemoProject;
  section: DemoSection;
  totalCount: number;
}) {
  const visibleImages = collapsed ? images.slice(0, 4) : images;
  const pendingCount = images.filter((image) => image.status === "pending").length;
  const keptCount = images.filter((image) => image.status === "kept").length;
  const featuredCount = images.filter((image) => image.featured || image.featured2).length;
  const canCollapse = images.length > 4;

  return (
    <section className={s.resultSectionBlock} data-section-card={section.id} id={sectionAnchorId(section)}>
      <div className={s.resultSectionHeader}>
        <div className={s.resultSectionTitle}>
          <div className={s.sectionCardTitleLine}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.name}</strong>
          </div>
          <span>{images.length} / {totalCount} 张 · {section.aspectRatio} · 批量 {section.batchSize}</span>
        </div>
        <div className={s.resultSectionActions}>
          <span className={s.badge}>{pendingCount} 待审</span>
          <span className={s.badge}>{keptCount} 保留</span>
          <span className={s.badge}>{featuredCount} p站/预览</span>
          {canCollapse ? (
            <Button tone="subtle" icon={collapsed ? ChevronDown : ChevronUp} onClick={onToggleCollapsed}>
              {collapsed ? "展开" : "折叠"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className={s.resultActionBar}>
        <Button tone="subtle" icon={Square}>选择本节</Button>
        <Button icon={Check} feedback={{ title: "本节图片已加入保留队列" }}>保留</Button>
        <Button tone="pink" icon={Star} feedback={{ title: "本节图片已加入 p站 标记队列" }}>p站</Button>
        <Button tone="pink" icon={Eye} feedback={{ title: "本节图片已加入预览标记队列" }}>预览</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "本节图片已加入删除队列" }}>删除</Button>
        <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近结果操作已撤销" }}>撤销</Button>
        <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} tone="subtle" icon={ImageIcon}>小节结果</ButtonLink>
      </div>
      <ImageGrid images={visibleImages} />
    </section>
  );
}

// Kept while the routed section editor is being migrated into section-editor-page.tsx.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionEditorPage({ project, section }: { project: DemoProject | undefined; section: DemoSection | undefined }) {
  if (!project || !section) return <EmptyPage title="没有小节数据" />;
  const sectionIndex = project.sections.findIndex((item) => item.id === section.id);
  const previousSection = sectionIndex > 0 ? project.sections[sectionIndex - 1] : null;
  const nextSection = sectionIndex >= 0 && sectionIndex < project.sections.length - 1 ? project.sections[sectionIndex + 1] : null;
  const bindingNames = project.presetNames.length > 0 ? project.presetNames.slice(0, 3) : [project.title];
  const promptBlocks = Array.from({ length: Math.max(2, Math.min(section.promptBlockCount, 4)) }, (_, index) => ({
    id: `${section.id}-prompt-${index}`,
    label: index === 0 ? "主体" : index === 1 ? "风格" : index === 2 ? "场景" : "补充",
    positive: index === 0 ? section.positivePrompt : `${bindingNames[index % bindingNames.length]} positive block`,
    negative: index === 0 ? section.negativePrompt : "low quality, bad anatomy, extra fingers",
  }));

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "返回项目" }}
        eyebrow="小节"
        title={`${project.title} / ${section.name}`}
        subtitle="维护参数表单、Prompt Block、LoRA 配置、运行和复制动作。"
        actions={
          <>
            <Button tone="primary" icon={Play}>运行小节</Button>
            <Button icon={Copy}>复制小节</Button>
          <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>结果</ButtonLink>
        </>
      }
      />
      <ProjectSectionShell project={project} activeSection={section} mode="editor">
        <div className={s.editorSurface}>
          {previousSection || nextSection ? (
            <div className={cx(s.editorStickyHeader, s.editorNavHeader)}>
              <div className={s.toolbar}>
                {previousSection ? (
                  <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(previousSection)}`} tone="subtle" icon={ArrowLeft}>
                    上一节
                  </ButtonLink>
                ) : null}
                {nextSection ? (
                  <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(nextSection)}`} tone="subtle" icon={ArrowRight}>
                    下一节
                  </ButtonLink>
                ) : null}
              </div>
            </div>
          ) : null}

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>运行参数</strong>
                <span>项目默认值可在项目参数页统一调整。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.fieldGrid}>
              <Field label="小节名" value={section.name} />
              <SelectLike label="比例" value={section.aspectRatio} />
              <Field label="短边像素" value={section.shortSidePx} />
              <Field label="批量数" value={section.batchSize} />
              <SelectLike label="Seed 1" value={section.seedPolicy1} />
              <SelectLike label="Seed 2" value={section.seedPolicy2} />
              <SelectLike label="Checkpoint" value={section.checkpointName || project.checkpointName} />
              <SelectLike label="Upscale" value="2x / Latent" />
            </div>
            <div className={s.editorStatusStrip}>
              <span>KSampler 1: 28 steps · CFG 7</span>
              <span>KSampler 2: 18 steps · CFG 5.5</span>
              <span>当前批量快捷值：1 / 2 / 4</span>
            </div>
            <OperationStateStrip
              items={[
                { label: "保存队列", value: "空", tone: "success" },
                { label: "上次保存", value: "刚刚", tone: "info" },
                { label: "校验", value: "通过", tone: "success" },
              ]}
            />
          </section>

          <section className={s.editorSplitBlock}>
            <div className={s.editorBlock}>
              <div className={s.editorBlockHeader}>
                <div>
                  <strong>预设绑定</strong>
                  <span>切换 variant 会同步 prompt block 与 LoRA 绑定。</span>
                </div>
                <Button icon={Plus}>导入预设</Button>
              </div>
              <div className={s.bindingList}>
                {bindingNames.map((name, index) => (
                  <div className={s.bindingRow} key={`${name}-${index}`}>
                    <div>
                      <strong>{name}</strong>
                      <span>{index + 1} 个 prompt block · {Math.max(1, section.loraCount - index)} 个 LoRA</span>
                    </div>
                    <SelectLike label="变体" value={index === 0 ? "默认" : "继承"} />
                    <Button tone="subtle" icon={Trash2}>移除</Button>
                  </div>
                ))}
              </div>
            </div>
            <aside className={s.editorAside}>
              <strong>最新结果</strong>
              <ImageStrip images={section.images.slice(0, 6)} wide />
              <div className={s.toolbar}>
                <Button tone="primary" icon={Play}>运行</Button>
                <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>查看结果</ButtonLink>
              </div>
            </aside>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Prompt Blocks</strong>
                <span>正向与反向提示词按 block 排序，支持独立编辑和删除。</span>
              </div>
              <Button icon={Plus}>添加 Block</Button>
            </div>
            <div className={s.promptBlockList}>
              {promptBlocks.map((block, index) => (
                <div className={s.promptBlockRow} key={block.id}>
                  <button className={s.dragHandle} type="button" aria-label="排序手柄">
                    <GripVertical className={s.icon} />
                  </button>
                  <div className={s.promptBlockContent}>
                    <div className={s.promptBlockTitle}>
                      <strong>{String(index + 1).padStart(2, "0")} · {block.label}</strong>
                      <span>preset block</span>
                    </div>
                    <div className={s.promptColumns}>
                      <TextAreaField label="正向" value={block.positive} />
                      <TextAreaField label="反向" value={block.negative} />
                    </div>
                  </div>
                  <Button tone="subtle" icon={Trash2}>删除</Button>
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>LoRA 配置</strong>
                <span>阶段 1 / 阶段 2 独立排序，触发词随权重和来源展示。</span>
              </div>
              <Button icon={Plus}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              {["LoRA 1", "LoRA 2"].map((stage, stageIndex) => (
                <div className={s.loraStage} key={stage}>
                  <strong>{stage}</strong>
                  {[0, 1].map((itemIndex) => (
                    <div className={s.loraRow} key={`${stage}-${itemIndex}`}>
                      <span>{bindingNames[(stageIndex + itemIndex) % bindingNames.length]}</span>
                      <em>weight {(0.65 + itemIndex * 0.15).toFixed(2)}</em>
                      <button type="button">触发词</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>导入预设</strong>
                <span>分类、文件夹、预设和预设组在同一面板里完成筛选。</span>
              </div>
              <Button tone="primary" icon={Plus}>追加到小节</Button>
            </div>
            <div className={s.importPresetLayout}>
              <div className={s.importCategoryColumn}>
                {["角色", "风格", "场景", "姿势"].map((name, index) => (
                  <button className={index === 0 ? s.importCategoryActive : ""} type="button" key={name}>
                    {name}
                  </button>
                ))}
              </div>
              <div className={s.importPresetColumn}>
                <div className={s.presetContextBar}>
                  <span className={s.badge}>根目录 / 角色</span>
                  <span className={s.badge}>搜索：{bindingNames[0]}</span>
                </div>
                {bindingNames.map((name, index) => (
                  <div className={s.contentRow} key={`import-${name}-${index}`}>
                    <div className={s.contentRowHeader}>
                      <div className={s.contentRowTitle}>
                        <strong>{name}</strong>
                        <span>{index + 2} variants · prompt + LoRA</span>
                      </div>
                      <Button tone="subtle" icon={Plus}>选择</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变更历史</strong>
                <span>按参数、Prompt、LoRA 三个维度显示最近 diff。</span>
              </div>
            </div>
            <div className={s.historyDiffList}>
              {["运行参数", "Prompt", "LoRA"].map((name, index) => (
                <div className={s.historyDiffRow} key={name}>
                  <strong>{name}</strong>
                  <span>{index + 1} 项变更 · {index === 0 ? "短边像素 640 → 768" : index === 1 ? "追加风格 block" : "权重 0.55 → 0.70"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ProjectSectionShell>
    </div>
  );
}

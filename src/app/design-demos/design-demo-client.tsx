"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  Database,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderTree,
  Gauge,
  GripVertical,
  History,
  Home,
  ImageIcon,
  Layers3,
  ListChecks,
  Lock,
  Monitor,
  Play,
  Plus,
  Rows3,
  Save,
  Search,
  Shuffle,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";

import type {
  DemoAsset,
  DemoCategory,
  DemoData,
  DemoImage,
  DemoPreset,
  DemoPresetGroup,
  DemoProject,
  DemoSection,
  DemoTemplate,
} from "./design-demo-data";
import s from "./design-demo.module.css";
import { QueuePage, ReviewPage } from "./runs-page";
import { DesignDemoShell } from "./design-demo-shell";
import {
  Button,
  ButtonLink,
  DemoTabs,
  EmptyPage,
  Field,
  ImageGrid,
  ImageStrip,
  OperationStateStrip,
  PageHeader,
  Panel,
  RouteTable,
  SelectLike,
  StatusBadge,
  SwitchRow,
  TextAreaField,
} from "./design-demo-ui";
import {
  assetKind,
  assetPath,
  batchImportFromGroup,
  batchImportFromPreset,
  batchItemKey,
  categoryColorValue,
  categoryHueValue,
  categoryItemCount,
  categorySlotPreview,
  categoryTypeLabel,
  compactFileName,
  cx,
  demoHref,
  entriesForPath,
  filterImages,
  findCategory,
  findGroup,
  findPreset,
  findProject,
  findRun,
  findSection,
  findTemplate,
  firstCategory,
  folderEntriesForAssets,
  parentPath,
  pathParts,
  presetFolderBreadcrumb,
  presetFolderChildren,
  presetFolderItemCount,
  presetFolderOptions,
  presetLibraryItems,
  productRouteFromPathname,
  projectBatchBindings,
  projectPresetSummary,
  rawSectionId,
  resultRunGroups,
  sectionAnchorId,
  sectionRunStatus,
  selectionToggleLabel,
  matchRoute,
} from "./design-demo-utils";
import type {
  BatchImportItem,
  DemoButtonFeedback,
  DemoTemplateSection,
  LogDemoSource,
  Match,
  ModelBrowserState,
  ModelKind,
  PresetLibraryItem,
  ProjectCardView,
  ResultDemoFilter,
  SectionNavMode,
  SortRuleDimensionKey,
  TemplateSectionMode,
} from "./design-demo-utils";

function RootPage({ data }: { data: DemoData }) {
  return <QueuePage data={data} />;
}

function ProjectsPage({ data }: { data: DemoData }) {
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

function ProjectDetailPage({
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

function ProjectSectionShell({
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

function ProjectFormPage({ project, mode }: { project?: DemoProject; mode: "new" | "edit" }) {
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

function BatchCreatePage({ project, data }: { project: DemoProject | undefined; data: DemoData }) {
  const activeProject = project ?? data.projects[0];
  const [selectedCategoryId, setSelectedCategoryId] = useState(data.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importItems, setImportItems] = useState<BatchImportItem[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [aspectRatio, setAspectRatio] = useState(activeProject?.sections[0]?.aspectRatio ?? "2:3");
  const [shortSidePx, setShortSidePx] = useState(activeProject?.sections[0]?.shortSidePx ?? 768);
  const [createdCount, setCreatedCount] = useState(2);
  const category = data.categories.find((item) => item.id === selectedCategoryId) ?? data.categories[0];
  const bindings = activeProject ? projectBatchBindings(activeProject, data.categories) : [];
  const folderPath = category ? presetFolderBreadcrumb(category, currentFolderId) : [];
  const folderChildren = category && !query.trim() ? presetFolderChildren(category, currentFolderId) : [];
  const normalizedQuery = query.trim().toLowerCase();
  const candidateRows = category ? (
    category.type === "group"
      ? category.groups
        .filter((group) => normalizedQuery ? group.name.toLowerCase().includes(normalizedQuery) : (group.folderId ?? null) === currentFolderId)
        .map((group) => ({
          key: batchItemKey("group", group.id),
          icon: Boxes,
          title: group.name,
          meta: `${group.memberCount} members`,
          description: group.members.slice(0, 4).join(" / ") || "待配置成员",
          item: batchImportFromGroup(category, group),
        }))
      : category.presets
        .filter((preset) => normalizedQuery ? `${preset.name} ${preset.slug}`.toLowerCase().includes(normalizedQuery) : (preset.folderId ?? null) === currentFolderId)
        .flatMap((preset) => {
          const variants = preset.variants.length ? preset.variants : [undefined];
          return variants.map((variant) => ({
            key: batchItemKey("preset", preset.id, variant?.id),
            icon: Wand2,
            title: variant?.name ? `${preset.name} / ${variant.name}` : preset.name,
            meta: `${preset.variantCount} variants`,
            description: preset.notes || variant?.prompt || preset.slug,
            item: batchImportFromPreset(category, preset, variant),
          }));
        })
  ) : [];
  const createdSections = activeProject?.sections.slice(0, Math.min(createdCount, 4)) ?? [];

  function changeCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setCurrentFolderId(null);
    setQuery("");
  }

  function addImport(item: BatchImportItem, replaceCategory = false) {
    setImportItems((current) => {
      const scoped = replaceCategory ? current.filter((existing) => existing.categoryId !== item.categoryId) : current;
      if (scoped.some((existing) => existing.key === item.key || existing.id === item.id)) return scoped;
      return [...scoped, item];
    });
    if (!sectionName) setSectionName(item.name);
  }

  function removeImport(key: string) {
    setImportItems((current) => current.filter((item) => item.key !== key));
  }

  function updateImportVariant(key: string, variantId: string) {
    setImportItems((current) => current.map((item) => item.key === key ? {
      ...item,
      variantId,
      meta: item.variants.find((variant) => variant.id === variantId)?.name ?? item.meta,
    } : item));
  }

  if (!activeProject) return <EmptyPage title="没有项目数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${activeProject.id}`, label: "返回项目" }}
        eyebrow="项目"
        title={`${activeProject.title} / 批量创建小节`}
        subtitle="从预设库导入一个或多个预设，覆盖项目已有绑定后创建新的项目小节。"
        actions={<Button tone="primary" icon={Plus} onClick={() => setCreatedCount((count) => count + 1)}>创建小节</Button>}
      />
      <div className={s.batchCreateWorkspace}>
        <section className={s.batchBrowserPane} aria-label="预设浏览器">
          <div className={s.batchPaneHeader}>
            <div>
              <span>预设浏览</span>
              <strong>预设浏览器</strong>
            </div>
            <StatusBadge status={category?.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category ?? null)} />
          </div>

          <div className={s.batchCategoryTabs}>
            {data.categories.map((item) => (
              <button
                aria-pressed={category?.id === item.id}
                key={item.id}
                onClick={() => changeCategory(item.id)}
                type="button"
              >
                <span style={{ background: categoryColorValue(item.color) }} />
                {item.name}
                {item.type === "group" ? <em>组</em> : null}
              </button>
            ))}
          </div>

          <label className={s.batchSearchBox}>
            <Search className={s.icon} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索预设、预设组或 slug" />
            {query ? (
              <button aria-label="清除搜索" type="button" onClick={() => setQuery("")}>
                <X className={s.icon} />
              </button>
            ) : null}
          </label>

          {category ? (
            <div className={s.batchFolderBar}>
              <div className={s.batchBreadcrumbs}>
                <button type="button" onClick={() => setCurrentFolderId(null)} disabled={currentFolderId === null}>根目录</button>
                {folderPath.map((folder) => (
                  <button type="button" key={folder.id} onClick={() => setCurrentFolderId(folder.id)} disabled={folder.id === currentFolderId}>
                    {folder.name}
                  </button>
                ))}
              </div>
              <span>{presetFolderItemCount(category, currentFolderId)} 项</span>
            </div>
          ) : null}

          <div className={s.batchBrowserList}>
            {currentFolderId ? (
              <button
                className={s.batchFolderRow}
                type="button"
                onClick={() => {
                  const current = folderPath[folderPath.length - 1];
                  setCurrentFolderId(current?.parentId ?? null);
                }}
              >
                <ArrowLeft className={s.icon} />
                <strong>返回上级</strong>
                <span>{folderPath[folderPath.length - 1]?.name ?? "当前目录"}</span>
              </button>
            ) : null}

            {folderChildren.map((folder) => (
              <button className={s.batchFolderRow} type="button" key={folder.id} onClick={() => setCurrentFolderId(folder.id)}>
                <FolderTree className={s.icon} />
                <strong>{folder.name}</strong>
                <span>{presetFolderItemCount(category!, folder.id)} 项</span>
              </button>
            ))}

            {candidateRows.map((row) => {
              const selected = importItems.some((item) => item.key === row.item.key || item.id === row.item.id);
              const Icon = row.icon;
              return (
                <div className={cx(s.batchCandidateRow, selected && s.batchCandidateRowSelected)} key={row.key}>
                  <Icon className={s.icon} />
                  <div className={s.batchCandidateMain}>
                    <strong>{row.title}</strong>
                    <span>{row.description}</span>
                  </div>
                  <div className={s.batchCandidateMeta}>
                    <span>{row.meta}</span>
                    <em>{row.item.sourceLabel}</em>
                  </div>
                  <div className={s.batchCandidateActions}>
                    <button type="button" onClick={() => addImport(row.item, true)}>覆盖</button>
                    <button type="button" onClick={() => addImport(row.item)} disabled={selected}>
                      {selected ? "已导入" : "导入"}
                    </button>
                  </div>
                </div>
              );
            })}

            {folderChildren.length === 0 && candidateRows.length === 0 ? (
              <div className={s.batchEmptyState}>当前分类和文件夹下没有可导入条目</div>
            ) : null}
          </div>
        </section>

        <section className={s.batchConfigPane} aria-label="批量创建配置">
          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>导入列表</span>
                <strong>导入列表</strong>
              </div>
              <em>{importItems.length} 项</em>
            </div>
            {importItems.length === 0 ? (
              <div className={s.batchEmptyState}>从左侧选择预设或预设组后，它们会进入这里并参与新小节创建。</div>
            ) : (
              <div className={s.batchImportList}>
                {importItems.map((item) => (
                  <div className={s.batchImportRow} key={item.key}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.sourceLabel} · {item.meta}</span>
                    </div>
                    {item.variants.length > 1 ? (
                      <select value={item.variantId ?? ""} onChange={(event) => updateImportVariant(item.key, event.target.value)}>
                        {item.variants.map((variant) => (
                          <option value={variant.id} key={variant.id}>{variant.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={s.inlineNotice}>{item.kind === "group" ? "组导入" : "单变体"}</span>
                    )}
                    <button className={s.iconMiniButton} type="button" onClick={() => removeImport(item.key)} aria-label="移除导入项">
                      <X className={s.icon} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>项目绑定</span>
                <strong>已有绑定变体</strong>
              </div>
              <em>{bindings.length} 组</em>
            </div>
            <div className={s.batchBindingList}>
              {bindings.map((binding) => (
                <div className={s.batchBindingRow} key={binding.id}>
                  <div>
                    <strong>{binding.name}</strong>
                    <span>{binding.categoryName}</span>
                  </div>
                  <select defaultValue={binding.variants[0]?.id ?? ""}>
                    <option value="">默认</option>
                    {binding.variants.map((variant) => (
                      <option value={variant.id} key={variant.id}>{variant.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>新小节</span>
                <strong>新小节参数</strong>
              </div>
              <StatusBadge status="queued" label="待创建" />
            </div>
            <div className={s.batchFormGrid}>
              <label>
                <span>小节名称</span>
                <input value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder={importItems[0]?.name ?? "留空自动编号"} />
              </label>
              <label>
                <span>短边像素</span>
                <input value={shortSidePx} onChange={(event) => setShortSidePx(Number(event.target.value) || 0)} inputMode="numeric" />
              </label>
            </div>
            <div className={s.batchRatioGrid}>
              {["1:1", "2:3", "3:2", "4:3", "16:9"].map((ratio) => (
                <button aria-pressed={aspectRatio === ratio} type="button" key={ratio} onClick={() => setAspectRatio(ratio)}>
                  {ratio}
                </button>
              ))}
            </div>
            <div className={s.editorStatusStrip}>
              <span>导入 {importItems.length} 项</span>
              <span>{aspectRatio} · {shortSidePx}px</span>
              <span>创建后进入项目小节列表</span>
            </div>
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>最近创建</span>
                <strong>最近创建</strong>
              </div>
              <em>{createdSections.length} 条</em>
            </div>
            <div className={s.batchCreatedList}>
              {createdSections.map((section, index) => (
                <Link href={demoHref(`/projects/${activeProject.id}/sections/${rawSectionId(section)}`)} key={section.id}>
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <strong>{section.name}</strong>
                  <em>{section.aspectRatio} · 批量 {section.batchSize}</em>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

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
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>#{String(sectionIndex + 1).padStart(2, "0")}</span>
              <strong>{section.name}</strong>
              <em>{section.aspectRatio} · 批量 {section.batchSize} · {section.shortSidePx}px</em>
            </div>
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

function SectionResultsPage({ project, section }: { project: DemoProject | undefined; section: DemoSection | undefined }) {
  const [filter, setFilter] = useState<ResultDemoFilter>("all");
  const [collapsedRuns, setCollapsedRuns] = useState<Set<string>>(new Set());
  if (!project || !section) return <EmptyPage title="没有小节结果" />;
  const images = filterImages(section.images, filter);
  const groups = resultRunGroups(images);

  function toggleRun(runId: string) {
    setCollapsedRuns((current) => {
      const next = new Set(current);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "返回项目" }}
        eyebrow="小节结果"
        title={`${section.name} / 结果`}
        subtitle="按 run 分组管理图片、lightbox 查看、p站/预览标记和审核状态。"
        actions={<ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}`} icon={SlidersHorizontal}>编辑小节</ButtonLink>}
      />
      <ProjectSectionShell project={project} activeSection={section} mode="section-results">
        <div className={s.sectionStack} data-section-card={section.id} id={sectionAnchorId(section)}>
          <DemoTabs
            tabs={[
              { key: "all", label: "全部", count: section.images.length },
              { key: "pending", label: "待审", count: section.images.filter((image) => image.status === "pending").length },
              { key: "kept", label: "已保留", count: section.images.filter((image) => image.status === "kept").length },
              { key: "pstation", label: "p站", count: section.images.filter((image) => image.featured).length },
              { key: "preview", label: "预览", count: section.images.filter((image) => image.featured2).length },
              { key: "cover", label: "封面", count: section.images.filter((image) => image.cover).length },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {groups.map((group) => (
            <RunResultBlock
              collapsed={collapsedRuns.has(group.id)}
              group={group}
              key={group.id}
              onToggle={() => toggleRun(group.id)}
              totalCount={images.length}
            />
          ))}
        </div>
      </ProjectSectionShell>
    </div>
  );
}

function RunResultBlock({
  collapsed,
  group,
  onToggle,
  totalCount,
}: {
  collapsed: boolean;
  group: ReturnType<typeof resultRunGroups>[number];
  onToggle: () => void;
  totalCount: number;
}) {
  const visibleImages = collapsed ? group.images.slice(0, 4) : group.images;

  return (
    <section className={s.resultSectionBlock}>
      <div className={s.resultSectionHeader}>
        <div className={s.resultSectionTitle}>
          <strong>{group.title}</strong>
          <span>{group.meta} · {group.images.length} / {totalCount} 张</span>
        </div>
        <div className={s.resultSectionActions}>
          <Button tone="subtle" icon={collapsed ? ChevronDown : ChevronUp} onClick={onToggle}>
            {collapsed ? "展开" : "折叠"}
          </Button>
        </div>
      </div>
      <div className={s.resultActionBar}>
        <Button tone="subtle" icon={Square}>选择本轮</Button>
        <Button icon={Check} feedback={{ title: "本轮图片已加入保留队列" }}>保留</Button>
        <Button tone="pink" icon={Star} feedback={{ title: "本轮图片已加入 p站 标记队列" }}>p站</Button>
        <Button tone="pink" icon={Eye} feedback={{ title: "本轮图片已加入预览标记队列" }}>预览</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "本轮图片已加入删除队列" }}>删除</Button>
        <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近结果操作已撤销" }}>撤销</Button>
      </div>
      <ImageGrid images={visibleImages} />
    </section>
  );
}

function ModelDirectoryState({
  state,
  onReset,
}: {
  state: Exclude<ModelBrowserState, "ready">;
  onReset: () => void;
}) {
  const copy = {
    loading: {
      title: "正在读取目录",
      detail: "扫描当前路径、合并备注和触发词信息。",
      action: "完成读取",
    },
    error: {
      title: "目录不可访问",
      detail: "路径不存在或权限不足，请返回上级目录后重新扫描。",
      action: "返回目录",
    },
    empty: {
      title: "空目录",
      detail: "这里还没有模型文件，可以直接上传到当前目录。",
      action: "返回目录",
    },
  }[state];

  return (
    <div className={cx(s.modelState, s[`modelState_${state}`])}>
      <div className={s.modelStateIcon}>
        {state === "loading" ? <RefreshIcon /> : state === "error" ? <X className="size-4" /> : <FolderTree className="size-4" />}
      </div>
      <div className={s.modelStateText}>
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
      <Button tone="subtle" onClick={onReset}>{copy.action}</Button>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 17a8 8 0 0 0 13.4 2.9L20 17" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      <path d="M20 7A8 8 0 0 0 6.6 4.1L4 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ModelMoveTargetSheet({
  assets,
  selectedPath,
  fileName,
  onCancel,
  onConfirm,
  onSelect,
}: {
  assets: DemoAsset[];
  selectedPath: string;
  fileName: string;
  onCancel: () => void;
  onConfirm: () => void;
  onSelect: (path: string) => void;
}) {
  const targetFolders = folderEntriesForAssets(assets);
  const childFolders = entriesForPath(assets, selectedPath).folders;
  const targetParts = pathParts(selectedPath);

  return (
    <div className={s.modelMoveBackdrop} role="presentation" onClick={onCancel}>
      <section className={s.modelMoveSheet} role="dialog" aria-modal="true" aria-label="选择移动目标" onClick={(event) => event.stopPropagation()}>
        <header className={s.modelMoveHeader}>
          <div>
            <span>移动文件</span>
            <h2>{fileName}</h2>
          </div>
          <button className={s.iconButton} type="button" onClick={onCancel} aria-label="关闭">
            <X className="size-4" />
          </button>
        </header>
        <div className={s.modelMoveBreadcrumbs}>
          <button type="button" onClick={() => onSelect("")}>根目录</button>
          {targetParts.map((part, index) => {
            const path = targetParts.slice(0, index + 1).join("/");
            return (
              <button type="button" key={path} onClick={() => onSelect(path)}>
                {part}
              </button>
            );
          })}
        </div>
        <div className={s.modelMoveBody}>
          <div className={s.modelMoveColumn}>
            <span className={s.modelMoveLabel}>常用目录</span>
            {targetFolders.slice(0, 10).map((folder) => (
              <button
                className={cx(s.modelTargetRow, selectedPath === folder.path && s.modelTargetRowActive)}
                type="button"
                key={folder.path || "root"}
                onClick={() => onSelect(folder.path)}
              >
                <FolderTree className="size-4" />
                <strong style={{ paddingLeft: `${folder.depth * 8}px` }}>{folder.name}</strong>
                <span>{folder.count} 个文件</span>
              </button>
            ))}
          </div>
          <div className={s.modelMoveColumn}>
            <span className={s.modelMoveLabel}>当前目录下级</span>
            {selectedPath ? (
              <button className={s.modelTargetRow} type="button" onClick={() => onSelect(parentPath(selectedPath))}>
                <ArrowLeft className="size-4" />
                <strong>返回上级</strong>
                <span>{parentPath(selectedPath) || "根目录"}</span>
              </button>
            ) : null}
            {childFolders.length ? childFolders.map((folder) => (
              <button className={s.modelTargetRow} type="button" key={folder.path} onClick={() => onSelect(folder.path)}>
                <FolderTree className="size-4" />
                <strong>{folder.name}</strong>
                <span>{folder.count} 个文件</span>
              </button>
            )) : (
              <div className={s.modelMoveEmpty}>没有子文件夹</div>
            )}
          </div>
        </div>
        <footer className={s.modelMoveFooter}>
          <span>目标：{selectedPath || "根目录"}</span>
          <Button tone="primary" icon={FolderTree} onClick={onConfirm} feedback={{ title: "文件移动已排队", detail: selectedPath || "根目录" }}>移动到这里</Button>
        </footer>
      </section>
    </div>
  );
}

function ModelsPage({ data }: { data: DemoData }) {
  const [kind, setKind] = useState<ModelKind>("lora");
  const [currentPath, setCurrentPath] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<ModelBrowserState>("ready");
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null);
  const [moveTargetPath, setMoveTargetPath] = useState("");
  const assets = data.models.filter((asset) => assetKind(asset) === kind);
  const { folders, files } = entriesForPath(assets, currentPath);
  const visibleFolders = browserState === "ready" ? folders : [];
  const visibleFiles = browserState === "ready" ? files : [];
  const selectedAsset = browserState === "ready" ? (assets.find((asset) => asset.id === selectedAssetId) ?? visibleFiles[0] ?? assets[0]) : null;
  const movingAsset = assets.find((asset) => asset.id === movingAssetId) ?? null;
  const breadcrumbParts = pathParts(currentPath);

  function switchKind(nextKind: ModelKind) {
    setKind(nextKind);
    setCurrentPath("");
    setSelectedAssetId(null);
    setBrowserState("ready");
    setMovingAssetId(null);
  }

  function openPath(path: string) {
    setCurrentPath(path);
    setSelectedAssetId(null);
    setBrowserState("ready");
  }

  function showLoadingState() {
    setBrowserState("loading");
    window.setTimeout(() => setBrowserState("ready"), 520);
  }

  function openMoveTarget(asset: DemoAsset) {
    setSelectedAssetId(asset.id);
    setMoveTargetPath(parentPath(assetPath(asset)) || currentPath);
    setMovingAssetId(asset.id);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="模型"
        title="模型文件管理"
        subtitle="LoRA 和 checkpoint 统一在这里按文件夹浏览、上传、移动和维护备注。"
        actions={<Button icon={Search} onClick={showLoadingState} feedback={{ title: "目录扫描已开始", detail: data.source.modelBaseLabel }}>扫描目录</Button>}
      />
      <div className={s.modelManagerLayout}>
        <aside className={s.modelSidebar}>
          <div className={s.segmented}>
            <button
              className={cx(s.segment, kind === "lora" && s.segmentActive)}
              type="button"
              onClick={() => switchKind("lora")}
            >
              LoRA
            </button>
            <button
              className={cx(s.segment, kind === "checkpoint" && s.segmentActive)}
              type="button"
              onClick={() => switchKind("checkpoint")}
            >
              Checkpoint
            </button>
          </div>
          <div className={s.modelRootCard}>
            <span>根目录</span>
            <strong>{data.source.modelBaseLabel}</strong>
            <em>{assets.length} 个文件</em>
          </div>
          <div className={s.modelUploadBox}>
            <Upload className="size-4" />
            <strong>上传到当前目录</strong>
            <span>{currentPath || "根目录"}</span>
          </div>
        </aside>
        <section className={s.modelBrowserPanel}>
          <div className={s.modelBrowserHeader}>
            <div className={s.breadcrumbsLine}>
              <button type="button" onClick={() => openPath("")}>根目录</button>
              {breadcrumbParts.map((part, index) => {
                const pathValue = breadcrumbParts.slice(0, index + 1).join("/");
                return (
                  <button type="button" key={pathValue} onClick={() => openPath(pathValue)}>
                    {part}
                  </button>
                );
              })}
            </div>
            <div className={s.inlineControls}>
              <Button icon={FolderTree} onClick={() => {
                openPath(currentPath ? `${currentPath}/新建文件夹` : "新建文件夹");
                setBrowserState("empty");
              }} feedback={{ title: "文件夹草稿已创建", detail: currentPath || "根目录" }}>新建文件夹</Button>
              <Button tone="subtle" onClick={() => setBrowserState("error")} feedback={{ tone: "warning", title: "路径检查返回异常状态" }}>路径检查</Button>
              <Button tone="primary" icon={Upload} feedback={{ title: "上传面板已准备", detail: currentPath || "根目录" }}>上传</Button>
            </div>
          </div>
          <div className={s.fileBrowser}>
            {browserState !== "ready" ? (
              <ModelDirectoryState state={browserState} onReset={() => setBrowserState("ready")} />
            ) : (
              <>
                {currentPath ? (
                  <button className={s.folderRow} type="button" onClick={() => openPath(parentPath(currentPath))}>
                    <ArrowLeft className="size-4" />
                    <strong>返回上级</strong>
                    <span>{parentPath(currentPath) || "根目录"}</span>
                  </button>
                ) : null}
                {visibleFolders.map((folder) => (
                  <button className={s.folderRow} type="button" key={folder.path} onClick={() => openPath(folder.path)}>
                    <FolderTree className="size-4" />
                    <strong>{folder.name}</strong>
                    <span>{folder.count} 个文件</span>
                  </button>
                ))}
                {visibleFiles.map((asset) => (
                  <div
                    className={cx(s.fileRow, selectedAsset?.id === asset.id && s.fileRowActive)}
                    role="button"
                    tabIndex={0}
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAssetId(asset.id);
                      }
                    }}
                  >
                    <FileText className="size-4" />
                    <strong>{asset.name || asset.fileName}</strong>
                    <span>{assetPath(asset)}</span>
                    <em>{asset.sizeLabel}</em>
                    <button
                      className={s.fileRowAction}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMoveTarget(asset);
                      }}
                    >
                      移动
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                ))}
              </>
            )}
            {browserState === "ready" && visibleFolders.length === 0 && visibleFiles.length === 0 ? (
              <div className={s.empty}>当前目录没有模型文件</div>
            ) : null}
          </div>
        </section>
        <aside className={s.modelInspector}>
          <div className={s.panelHeader}>
            <div>
              <h2>文件信息</h2>
              <p>{selectedAsset ? assetPath(selectedAsset) : "未选择文件"}</p>
            </div>
          </div>
          <div className={s.panelBody}>
            {selectedAsset ? (
              <div className={s.grid}>
                <Field label="文件名" value={selectedAsset.fileName} />
                <Field label="类型" value={assetKind(selectedAsset)} />
                <TextAreaField label="备注" value={selectedAsset.notes || "用途、来源、推荐权重和维护记录。"} />
                {assetKind(selectedAsset) === "lora" ? (
                  <Field label="触发词" value={selectedAsset.triggerWords || "trigger words"} />
                ) : null}
                <div className={s.modelPathSummary}>
                  <span>当前位置</span>
                  <strong>{currentPath || "根目录"}</strong>
                </div>
                <div className={s.toolbar}>
                  <Button icon={Save} feedback={{ title: "文件备注已保存", detail: selectedAsset.fileName }}>保存</Button>
                  <Button icon={FolderTree} onClick={() => openMoveTarget(selectedAsset)} feedback={{ title: "选择移动目标", detail: selectedAsset.fileName }}>移动</Button>
                </div>
              </div>
            ) : (
              <div className={s.empty}>选择一个模型文件查看详情</div>
            )}
          </div>
        </aside>
      </div>
      {movingAsset ? (
        <ModelMoveTargetSheet
          assets={assets}
          selectedPath={moveTargetPath}
          fileName={movingAsset.fileName}
          onCancel={() => setMovingAssetId(null)}
          onConfirm={() => {
            setCurrentPath(moveTargetPath);
            setMovingAssetId(null);
            setBrowserState("ready");
          }}
          onSelect={setMoveTargetPath}
        />
      ) : null}
    </div>
  );
}

function LorasPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA"
        title="LoRA 文件"
        subtitle="LoRA 已并入模型文件管理，旧入口会进入统一文件页。"
        actions={<ButtonLink href="/models" tone="primary" icon={Database}>进入模型文件</ButtonLink>}
      />
      <Panel title="统一入口">
        <div className={s.grid}>
          <div className={s.switchRow}>
            <div className={s.switchText}>
              <strong>LoRA</strong>
              <span>{data.loras.length} 个文件会在模型文件页的 LoRA 类型下展示。</span>
            </div>
            <StatusBadge status="ready" label="已合并" />
          </div>
        </div>
      </Panel>
    </div>
  );
}

function PresetMoveSheet({
  category,
  confirmFeedback,
  onCancel,
  onConfirm,
  onSelect,
  selectedCount,
  selectedFolderId,
}: {
  category: DemoCategory;
  confirmFeedback?: DemoButtonFeedback;
  onCancel: () => void;
  onConfirm: () => void;
  onSelect: (folderId: string | null) => void;
  selectedCount: number;
  selectedFolderId: string | null;
}) {
  const options = presetFolderOptions(category);
  const breadcrumb = presetFolderBreadcrumb(category, selectedFolderId);

  return (
    <div className={s.presetMoveBackdrop} role="presentation" onClick={onCancel}>
      <section className={s.presetMoveSheet} role="dialog" aria-modal="true" aria-label="选择移动文件夹" onClick={(event) => event.stopPropagation()}>
        <header className={s.presetMoveHeader}>
          <div>
            <span>批量移动</span>
            <h2>{selectedCount} 个{categoryTypeLabel(category)}条目</h2>
          </div>
          <button className={s.iconButton} type="button" onClick={onCancel} aria-label="关闭">
            <X className="size-4" />
          </button>
        </header>
        <div className={s.presetMoveBreadcrumbs}>
          <button type="button" onClick={() => onSelect(null)}>根目录</button>
          {breadcrumb.map((folder) => (
            <button type="button" key={folder.id} onClick={() => onSelect(folder.id)}>
              {folder.name}
            </button>
          ))}
        </div>
        <div className={s.presetMoveTargets}>
          {options.map((option) => (
            <button
              className={cx(s.presetMoveTarget, selectedFolderId === option.id && s.presetMoveTargetActive)}
              type="button"
              key={option.id ?? "root"}
              onClick={() => onSelect(option.id)}
            >
              <FolderTree className="size-4" />
              <strong style={{ paddingLeft: `${option.depth * 8}px` }}>{option.name}</strong>
              <span>{option.count} 项</span>
            </button>
          ))}
        </div>
        <footer className={s.presetMoveFooter}>
          <span>目标：{breadcrumb[breadcrumb.length - 1]?.name ?? "根目录"}</span>
          <Button tone="primary" icon={FolderTree} onClick={onConfirm} feedback={confirmFeedback}>移动到这里</Button>
        </footer>
      </section>
    </div>
  );
}

function PresetFolderBrowser({
  category,
  currentFolderId,
  onNavigate,
}: {
  category: DemoCategory;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  const breadcrumb = presetFolderBreadcrumb(category, currentFolderId);

  return (
    <div className={s.presetFolderBar}>
      <div className={s.presetFolderBreadcrumbs}>
        <button type="button" onClick={() => onNavigate(null)} disabled={!currentFolderId}>根目录</button>
        {breadcrumb.map((folder) => (
          <button type="button" key={folder.id} onClick={() => onNavigate(folder.id)} disabled={folder.id === currentFolderId}>
            {folder.name}
          </button>
        ))}
      </div>
      <span>{presetFolderItemCount(category, currentFolderId)} 项</span>
    </div>
  );
}

function PresetFolderRows({
  category,
  currentFolderId,
  onNavigate,
}: {
  category: DemoCategory;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  const folders = presetFolderChildren(category, currentFolderId);

  if (!folders.length) return null;

  return (
    <div className={s.presetFolderGrid}>
      {folders.map((folder) => (
        <button className={s.presetFolderRow} type="button" key={folder.id} onClick={() => onNavigate(folder.id)}>
          <GripVertical className={s.categoryDragIcon} />
          <FolderTree className="size-4" />
          <strong>{folder.name}</strong>
          <span>{presetFolderItemCount(category, folder.id)} 项</span>
          <Edit3 className={s.icon} />
        </button>
      ))}
    </div>
  );
}

function PresetItemRows({
  items,
  onToggle,
  selectedIds,
}: {
  items: PresetLibraryItem[];
  onToggle: (id: string) => void;
  selectedIds: Set<string>;
}) {
  if (!items.length) {
    return (
      <div className={s.empty}>当前文件夹没有条目</div>
    );
  }

  return (
    <div className={s.presetItemList}>
      {items.map((item, index) => {
        const checked = selectedIds.has(item.id);
        return (
          <div className={cx(s.presetItemRow, checked && s.presetItemRowSelected)} key={item.id}>
            <button className={s.presetItemCheck} type="button" onClick={() => onToggle(item.id)} aria-label={checked ? "取消选择" : "选择"}>
              {checked ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
            </button>
            <Link className={s.presetItemOpenArea} href={demoHref(item.href)}>
              <GripVertical className={s.categoryDragIcon} />
              <div className={s.presetItemMain}>
                <strong>{item.name}</strong>
                <span>{item.slug}</span>
                <p>{item.description}</p>
              </div>
              <div className={s.presetItemMeta}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <em>{item.meta}</em>
              </div>
              <ArrowRight className={s.presetItemArrow} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function PresetsPage({ data }: { data: DemoData }) {
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [showDraftFolder, setShowDraftFolder] = useState(false);
  const category = data.categories.find((item) => item.id === categoryId) ?? data.categories[0];
  const visibleItems = category ? presetLibraryItems(category).filter((item) => (item.folderId ?? null) === currentFolderId) : [];
  const visibleFolders = category ? presetFolderChildren(category, currentFolderId) : [];
  const selectedCount = selectedIds.size;

  function selectCategory(next: DemoCategory) {
    setCategoryId(next.id);
    setCurrentFolderId(null);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
  }

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
  }

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="预设库"
        title="提示词预设库"
        subtitle={`${data.categories.length} 个分类 · ${data.metrics.presets} 个预设`}
        actions={<ButtonLink href="/presets/sort-rules" icon={Shuffle}>排序规则</ButtonLink>}
      />
      {category ? (
        <div className={s.presetManagerLayout}>
          <PresetCategorySidebar
            categories={data.categories}
            selectedCategory={category}
            onSelect={selectCategory}
          />
          <section className={s.presetWorkArea}>
            <div className={s.presetWorkspaceHeader}>
              <div>
                <span>{categoryTypeLabel(category)}分类</span>
                <h2>{category.name}</h2>
                <p>{category.slug} · {categoryItemCount(category)} 个条目 · {category.folders.length} 个文件夹</p>
              </div>
              <StatusBadge status={category.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category)} />
            </div>
            <div className={s.presetContextBar}>
              <PresetFolderBrowser category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <div className={s.toolbar}>
                <Button icon={Plus} feedback={{ title: `${category.type === "group" ? "预设组" : "预设"}创建表单已准备` }}>新建{category.type === "group" ? "预设组" : "预设"}</Button>
                <Button icon={FolderTree} onClick={() => setShowDraftFolder(true)} feedback={{ title: "文件夹草稿已创建" }}>新建文件夹</Button>
              </div>
            </div>
            <OperationStateStrip
              items={[
                { label: "分类排序", value: "拖拽释放后保存", tone: "info" },
                { label: "文件夹排序", value: "就绪", tone: "success" },
                { label: "移动队列", value: selectedCount ? `${selectedCount} 项` : "空", tone: selectedCount ? "warning" : "success" },
              ]}
            />
            {selectedCount ? (
              <div className={s.presetBatchBar}>
                <strong>已选择 {selectedCount} 项</strong>
                <div className={s.toolbar}>
                  <Button tone="subtle" icon={Check} onClick={() => setSelectedIds(new Set(visibleItems.map((item) => item.id)))}>
                    全选当前层
                  </Button>
                  <Button icon={FolderTree} onClick={() => {
                    setMoveTargetId(currentFolderId);
                    setMoveSheetOpen(true);
                  }}>
                    移动到文件夹
                  </Button>
                  <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "批量删除需要确认", detail: `${selectedCount} 项` }}>批量删除</Button>
                  <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())}>取消</Button>
                </div>
              </div>
            ) : null}
            <section className={s.presetLibrarySurface}>
              {currentFolderId ? (
                <button className={s.presetFolderBack} type="button" onClick={() => {
                  const currentFolder = presetFolderBreadcrumb(category, currentFolderId)[presetFolderBreadcrumb(category, currentFolderId).length - 1];
                  navigateFolder(currentFolder?.parentId ?? null);
                }}>
                  <ArrowLeft className="size-4" />
                  返回上级
                </button>
              ) : null}
              {showDraftFolder ? (
                <div className={cx(s.presetFolderRow, s.presetFolderDraft)}>
                  <GripVertical className={s.categoryDragIcon} />
                  <FolderTree className="size-4" />
                  <strong>新建文件夹</strong>
                  <span>保存中</span>
                  <X className={s.icon} />
                </div>
              ) : null}
              <PresetFolderRows category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <PresetItemRows
                items={visibleItems}
                onToggle={toggleItem}
                selectedIds={selectedIds}
              />
              {!visibleFolders.length && !visibleItems.length && !showDraftFolder ? <div className={s.empty}>当前文件夹没有内容</div> : null}
            </section>
            {moveSheetOpen ? (
              <PresetMoveSheet
                category={category}
                onCancel={() => setMoveSheetOpen(false)}
                onConfirm={() => {
                  setCurrentFolderId(moveTargetId);
                  setSelectedIds(new Set());
                  setMoveSheetOpen(false);
                }}
                confirmFeedback={{ title: "移动已加入保存队列", detail: `${selectedCount} 项` }}
                onSelect={setMoveTargetId}
                selectedCount={selectedCount}
                selectedFolderId={moveTargetId}
              />
            ) : null}
          </section>
        </div>
      ) : <EmptyPage title="没有预设分类" />}
    </div>
  );
}

function PresetCategorySidebar({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: DemoCategory[];
  selectedCategory: DemoCategory;
  onSelect: (category: DemoCategory) => void;
}) {
  return (
    <aside className={s.presetCategorySidebar}>
      <div className={s.presetCategoryHeader}>
        <div>
          <span>分类管理</span>
          <strong>{categories.length} 个分类</strong>
        </div>
        <Link className={s.iconMiniButton} href={demoHref("/presets/categories/new")} aria-label="新建分类">
          <Plus className={s.icon} />
        </Link>
      </div>
      <div className={s.presetCategoryList}>
        {categories.map((category) => {
          const selected = selectedCategory.id === category.id;
          return (
            <div
              className={cx(s.presetCategoryItem, selected && s.presetCategoryItemActive)}
              key={category.id}
            >
              <div className={s.presetCategoryRow}>
                <button className={s.presetCategorySelect} type="button" onClick={() => onSelect(category)}>
                  <GripVertical className={s.categoryDragIcon} />
                  <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category.color) }} />
                  <span className={s.presetCategoryText}>
                    <strong>{category.name}</strong>
                    <span>{categoryItemCount(category)} 个{categoryTypeLabel(category)} · {category.slug}</span>
                  </span>
                </button>
                <div className={s.presetCategoryActions}>
                  <Link href={demoHref(`/presets/categories/${category.id}/edit`)} aria-label="编辑分类">
                    <Edit3 className={s.icon} />
                  </Link>
                  <button type="button" aria-label="删除分类" disabled={categoryItemCount(category) > 0}>
                    <Trash2 className={s.icon} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function PresetCategoryEditor({ category, categories }: { category: DemoCategory | null; categories: DemoCategory[] }) {
  const [draftType, setDraftType] = useState<"preset" | "group">(category?.type === "group" ? "group" : "preset");
  const type = category ? category.type : draftType;
  const itemCount = category ? categoryItemCount(category) : 0;
  const slots = categorySlotPreview(category, categories);
  const presetCategories = categories.filter((item) => item.type !== "group");

  return (
    <div className={s.categoryEditor}>
      <div className={s.categoryEditorHeader}>
        <strong>{category ? "编辑分类" : "新建分类"}</strong>
        <span>{category ? "分类类型已锁定" : "选择预设或预设组"}</span>
      </div>
      <div className={s.categoryTypeSwitch}>
        {(["preset", "group"] as const).map((item) => (
          <button
            className={cx(s.categoryTypeButton, type === item && s.categoryTypeButtonActive)}
            disabled={Boolean(category)}
            key={item}
            onClick={() => setDraftType(item)}
            type="button"
          >
            {item === "group" ? "预设组" : "预设"}
          </button>
        ))}
      </div>
      <div className={s.categoryEditorGrid}>
        <Field label="名称" value={category?.name ?? "新分类"} />
        <Field label="Slug" value={category?.slug ?? "new-category"} />
      </div>
      <div className={s.hueControl}>
        <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category?.color ?? null) }} />
        <input className={s.hueSlider} type="range" min={0} max={359} defaultValue={categoryHueValue(category?.color ?? null)} />
        <span>{categoryHueValue(category?.color ?? null)}°</span>
      </div>
      {type === "group" ? (
        <div className={s.slotEditor}>
          <div className={s.slotEditorHeader}>
            <strong>默认槽位</strong>
            <button type="button"><Plus className={s.icon} />添加槽位</button>
          </div>
          {(slots.length ? slots : [{ id: "new-slot", label: "主体", categoryName: presetCategories[0]?.name ?? "选择预设分类" }]).map((slot) => (
            <div className={s.slotRow} key={slot.id}>
              <GripVertical className={s.categoryDragIcon} />
              <SelectLike label="来源分类" value={slot.categoryName} />
              <Field label="槽位标签" value={slot.label} />
              <button className={s.iconMiniButton} type="button" aria-label="删除槽位">
                <X className={s.icon} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className={s.categoryEditorFooter}>
        {category ? (
          <div className={s.categoryDangerZone}>
            {itemCount > 0 ? (
              <span className={cx(s.inlineNotice, s.inlineNoticeWarn)}>
                删除前需移动 {itemCount} 个条目
              </span>
            ) : null}
            <button className={cx(s.button, s.buttonDanger)} type="button" disabled={itemCount > 0}>
              删除分类
            </button>
          </div>
        ) : null}
        <span className={s.inlineToast}>已保存</span>
      </div>
    </div>
  );
}

function PresetCategoryFormPage({
  category,
  data,
  mode,
}: {
  category: DemoCategory | undefined;
  data: DemoData;
  mode: "new" | "edit";
}) {
  const target: DemoCategory | null = mode === "edit" ? (category ?? null) : null;

  if (mode === "edit" && !target) return <EmptyPage title="没有预设分类数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="预设分类"
        title={mode === "new" ? "新建预设分类" : `编辑分类 / ${target?.name}`}
        subtitle={mode === "new" ? "创建分类后回到预设库。" : `${categoryTypeLabel(target)} · ${target ? categoryItemCount(target) : 0} 个条目`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: mode === "new" ? "分类创建已排队" : "分类保存已排队" }}>{mode === "new" ? "创建分类" : "保存分类"}</Button>}
      />
      <div className={s.categoryFormLayout}>
        <section className={s.categoryFormSurface}>
          <PresetCategoryEditor category={target} categories={data.categories} />
        </section>
      </div>
    </div>
  );
}

function PresetEditPage({ data, preset }: { data: DemoData; preset: DemoPreset | undefined }) {
  const [activeVariantId, setActiveVariantId] = useState(preset?.variants[0]?.id ?? "");
  if (!preset) return <EmptyPage title="没有预设数据" />;

  const category = data.categories.find((item) => item.id === preset.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, preset.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const variants = preset.variants.length ? preset.variants : [{ id: "default", name: "默认", slug: "default", prompt: "", negativePrompt: "" }];
  const activeVariant = variants.find((variant) => variant.id === activeVariantId) ?? variants[0];
  const linkedVariants = data.categories
    .flatMap((item) => item.presets.map((candidate) => ({ category: item, preset: candidate })))
    .filter((item) => item.preset.id !== preset.id)
    .slice(0, 3);

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}`, label: "返回预设库" }}
        eyebrow={categoryTypeLabel(category)}
        title={preset.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${preset.variantCount} 个变体`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设保存已排队", detail: preset.name }}>保存</Button>}
      />
      <div className={s.presetEditorShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{preset.slug}</span>
              <strong>{activeVariant.name}</strong>
              <em>{activeVariant.slug}</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "变体草稿已创建", detail: preset.name }}>添加变体</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>基础信息</strong>
                <span>名称、slug、分类和文件夹。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.fieldGrid}>
              <Field label="名称" value={preset.name} />
              <Field label="Slug" value={preset.slug} />
              <SelectLike label="分类" value={category?.name ?? preset.categoryId} />
              <SelectLike label="文件夹" value={folderPath} />
            </div>
            <TextAreaField label="备注" value={preset.notes || "预设说明和维护备注。"} />
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变体</strong>
                <span>每个变体保留独立 prompt、LoRA 和关联变体。</span>
              </div>
              <Button icon={GripVertical} feedback={{ title: "变体顺序已保存" }}>保存顺序</Button>
            </div>
            <div className={s.presetVariantWorkbench}>
              <div className={s.presetVariantRail}>
                {variants.map((variant, index) => (
                  <button
                    aria-pressed={variant.id === activeVariant.id}
                    className={cx(s.presetVariantButton, variant.id === activeVariant.id && s.presetVariantButtonActive)}
                    key={variant.id}
                    type="button"
                    onClick={() => setActiveVariantId(variant.id)}
                  >
                    <GripVertical className={s.icon} />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{variant.name}</strong>
                    <em>{variant.slug}</em>
                  </button>
                ))}
              </div>
              <div className={s.presetVariantEditor}>
                <div className={s.fieldGrid}>
                  <Field label="变体名称" value={activeVariant.name} />
                  <Field label="变体 Slug" value={activeVariant.slug} />
                </div>
                <div className={s.promptColumns}>
                  <TextAreaField label="正向 Prompt" value={activeVariant.prompt || "正向提示词"} />
                  <TextAreaField label="反向 Prompt" value={activeVariant.negativePrompt || "反向提示词"} />
                </div>
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>LoRA 绑定</strong>
                <span>阶段 1 和阶段 2 对应真实编辑器的两个 LoRA 列表，保留权重、触发词和来源表达。</span>
              </div>
              <Button icon={Plus} feedback={{ title: "LoRA 行已添加", detail: activeVariant.name }}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              <PresetLoraStage title="LoRA 1" preset={preset} variant={activeVariant} stage={1} />
              <PresetLoraStage title="LoRA 2" preset={preset} variant={activeVariant} stage={2} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>关联变体</strong>
                <span>用于级联复用其他预设变体的 prompt 与 LoRA 内容。</span>
              </div>
              <Button icon={Search} feedback={{ title: "变体选择面板已准备" }}>选择变体</Button>
            </div>
            <div className={s.presetLinkedList}>
              {linkedVariants.map(({ category: sourceCategory, preset: sourcePreset }, index) => {
                const variant = sourcePreset.variants[index % Math.max(sourcePreset.variants.length, 1)];
                return (
                  <div className={s.presetLinkedRow} key={sourcePreset.id}>
                    <div>
                      <strong>{sourcePreset.name}</strong>
                      <span>{sourceCategory.name} · {variant?.name ?? "默认"} · {variant?.slug ?? "default"}</span>
                    </div>
                    <StatusBadge status={index === 0 ? "ready" : "monitor"} label={index === 0 ? "级联" : "候选"} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变更历史</strong>
                <span>按基础信息、变体内容和 LoRA 绑定展示差异。</span>
              </div>
              <Button icon={History} feedback={{ title: "历史筛选已应用" }}>筛选历史</Button>
            </div>
            <div className={s.historyDiffList}>
              <div className={s.historyDiffRow}>
                <strong>变体内容更新</strong>
                <span>正向 Prompt 增加 {activeVariant.name} 的主体描述，反向 Prompt 同步排除项。</span>
              </div>
              <div className={s.historyDiffRow}>
                <strong>LoRA 绑定调整</strong>
                <span>LoRA 1 权重从 0.75 调整为 0.82，LoRA 2 保持继承。</span>
              </div>
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>保存状态</strong>
          <div className={s.editorStatusStrip}>
            <span>自动保存已开启</span>
            <span>{variants.length} 个变体</span>
            <span>{category?.name ?? "未分类"}</span>
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>级联同步</strong>
              <span>当前变体的 prompt 与 LoRA 可同步到绑定它的小节。</span>
            </div>
            <StatusBadge status="pending" label="待确认" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>被项目或小节引用时需要先解除绑定。</span>
            </div>
            <StatusBadge status="monitor" label="受保护" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PresetLoraStage({
  title,
  preset,
  variant,
  stage,
}: {
  title: string;
  preset: DemoPreset;
  variant: DemoPreset["variants"][number];
  stage: 1 | 2;
}) {
  const rows = [
    {
      name: `${preset.slug}-${stage}`,
      weight: stage === 1 ? "0.82" : "0.56",
      trigger: variant.slug,
    },
    {
      name: stage === 1 ? "character-refine" : "style-balance",
      weight: stage === 1 ? "0.35" : "0.48",
      trigger: preset.slug,
    },
  ];

  return (
    <div className={s.loraStage}>
      <strong>{title}</strong>
      {rows.map((row) => (
        <div className={s.loraRow} key={`${title}-${row.name}`}>
          <span>{row.name}</span>
          <em>{row.weight}</em>
          <button type="button">{row.trigger}</button>
        </div>
      ))}
    </div>
  );
}

function PresetGroupPage({ data, group }: { data: DemoData; group: DemoPresetGroup | undefined }) {
  if (!group) return <EmptyPage title="没有预设组数据" />;
  const category = data.categories.find((item) => item.id === group.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, group.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const fallbackMembers = data.categories.flatMap((item) => item.presets).slice(0, Math.max(3, group.memberCount));
  const members = Array.from({ length: Math.max(group.memberCount, 3) }, (_, index) => ({
    id: `${group.id}-${index}`,
    name: group.members[index] ?? fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.name ?? "选择预设",
    categoryName: data.categories.find((item) => item.presets.some((preset) => preset.name === group.members[index]))?.name ?? "预设",
    variant: fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.variants[0]?.name ?? "默认",
  }));

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${group.categoryId}&folder=${group.folderId ?? ""}&group=${group.id}`, label: "返回预设库" }}
        eyebrow="预设组"
        title={group.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${group.memberCount} 个成员`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设组保存已排队", detail: group.name }}>保存</Button>}
      />
      <div className={s.presetGroupShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{group.slug}</span>
              <strong>成员编排</strong>
              <em>拖拽排序、添加预设或子组、保存后返回当前分类和文件夹。</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "成员选择面板已准备" }}>添加成员</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>组信息</strong>
                <span>预设组保留分类、文件夹和删除返回路径，名称与 slug 可直接编辑。</span>
              </div>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除预设组需要确认", detail: group.name }}>删除组</Button>
            </div>
            <div className={s.fieldGrid}>
              <Field label="名称" value={group.name} />
              <Field label="Slug" value={group.slug} />
              <SelectLike label="分类" value={category?.name ?? group.categoryId} />
              <SelectLike label="文件夹" value={folderPath} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>成员列表</strong>
                <span>行内展示成员来源、变体和排序手柄，避免在列表里再展开编辑卡片。</span>
              </div>
              <Button icon={Search} feedback={{ title: "预设选择面板已准备" }}>选择预设</Button>
            </div>
            <div className={s.groupMemberList}>
              {members.map((member, index) => (
                <div className={s.groupMemberRow} key={member.id}>
                  <GripVertical className={s.icon} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <em>{member.categoryName} · {member.variant}</em>
                  </div>
                  <SelectLike label="变体" value={member.variant} />
                  <button className={s.iconMiniButton} type="button" aria-label="移除成员">
                    <Trash2 className={s.icon} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Flatten 预览</strong>
                <span>嵌套组展开后按分类顺序输出可执行预设序列。</span>
              </div>
              <StatusBadge status="ready" label={`${members.length} 步`} />
            </div>
            <div className={s.groupPreviewList}>
              {members.map((member, index) => (
                <div className={s.groupPreviewRow} key={`${member.id}-preview`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <em>Prompt block + LoRA 绑定 · {member.categoryName}</em>
                  </div>
                  <StatusBadge status={index % 2 === 0 ? "ready" : "monitor"} label={index % 2 === 0 ? "直接成员" : "继承"} />
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>成员来源</strong>
          <div className={s.presetCascadeState}>
            <div>
              <strong>分类</strong>
              <span>{category?.name ?? "未分类"} · {categoryTypeLabel(category)}</span>
            </div>
            <StatusBadge status="ready" label="可编辑" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>成员清空后才允许删除预设组。</span>
            </div>
            <StatusBadge status="pending" label="受保护" />
          </div>
          <div className={s.historyDiffList}>
            <div className={s.historyDiffRow}>
              <strong>成员排序</strong>
              <span>Slot 2 移动到 Slot 1，flatten 输出顺序同步。</span>
            </div>
            <div className={s.historyDiffRow}>
              <strong>成员变更</strong>
              <span>新增 {members[0]?.name ?? "成员"} 的默认变体。</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SortRulesPage({ data }: { data: DemoData }) {
  const dimensions: Array<{ key: SortRuleDimensionKey; title: string; subtitle: string; categories: DemoCategory[] }> = [
    { key: "positive", title: "正向 Prompt", subtitle: "决定导入后正向块的分类顺序。", categories: data.categories },
    { key: "negative", title: "反向 Prompt", subtitle: "反向块使用独立顺序，便于排除项先后稳定。", categories: [...data.categories].reverse() },
    { key: "lora1", title: "LoRA 1", subtitle: "第一阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(1).concat(data.categories.slice(0, 1)) },
    { key: "lora2", title: "LoRA 2", subtitle: "第二阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(2).concat(data.categories.slice(0, 2)) },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="排序规则"
        title="预设排序规则"
        subtitle="每个维度独立拖拽保存，正向、反向与两段 LoRA 不再共用一张摘要表。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "全部排序规则已保存" }}>保存全部</Button>}
      />
      <div className={s.sortRulesGrid}>
        {dimensions.map((dimension) => (
          <SortRulePanel
            categories={dimension.categories}
            key={dimension.key}
            title={dimension.title}
            subtitle={dimension.subtitle}
          />
        ))}
      </div>
    </div>
  );
}

function SortRulePanel({
  categories,
  title,
  subtitle,
}: {
  categories: DemoCategory[];
  title: string;
  subtitle: string;
}) {
  return (
    <section className={s.sortRulePanel}>
      <div className={s.sortRuleHeader}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <StatusBadge status="ready" label="已保存" />
      </div>
      <div className={s.sortRuleList}>
        {categories.map((category, index) => (
          <div className={s.sortRuleRow} key={category.id}>
            <GripVertical className={s.icon} />
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i style={{ background: categoryColorValue(category.color) }} />
            <div>
              <strong>{category.name}</strong>
              <em>{categoryTypeLabel(category)} · {categoryItemCount(category)} 条目</em>
            </div>
          </div>
        ))}
      </div>
      <div className={s.sortRuleFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} feedback={{ title: `${title} 排序已保存` }}>保存此维度</Button>
      </div>
    </section>
  );
}

function TemplatesPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="模板"
        title="项目模板"
        subtitle="管理可复用的小节结构、默认参数和预设导入配置。"
        actions={<ButtonLink href="/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>}
      />
      <div className={s.rowList}>
        {data.templates.map((template) => (
          <article className={s.templateListItem} key={template.id}>
            <div className={s.templateListMain}>
              <div className={s.templateListTitle}>
                <Link href={demoHref(`/templates/${template.id}/edit`)}>
                  <Layers3 className={s.icon} />
                  <strong>{template.name}</strong>
                </Link>
                <span>{template.description || "未填写描述"}</span>
              </div>
              <div className={s.templateSectionSummary}>
                {template.sections.slice(0, 5).map((section, index) => (
                  <Link href={demoHref(`/templates/${template.id}/sections/${index}`)} key={section.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {section.name}
                  </Link>
                ))}
                {template.sections.length > 5 ? <em>+{template.sections.length - 5}</em> : null}
              </div>
            </div>
            <div className={s.templateListMeta}>
              <span className={s.badge}>{template.sectionCount} 小节</span>
              <span className={s.badge}>更新 {template.updatedAt}</span>
              <div className={s.toolbar}>
                <ButtonLink href={`/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
                <Button tone="danger" icon={Trash2}>删除</Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function TemplateFormPage({ template, mode }: { template?: DemoTemplate; mode: "new" | "edit" }) {
  const sections = template?.sections ?? [];
  const content = (
    <div className={s.editorSurface}>
      <section className={s.editorBlock}>
        <div className={s.editorBlockHeader}>
          <div>
            <strong>模板信息</strong>
            <span>{mode === "new" ? "先填写模板信息，再配置小节。" : "右侧小节导航同步当前列表。"}</span>
          </div>
          <StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />
        </div>
        <div className={s.fieldGrid}>
          <Field label="名称" value={template?.name ?? "新项目模板"} />
          <TextAreaField label="描述" value={template?.description || "记录模板用途、默认预设绑定和生成流程。"} />
        </div>
      </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>小节配置</strong>
                <span>排序、复制、删除，点击行进入小节编辑。</span>
          </div>
          <Button icon={Plus} feedback={{ title: "小节草稿已添加" }}>添加小节</Button>
        </div>
            <div className={s.templateSectionList}>
              {sections.length ? (
            sections.map((section, index) => (
              <TemplateSectionRow
                index={index}
                key={section.id}
                section={section}
                template={template}
              />
            ))
          ) : (
            <div className={s.empty}>创建模板后可以添加第一个小节</div>
              )}
            </div>
            <OperationStateStrip
              items={[
                { label: "排序", value: "拖拽释放后保存", tone: "info" },
                { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
                { label: "错误", value: "0", tone: "success" },
              ]}
            />
          </section>
    </div>
  );

  if (mode === "edit" && template) {
    return (
      <div className={s.page}>
        <PageHeader
          back={{ href: "/templates", label: "返回模板列表" }}
          eyebrow="模板"
          title={template.name}
          subtitle={`${template.sectionCount} 个小节`}
          actions={
            <Button icon={Plus} feedback={{ title: "小节草稿已添加", detail: template.name }}>添加小节</Button>
          }
        />
        <TemplateSectionShell template={template} mode="template-edit">
          {content}
        </TemplateSectionShell>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/templates", label: "返回模板列表" }}
        eyebrow="模板"
        title="新建项目模板"
        subtitle="先填写模板信息，再添加可复用的小节配置。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "模板创建已排队" }}>创建模板</Button>}
      />
      {content}
    </div>
  );
}

function TemplateSectionRow({
  index,
  section,
  template,
}: {
  index: number;
  section: DemoTemplateSection;
  template?: DemoTemplate;
}) {
  const href = template ? `/templates/${template.id}/sections/${index}` : "/templates/new";

  return (
    <article
      className={s.templateSectionRow}
      data-section-card={section.id}
      id={templateSectionAnchorId(section)}
    >
      <button className={s.dragHandle} type="button" aria-label="排序手柄">
        <GripVertical className={s.icon} />
      </button>
      <Link className={s.templateSectionRowMain} href={demoHref(href)}>
        <span className={s.templateSectionTitleLine}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{section.name || "未命名小节"}</strong>
        </span>
        <p>{section.notes || "继承模板默认备注"}</p>
        <div className={s.sectionMetaGrid}>
          <span>{section.aspectRatio}</span>
          <span>批量 {section.batchSize}</span>
          <span>KSampler 继承</span>
          <span>Prompt / LoRA</span>
        </div>
      </Link>
      <div className={s.templateSectionRowActions}>
        <ButtonLink href={href} icon={SlidersHorizontal}>编辑</ButtonLink>
        <Button tone="subtle" icon={Copy} feedback={{ title: "模板小节已复制", detail: section.name }}>复制</Button>
        <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除小节需要确认", detail: section.name }}>删除</Button>
      </div>
    </article>
  );
}

function TemplateSectionPage({ template, sectionIndex }: { template: DemoTemplate | undefined; sectionIndex: string | undefined }) {
  const index = Number(sectionIndex ?? "0");
  const safeIndex = Number.isFinite(index) ? index : 0;
  const section = template?.sections[safeIndex] ?? template?.sections[0];
  if (!template || !section) return <EmptyPage title="没有模板小节" />;
  const currentIndex = template.sections.findIndex((item) => item.id === section.id);
  const previousSection = currentIndex > 0 ? template.sections[currentIndex - 1] : null;
  const nextSection = currentIndex >= 0 && currentIndex < template.sections.length - 1 ? template.sections[currentIndex + 1] : null;
  const promptBlocks = [
    { label: "主体", positive: `${section.name} 正向提示词`, negative: "低质量、模糊" },
    { label: "风格", positive: section.notes || `${template.name} 风格提示词`, negative: "结构错误、多余手指" },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/templates/${template.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${template.name} / ${section.name}`}
        subtitle="连续编辑参数、导入绑定、Prompt Blocks 与 LoRA 模板。"
        actions={
          <>
            <Button icon={Copy} feedback={{ title: "模板小节已复制", detail: section.name }}>复制小节</Button>
            <Button tone="primary" icon={Save} feedback={{ title: "模板小节已保存", detail: section.name }}>已保存</Button>
          </>
        }
      />
      <TemplateSectionShell activeSection={section} template={template} mode="template-section">
        <div className={s.editorSurface}>
          <div className={s.editorStickyHeader} data-section-card={section.id} id={templateSectionAnchorId(section)}>
            <div className={s.editorIdentity}>
              <span>#{String(currentIndex + 1).padStart(2, "0")}</span>
              <strong>{section.name}</strong>
              <em>{section.aspectRatio} · 批量 {section.batchSize} · 模板小节</em>
            </div>
            <div className={s.toolbar}>
              {previousSection ? (
                <ButtonLink href={`/templates/${template.id}/sections/${currentIndex - 1}`} tone="subtle" icon={ArrowLeft}>
                  上一节
                </ButtonLink>
              ) : null}
              {nextSection ? (
                <ButtonLink href={`/templates/${template.id}/sections/${currentIndex + 1}`} tone="subtle" icon={ArrowRight}>
                  下一节
                </ButtonLink>
              ) : null}
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>运行参数</strong>
                <span>空值表示导入到项目时不覆盖项目默认参数。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.fieldGrid}>
              <Field label="小节名" value={section.name} />
              <SelectLike label="比例" value={section.aspectRatio} />
              <Field label="短边像素" value={768} />
              <Field label="批量数" value={section.batchSize} />
              <SelectLike label="Checkpoint" value="继承模板默认" />
              <SelectLike label="Upscale" value="2x / 可清除" />
            </div>
            <div className={s.editorStatusStrip}>
              <span>KSampler 1: 28 steps · CFG 7</span>
              <span>KSampler 2: 18 steps · CFG 5.5</span>
              <span>已保存</span>
            </div>
            <OperationStateStrip
              items={[
                { label: "节流保存", value: "800ms", tone: "info" },
                { label: "保存队列", value: "空", tone: "success" },
                { label: "校验", value: "通过", tone: "success" },
              ]}
            />
          </section>

          <section className={s.editorSplitBlock}>
            <div className={s.editorBlock}>
              <div className={s.editorBlockHeader}>
                <div>
                  <strong>预设绑定</strong>
                  <span>绑定可切换 variant，也可只删除当前小节中的导入内容。</span>
                </div>
                <Button icon={Download} feedback={{ title: "导入预设面板已准备" }}>导入预设</Button>
              </div>
              <div className={s.bindingList}>
                {["角色", "风格", "场景"].map((name, bindingIndex) => (
                  <div className={s.bindingRow} key={name}>
                    <div>
                      <strong>{name} · {bindingIndex === 0 ? section.name : template.name}</strong>
                      <span>{bindingIndex + 1} 个 prompt block · {bindingIndex + 1} 个 LoRA</span>
                    </div>
                    <SelectLike label="变体" value={bindingIndex === 0 ? "默认" : "继承"} />
                    <Button tone="subtle" icon={Trash2} feedback={{ tone: "warning", title: "绑定移除已排队", detail: name }}>移除</Button>
                  </div>
                ))}
              </div>
            </div>
            <aside className={s.editorAside}>
              <strong>继承预览</strong>
              <div className={s.historyDiffList}>
                <div className={s.historyDiffRow}>
                  <strong>导入到项目</strong>
                  <span>复制小节结构、Prompt Blocks、LoRA 与参数空值。</span>
                </div>
                <div className={s.historyDiffRow}>
                  <strong>项目覆盖</strong>
                  <span>项目默认 checkpoint 和尺寸参数可继续覆盖模板空值。</span>
                </div>
              </div>
              <ButtonLink href={`/templates/${template.id}/edit`} icon={Rows3}>回到小节列表</ButtonLink>
            </aside>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Prompt Blocks</strong>
                <span>模板使用和项目小节一致的 block 结构。</span>
              </div>
              <Button icon={Plus} feedback={{ title: "Prompt Block 已添加" }}>添加 Block</Button>
            </div>
            <div className={s.promptBlockList}>
              {promptBlocks.map((block, blockIndex) => (
                <div className={s.promptBlockRow} key={block.label}>
                  <button className={s.dragHandle} type="button" aria-label="排序手柄">
                    <GripVertical className={s.icon} />
                  </button>
                  <div className={s.promptBlockContent}>
                    <div className={s.promptBlockTitle}>
                      <strong>{String(blockIndex + 1).padStart(2, "0")} · {block.label}</strong>
                      <span>template block</span>
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
                <strong>LoRA 模板</strong>
                <span>阶段 1 / 阶段 2 与项目小节保持同样的配置密度。</span>
              </div>
              <Button icon={Plus}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              {["LoRA 1", "LoRA 2"].map((stage, stageIndex) => (
                <div className={s.loraStage} key={stage}>
                  <strong>{stage}</strong>
                  {[0, 1].map((itemIndex) => (
                    <div className={s.loraRow} key={`${stage}-${itemIndex}`}>
                      <span>{stageIndex === 0 ? section.name : template.name}</span>
                      <em>weight {(0.7 + itemIndex * 0.1).toFixed(2)}</em>
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
                <span>分类、文件夹、预设组和变体选择保持在同一个导入面板。</span>
              </div>
              <Button tone="primary" icon={Plus}>追加到模板</Button>
            </div>
            <div className={s.importPresetLayout}>
              <div className={s.importCategoryColumn}>
                {["角色", "风格", "姿势", "场景"].map((name, categoryIndex) => (
                  <button className={categoryIndex === 0 ? s.importCategoryActive : ""} type="button" key={name}>
                    {name}
                  </button>
                ))}
              </div>
              <div className={s.importPresetColumn}>
                <div className={s.presetContextBar}>
                  <span className={s.badge}>根目录 / 模板候选</span>
                  <span className={s.badge}>2 个变体可用</span>
                </div>
                {["中野三玖校服", "二次元默认", "放学后教室"].map((name, presetIndex) => (
                  <div className={s.contentRow} key={name}>
                    <div className={s.contentRowHeader}>
                      <div className={s.contentRowTitle}>
                        <strong>{name}</strong>
                        <span>{presetIndex + 2} variants · prompt + LoRA</span>
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
                <span>模板小节按参数、Prompt、LoRA 维度记录 diff。</span>
              </div>
            </div>
            <div className={s.historyDiffList}>
              {["运行参数", "Prompt", "LoRA"].map((name, historyIndex) => (
                <div className={s.historyDiffRow} key={name}>
                  <strong>{name}</strong>
                  <span>{historyIndex === 0 ? "批量 1 → 2" : historyIndex === 1 ? "追加主体 block" : "LoRA 权重 0.60 → 0.70"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </TemplateSectionShell>
    </div>
  );
}

function templateSectionAnchorId(section: DemoTemplateSection) {
  return `template-section-${section.id}`;
}

function templateSectionHref(template: DemoTemplate, section: DemoTemplateSection, index: number, mode: TemplateSectionMode) {
  if (mode === "template-edit") return `${demoHref(`/templates/${template.id}/edit`)}#${templateSectionAnchorId(section)}`;
  return demoHref(`/templates/${template.id}/sections/${index}`);
}

function TemplateSectionShell({
  activeSection,
  children,
  mode,
  template,
}: {
  activeSection?: DemoTemplateSection;
  children: React.ReactNode;
  mode: TemplateSectionMode;
  template: DemoTemplate;
}) {
  const defaultActiveSectionId = activeSection?.id ?? template.sections[0]?.id ?? null;
  const [activeSectionState, setActiveSectionState] = useState({
    templateId: template.id,
    sectionId: defaultActiveSectionId,
  });
  const activeSectionId = activeSectionState.templateId === template.id ? activeSectionState.sectionId : defaultActiveSectionId;
  const displayedActiveSectionId = mode === "template-section" && activeSection ? activeSection.id : activeSectionId;
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
      if (nextId) setActiveSectionState({ templateId: template.id, sectionId: nextId });
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
  }, [template.id, syncScroll]);

  function handleNavigateSection(section: DemoTemplateSection) {
    setActiveSectionState({ templateId: template.id, sectionId: section.id });
    if (mode !== "template-edit") return;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`#${CSS.escape(templateSectionAnchorId(section))}`);
    if (!content || !target) return;
    const targetTop = target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop;
    content.scrollTop = targetTop;
  }

  return (
    <div className={s.projectSectionShell}>
      <div className={s.projectScrollPane} ref={contentRef}>
        {children}
      </div>
      <TemplateSectionRail
        activeSectionId={displayedActiveSectionId}
        mode={mode}
        onNavigateSection={handleNavigateSection}
        ref={railRef}
        template={template}
      />
    </div>
  );
}

const TemplateSectionRail = forwardRef<HTMLElement, {
  activeSectionId?: string | null;
  mode: TemplateSectionMode;
  onNavigateSection?: (section: DemoTemplateSection) => void;
  template: DemoTemplate;
}>(function TemplateSectionRail(
  {
    activeSectionId,
    mode,
    onNavigateSection,
    template,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? template.sections[0]?.id ?? null;

  return (
    <nav className={s.sectionRail} ref={ref} aria-label="模板小节导航">
      <div className={s.railHeading}>
        <strong>小节导航</strong>
        <span>{template.sections.length} 小节</span>
      </div>
      {template.sections.map((section, index) => (
        <Link
          className={cx(s.railItem, resolvedActiveId === section.id && s.railItemActive)}
          href={templateSectionHref(template, section, index, mode)}
          key={section.id}
          onClick={(event) => {
            if (mode === "template-edit") event.preventDefault();
            onNavigateSection?.(section);
          }}
        >
          <strong>{section.name}</strong>
          <span className={cx(s.small, s.muted)}>{section.aspectRatio} / 批量 {section.batchSize}</span>
        </Link>
      ))}
    </nav>
  );
});

function SettingsPage({ data }: { data: DemoData }) {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="设置"
        title="设置"
        subtitle="系统配置入口；预设管理在预设库，项目模板在模板页。"
      />
      <div className={s.settingsLinkList}>
        {[
          { title: "ComfyUI 监控", href: "/settings/monitor", icon: Monitor, meta: "进程状态、健康检查、启停控制" },
          { title: "后端日志", href: "/settings/logs", icon: History, meta: `${data.auditLogs.length} 条记录 · 项目执行与错误信息` },
        ].map((item) => (
          <Link className={s.settingsLinkRow} href={demoHref(item.href)} key={item.href}>
            <div className={s.settingsLinkMain}>
              <item.icon className="size-4" />
              <div className={s.settingsLinkText}>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
              </div>
            </div>
            <div className={s.settingsLinkArrow}>
              <ArrowRight className="size-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LogsPage({ data }: { data: DemoData }) {
  const [source, setSource] = useState<LogDemoSource>("app");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const consoleRows = [
    { id: "console-1", createdAt: "server.log", entityType: "next", action: "ready", actorType: "console" },
    { id: "console-2", createdAt: "server.log", entityType: "worker", action: "heartbeat", actorType: "console" },
    { id: "console-3", createdAt: "server.log", entityType: "comfy", action: "probe", actorType: "console" },
    { id: "console-4", createdAt: "server.log", entityType: "image", action: "warn", actorType: "console" },
  ];
  const auditRows = data.auditLogs.length ? data.auditLogs : [
    { id: "audit-1", createdAt: "刚刚", entityType: "Run", action: "created", actorType: "system" },
    { id: "audit-2", createdAt: "3 分钟前", entityType: "ImageResult", action: "reviewed", actorType: "user" },
    { id: "audit-3", createdAt: "12 分钟前", entityType: "ProjectSection", action: "updated", actorType: "user" },
  ];
  const rows = source === "console" ? consoleRows : auditRows;
  const logLines = rows.map((row, index) => {
    const entityLabel = row.entityType === "ProjectSection"
      ? "项目小节"
      : row.entityType === "ImageResult"
        ? "图片结果"
        : row.entityType === "Run"
          ? "任务"
          : row.entityType.toLowerCase();
    const actionLabel = row.action === "ready"
      ? "就绪"
      : row.action === "heartbeat"
        ? "心跳"
        : row.action === "probe"
          ? "探测"
          : row.action === "warn"
            ? "警告"
            : row.action === "created"
              ? "创建"
              : row.action === "reviewed"
                ? "审核"
                : row.action === "updated"
                  ? "更新"
                  : row.action;
    const inferredLevel = row.action.toLowerCase().includes("error") || row.action.toLowerCase().includes("failed")
      ? "error"
      : row.action.toLowerCase().includes("warn")
        ? "warn"
        : "info";
    return {
      ...row,
      level: inferredLevel,
      module: entityLabel,
      message: source === "console"
        ? `${entityLabel}: ${actionLabel} · ${data.source.comfyApiLabel || data.source.databaseLabel || "local"}`
        : `${row.actorType === "system" ? "系统" : "用户"}${actionLabel}${entityLabel}`,
      time: source === "console" ? `+${String(index * 18).padStart(3, "0")}s` : row.createdAt,
    };
  });
  const modules = ["all", ...Array.from(new Set(logLines.map((line) => line.module))).slice(0, 5)];
  const visibleRows = logLines.filter((row) => (level === "all" || row.level === level) && (moduleFilter === "all" || row.module === moduleFilter));
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="日志"
        title="后端日志"
        subtitle="按来源、级别和模块筛选日志，保持自动滚动和空状态表达。"
        actions={<Button icon={Search} feedback={{ title: "日志刷新已排队" }}>刷新日志</Button>}
      />
      <div className={s.logWorkbench}>
        <section className={s.logFilterBar}>
          <DemoTabs
            tabs={[
              { key: "app", label: "应用日志", count: auditRows.length },
              { key: "console", label: "控制台输出", count: consoleRows.length },
            ]}
            value={source}
            onChange={(next) => {
              setSource(next);
              setModuleFilter("all");
            }}
          />
          <DemoTabs
            tabs={[
              { key: "all", label: "全部" },
              { key: "info", label: "INFO" },
              { key: "warn", label: "WARN" },
              { key: "error", label: "ERROR" },
            ]}
            value={level}
            onChange={setLevel}
          />
          <div className={s.logModuleChips}>
            {modules.map((moduleName) => (
              <button
                className={cx(s.logModuleChip, moduleFilter === moduleName && s.logModuleChipActive)}
                key={moduleName}
                type="button"
                onClick={() => setModuleFilter(moduleName)}
              >
                {moduleName === "all" ? "全部模块" : moduleName}
              </button>
            ))}
          </div>
        </section>
        <section className={s.logViewerPanel}>
          <div className={s.logViewerHeader}>
            <div>
              <strong>{source === "console" ? "server.log" : "审计流"}</strong>
              <span>{visibleRows.length} 行 · 自动滚动 · 跟随尾部</span>
            </div>
            <StatusBadge status={visibleRows.length ? "ready" : "draft"} label={visibleRows.length ? "实时" : "空"} />
          </div>
          <div className={s.logViewer}>
            {visibleRows.length ? visibleRows.map((log) => (
              <div className={cx(s.logLine, log.level === "warn" && s.logLineWarn, log.level === "error" && s.logLineError)} key={log.id}>
                <span>{log.time}</span>
                <em>{log.level}</em>
                <strong>{log.module}</strong>
                <code>{log.message}</code>
              </div>
            )) : (
              <div className={s.logEmpty}>当前筛选没有日志</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MonitorPage({ data }: { data: DemoData }) {
  const [mode, setMode] = useState<"managed" | "external">("managed");
  const running = data.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  const processLines = [
    "worker 心跳正常",
    `ComfyUI API ${data.source.comfyApiLabel || "http://127.0.0.1:8188"} 可访问`,
    `本地任务池中有 ${running} 个处理中任务`,
    "探测延迟 42ms",
  ];
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="监控"
        title="ComfyUI 监控"
        subtitle="管理内置进程或外部连接，覆盖启动、停止、重启、探测和进程日志。"
        actions={<Button tone="primary" icon={Activity} feedback={{ title: "连接探测已完成", detail: "42ms" }}>探测连接</Button>}
      />
      <div className={s.monitorWorkbench}>
        <main className={s.monitorMain}>
          <section className={s.monitorControlPanel}>
            <div className={s.monitorHeader}>
              <div>
                <strong>{mode === "managed" ? "托管进程" : "外部 ComfyUI"}</strong>
                <span>{mode === "managed" ? "由本应用启动和重启 ComfyUI" : "连接已由用户维护的外部服务"}</span>
              </div>
              <div className={s.segmented}>
                <button className={cx(s.segment, mode === "managed" && s.segmentActive)} type="button" onClick={() => setMode("managed")}>托管</button>
                <button className={cx(s.segment, mode === "external" && s.segmentActive)} type="button" onClick={() => setMode("external")}>外部</button>
              </div>
            </div>
            <div className={s.monitorStatusGrid}>
              <div className={s.monitorStatusRow}>
                <Gauge className={s.icon} />
                <div>
                  <strong>Worker</strong>
                  <span>心跳正常，轮询窗口稳定。</span>
                </div>
                <StatusBadge status="ready" label="正常" />
              </div>
              <div className={s.monitorStatusRow}>
                <Monitor className={s.icon} />
                <div>
                  <strong>ComfyUI API</strong>
                  <span>{data.source.comfyApiLabel || "未配置 endpoint"}</span>
                </div>
                <StatusBadge status={mode === "managed" ? "running" : "monitor"} label={mode === "managed" ? "运行中" : "外部"} />
              </div>
              <div className={s.monitorStatusRow}>
                <ClipboardList className={s.icon} />
                <div>
                  <strong>任务积压</strong>
                  <span>{running} 个待处理 / 运行中，{data.metrics.pendingImages} 张待审。</span>
                </div>
                <StatusBadge status={running ? "pending" : "ready"} label={running ? "忙碌" : "空闲"} />
              </div>
            </div>
            <div className={s.monitorActions}>
              <Button icon={Play} feedback={{ title: "启动命令已发送" }}>启动</Button>
              <Button tone="danger" icon={X} feedback={{ tone: "warning", title: "停止命令需要确认" }}>停止</Button>
              <Button icon={Activity} feedback={{ title: "重启命令已发送" }}>重启</Button>
              <Button icon={Search} feedback={{ title: "探测已完成", detail: "HTTP 200" }}>探测</Button>
            </div>
          </section>

          <section className={s.monitorLogPanel}>
            <div className={s.logViewerHeader}>
              <div>
                <strong>进程日志</strong>
                <span>{mode === "managed" ? "stdout / stderr" : "probe result"}</span>
              </div>
              <StatusBadge status="ready" label="跟随" />
            </div>
            <div className={s.logViewer}>
              {processLines.map((line, index) => (
                <div className={s.logLine} key={line}>
                  <span>+{String(index * 12).padStart(3, "0")}s</span>
                  <em>info</em>
                  <strong>{mode}</strong>
                  <code>{line}</code>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={s.monitorAside}>
          <div className={s.monitorProbeBox}>
            <strong>探测结果</strong>
            <span>HTTP 200 · runs endpoint 正常 · history endpoint 正常</span>
            <StatusBadge status="ready" label="42ms" />
          </div>
          <div className={s.monitorProbeBox}>
            <strong>数据库</strong>
            <span>{data.source.databaseLabel || "本地 SQLite"}</span>
            <StatusBadge status="monitor" label="已连接" />
          </div>
          <div className={s.monitorProbeBox}>
            <strong>文件日志</strong>
            <span>{data.source.warning ?? "LOG_ENABLE_FILE 启用时写入本地日志。"}</span>
            <StatusBadge status="draft" label="配置" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function LoginPage() {
  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="登录"
        title="登录"
        subtitle="使用本地访问令牌进入工作台。"
      />
      <Panel title="访问令牌">
        <div className={s.grid}>
          <Field label="Token" value="本地访问令牌" />
          <div className={s.toolbar}>
            <Button tone="primary" icon={Lock} feedback={{ title: "登录验证已通过" }}>登录</Button>
            <Button icon={X} feedback={{ title: "输入已清除" }}>清除</Button>
          </div>
          <OperationStateStrip
            items={[
              { label: "验证", value: "待输入", tone: "info" },
              { label: "返回", value: "任务工作台", tone: "success" },
              { label: "错误", value: "0", tone: "success" },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}

function NotFoundPage({ route }: { route: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="404" title="未匹配页面" subtitle={route} actions={<ButtonLink href="/runs" icon={Home}>返回任务</ButtonLink>} />
      <RouteTable data={fallbackRouteData} />
    </div>
  );
}

const fallbackRouteData: DemoData = {
  source: {
    loadedFromSqlite: false,
    databaseLabel: "",
    imageSourceLabel: "",
    modelBaseLabel: "",
    comfyApiLabel: "",
    warning: null,
  },
  metrics: { projects: 0, sections: 0, runs: 0, pendingImages: 0, presets: 0, templates: 0, loras: 0 },
  projects: [],
  runs: [],
  categories: [],
  templates: [],
  loras: [],
  models: [],
  auditLogs: [],
  images: [],
};

function CurrentPage({ match, data }: { match: Match; data: DemoData }) {
  const project = findProject(data, match.params.projectId);
  const section = findSection(project, match.params.sectionId);
  const template = findTemplate(data, match.params.templateId);

  switch (match.key) {
    case "root":
      return <RootPage data={data} />;
    case "queue":
      return <QueuePage data={data} />;
    case "queue-review":
      return <ReviewPage data={data} run={findRun(data, match.params.runId)} />;
    case "projects":
      return <ProjectsPage data={data} />;
    case "project-new":
      return <ProjectFormPage mode="new" />;
    case "project-detail":
      return <ProjectDetailPage project={project} />;
    case "project-edit":
      return <ProjectFormPage mode="edit" project={project} />;
    case "project-results":
      return <ProjectDetailPage project={project} initialView="results" />;
    case "project-batch":
      return <BatchCreatePage project={project} data={data} />;
    case "section-editor":
      return <SectionEditorPage project={project} section={section} />;
    case "section-results":
      return <SectionResultsPage project={project} section={section} />;
    case "models":
      return <ModelsPage data={data} />;
    case "loras":
      return <LorasPage data={data} />;
    case "presets":
      return <PresetsPage data={data} />;
    case "preset-category-new":
      return <PresetCategoryFormPage data={data} mode="new" category={undefined} />;
    case "preset-category-edit":
      return <PresetCategoryFormPage data={data} mode="edit" category={findCategory(data, match.params.categoryId)} />;
    case "preset-edit":
      return <PresetEditPage data={data} preset={findPreset(data, match.params.presetId)} />;
    case "preset-groups":
      return <PresetGroupPage data={data} group={findGroup(data, match.params.groupId)} />;
    case "sort-rules":
      return <SortRulesPage data={data} />;
    case "templates":
      return <TemplatesPage data={data} />;
    case "template-new":
      return <TemplateFormPage mode="new" />;
    case "template-edit":
      return <TemplateFormPage mode="edit" template={template} />;
    case "template-section":
      return <TemplateSectionPage template={template} sectionIndex={match.params.sectionIndex} />;
    case "settings":
      return <SettingsPage data={data} />;
    case "logs":
      return <LogsPage data={data} />;
    case "monitor":
      return <MonitorPage data={data} />;
    case "login":
      return <LoginPage />;
    default:
      return <NotFoundPage route={match.route} />;
  }
}

export function DesignDemoApp({
  initialRouteSegments,
  data,
}: {
  initialRouteSegments: string[];
  data: DemoData;
}) {
  const pathname = usePathname();
  const currentRoute = productRouteFromPathname(pathname, initialRouteSegments);
  const match = matchRoute(currentRoute);

  return (
    <DesignDemoShell data={data} currentRoute={currentRoute}>
      <CurrentPage match={match} data={data} />
    </DesignDemoShell>
  );
}

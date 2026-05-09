"use client";

import Link from "next/link";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { Archive, ArrowLeft, Check, CheckSquare, ChevronDown, ChevronRight, ChevronUp, Copy, Download, Edit3, Eye, Folder, FolderInput, FolderPlus, GripVertical, ImageIcon, ListChecks, Pencil, Play, Plus, Rows3, Save, Square, Star, Trash2, X } from "lucide-react";

import type { DemoData, DemoImage, DemoProject, DemoProjectFolder, DemoSection } from "./design-demo-data";
import s from "./design-demo-styles";
import { Button, ButtonLink, DemoTabs, EmptyPage, Field, ImageGrid, ImageStrip, PageHeader, Panel, SelectLike, StatusBadge, SwitchRow, TextAreaField } from "./design-demo-ui";
import { compactFileName, cx, demoHref, filterImages, projectPresetSummary, rawSectionId, sectionAnchorId, sectionRunStatus } from "./design-demo-utils";
import type { ProjectCardView, ResultDemoFilter, SectionNavMode } from "./design-demo-utils";
import { QueuePage } from "./runs-page";
export function RootPage({ data }: { data: DemoData }) {
  return <QueuePage data={data} />;
}

export function ProjectsPage({ data }: { data: DemoData }) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("角色组探索");
  const folders = data.projectFolders;
  const visibleFolders = folders
    .filter((folder) => folder.parentId === currentFolderId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleProjects = data.projects.filter((project) => project.folderId === currentFolderId);
  const breadcrumb = buildProjectFolderBreadcrumb(folders, currentFolderId);
  const selectedProjects = visibleProjects.filter((project) => selectedIds.has(project.id));
  const currentFolderName = breadcrumb.at(-1)?.name ?? "根目录";
  const createProjectHref = currentFolderId ? `/projects/new?folder=${encodeURIComponent(currentFolderId)}` : "/projects/new";

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function moveProjects(folderId: string | null) {
    const movedIds = new Set(selectedProjects.map((project) => project.id));
    setSelectedIds((current) => new Set(Array.from(current).filter((id) => !movedIds.has(id))));
    setCurrentFolderId(folderId);
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="项目"
        title="项目列表"
        subtitle={`${data.projects.length} 个项目 · ${folders.length} 个文件夹 · 当前：${currentFolderName}`}
        actions={<ButtonLink href={createProjectHref} tone="primary" icon={Plus}>创建项目</ButtonLink>}
      />
      <section className={s.projectFolderWorkspace} aria-label="项目文件夹管理">
        <div className={s.projectFolderTopbar}>
          <ProjectFolderBreadcrumb breadcrumb={breadcrumb} onNavigate={navigateFolder} />
          <div className={s.projectFolderActions}>
            <Button tone="subtle" icon={FolderPlus} onClick={() => setIsCreatingFolder(true)}>
              新建文件夹
            </Button>
            <ButtonLink href={createProjectHref} tone="primary" icon={Plus}>创建项目</ButtonLink>
          </div>
        </div>

        {selectedIds.size > 0 ? (
          <ProjectBatchBar
            folders={folders}
            selectedCount={selectedIds.size}
            totalCount={visibleProjects.length}
            onClear={() => setSelectedIds(new Set())}
            onMove={moveProjects}
            onSelectAll={() => setSelectedIds(new Set(visibleProjects.map((project) => project.id)))}
          />
        ) : null}

        {isCreatingFolder ? (
          <div className={s.projectFolderDraftRow}>
            <Folder className={s.icon} />
            <input
              aria-label="文件夹名称"
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsCreatingFolder(false);
              }}
            />
            <Button
              icon={Save}
              disabled={!newFolderName.trim()}
              feedback={{ title: "文件夹创建动作已预览", detail: `${currentFolderName} / ${newFolderName.trim() || "未命名"}` }}
              onClick={() => setIsCreatingFolder(false)}
            >
              保存
            </Button>
            <button className={s.iconMiniButton} type="button" onClick={() => setIsCreatingFolder(false)} aria-label="取消新建文件夹">
              <X className={s.icon} />
            </button>
          </div>
        ) : null}

        <div className={s.projectFolderSurface}>
          {visibleFolders.length ? (
            <div className={s.projectFolderGrid}>
              {visibleFolders.map((folder) => (
                <ProjectFolderRow
                  folder={folder}
                  itemCount={countProjectFolderItems(folder.id, folders, data.projects)}
                  key={folder.id}
                  onEnter={() => navigateFolder(folder.id)}
                />
              ))}
            </div>
          ) : null}

          {visibleProjects.length ? (
            <div className={s.projectListGrid}>
              {visibleProjects.map((project) => (
                <ProjectListItem
                  folders={folders}
                  key={project.id}
                  project={project}
                  selected={selectedIds.has(project.id)}
                  onMove={(folderId) => navigateFolder(folderId)}
                  onToggleSelected={() => toggleProjectSelection(project.id)}
                />
              ))}
            </div>
          ) : visibleFolders.length ? null : (
            <div className={s.projectFolderEmpty}>
              <Folder className={s.icon} />
              <strong>{currentFolderId ? "此文件夹为空" : "暂无项目"}</strong>
              <span>{currentFolderId ? "可以创建新项目，或从其他文件夹移动项目到这里。" : "创建项目或新建文件夹后会显示在这里。"}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function buildProjectFolderBreadcrumb(folders: DemoProjectFolder[], currentFolderId: string | null) {
  const path: DemoProjectFolder[] = [];
  let folderId = currentFolderId;
  while (folderId) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) break;
    path.unshift(folder);
    folderId = folder.parentId;
  }
  return path;
}

function countProjectFolderItems(folderId: string, folders: DemoProjectFolder[], projects: DemoProject[]) {
  return folders.filter((folder) => folder.parentId === folderId).length + projects.filter((project) => project.folderId === folderId).length;
}

function ProjectFolderBreadcrumb({
  breadcrumb,
  onNavigate,
}: {
  breadcrumb: DemoProjectFolder[];
  onNavigate: (folderId: string | null) => void;
}) {
  return (
    <div className={s.projectFolderBreadcrumbs} aria-label="项目文件夹路径">
      <button type="button" onClick={() => onNavigate(null)} disabled={breadcrumb.length === 0}>
        根目录
      </button>
      {breadcrumb.map((folder, index) => (
        <span key={folder.id}>
          <ChevronRight className={s.icon} />
          <button
            type="button"
            onClick={() => onNavigate(folder.id)}
            disabled={index === breadcrumb.length - 1}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </div>
  );
}

function ProjectFolderRow({
  folder,
  itemCount,
  onEnter,
}: {
  folder: DemoProjectFolder;
  itemCount: number;
  onEnter: () => void;
}) {
  return (
    <div className={s.projectFolderRow}>
      <button className={s.projectFolderGrip} type="button" aria-label="排序手柄">
        <GripVertical className={s.icon} />
      </button>
      <button className={s.projectFolderOpen} type="button" onClick={onEnter}>
        <Folder className={s.icon} />
        <strong>{folder.name}</strong>
        <span>{itemCount} 项</span>
        <ChevronRight className={s.icon} />
      </button>
      <div className={s.projectFolderRowActions}>
        <button type="button" aria-label={`重命名文件夹：${folder.name}`}>
          <Pencil className={s.icon} />
        </button>
        {itemCount === 0 ? (
          <button type="button" aria-label={`删除文件夹：${folder.name}`}>
            <Trash2 className={s.icon} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ProjectBatchBar({
  folders,
  selectedCount,
  totalCount,
  onClear,
  onMove,
  onSelectAll,
}: {
  folders: DemoProjectFolder[];
  selectedCount: number;
  totalCount: number;
  onClear: () => void;
  onMove: (folderId: string | null) => void;
  onSelectAll: () => void;
}) {
  return (
    <div className={s.projectBatchBar}>
      <strong>已选 {selectedCount} 个项目</strong>
      <div>
        <ProjectMoveMenu folders={folders} currentFolderId={null} onMove={onMove} label="移至文件夹" />
        <button type="button" onClick={selectedCount === totalCount ? onClear : onSelectAll}>
          {selectedCount === totalCount ? "取消全选" : "全选"}
        </button>
        <button type="button" onClick={onClear} aria-label="清除选择">
          <X className={s.icon} />
        </button>
      </div>
    </div>
  );
}

function ProjectListItem({
  folders,
  project,
  selected,
  onMove,
  onToggleSelected,
}: {
  folders: DemoProjectFolder[];
  project: DemoProject;
  selected: boolean;
  onMove: (folderId: string | null) => void;
  onToggleSelected: () => void;
}) {
  return (
    <article className={cx(s.projectListCard, selected && s.projectListCardSelected)}>
      <button
        aria-label={selected ? `取消选择项目：${project.title}` : `选择项目：${project.title}`}
        aria-pressed={selected}
        className={s.projectSelectButton}
        type="button"
        onClick={onToggleSelected}
      >
        {selected ? <CheckSquare className={s.icon} /> : <Square className={s.icon} />}
      </button>
      <Link className={s.projectListOpenArea} href={demoHref(`/projects/${project.id}`)}>
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
      <div className={s.projectItemActions}>
        <ProjectMoveMenu folders={folders} currentFolderId={project.folderId} onMove={onMove} />
        <button type="button" aria-label={`删除项目：${project.title}`}>
          <Trash2 className={s.icon} />
        </button>
      </div>
    </article>
  );
}

function ProjectMoveMenu({
  currentFolderId,
  folders,
  label = "移动",
  onMove,
}: {
  currentFolderId: string | null;
  folders: DemoProjectFolder[];
  label?: string;
  onMove: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!folders.length) return null;
  const options = flattenProjectFolderOptions(folders);

  return (
    <div className={s.projectMoveMenu}>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <FolderInput className={s.icon} />
        <span>{label}</span>
      </button>
      {open ? (
        <div className={s.projectMoveMenuList}>
          {options.map((option) => (
            <button
              disabled={option.id === currentFolderId}
              key={option.id ?? "__root"}
              onClick={() => {
                onMove(option.id);
                setOpen(false);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function flattenProjectFolderOptions(folders: DemoProjectFolder[], parentId: string | null = null, depth = 0): Array<{ id: string | null; label: string }> {
  const options: Array<{ id: string | null; label: string }> = [];
  if (depth === 0) options.push({ id: null, label: "根目录" });
  const children = folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const child of children) {
    options.push({ id: child.id, label: `${"  ".repeat(depth + 1)}${child.name}` });
    options.push(...flattenProjectFolderOptions(folders, child.id, depth + 1));
  }
  return options;
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
  const sectionSummary = `${project.sectionCount} 个小节 · ${selectedIds.size ? `${selectedIds.size} 个已选` : "未选择小节"}`;

  function toggleSectionSelection(sectionId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
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
      <ProjectDetailHeader
        isResultView={isResultView}
        project={project}
        subtitle={project.notes ? `${project.notes} · ${sectionSummary}` : sectionSummary}
        view={initialView}
      />
      <ProjectSectionShell
        compact={compact}
        onToggleCompact={() => setCompact((value) => !value)}
        project={project}
        mode={isResultView ? "project-results" : "detail"}
      >
        <div className={s.sectionContentGrid}>
          {isResultView ? (
            <div className={s.projectSectionToolbar}>
              <div>
                <strong>小节结果</strong>
                <span>{projectImages.length} 张图片 · {projectImages.filter((image) => image.status === "pending").length} 张待审</span>
              </div>
              <div className={s.toolbar}>
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
              </div>
            </div>
          ) : null}
          <div className={cx(s.sectionCardList, compact && !isResultView && s.sectionCardListCompact)}>
            {sections.map((section, index) => (
              isResultView ? (
                <ProjectSectionResultCard
                  collapsed={collapsedSections.has(section.id)}
                  images={filterImages(section.images, filter)}
                  index={index}
                  key={section.id}
                  onToggleCollapsed={() => toggleCollapsed(section.id)}
                  section={section}
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

function ProjectDetailHeader({
  isResultView,
  project,
  subtitle,
  view,
}: {
  isResultView: boolean;
  project: DemoProject;
  subtitle: string;
  view: ProjectCardView;
}) {
  const [batchSize, setBatchSize] = useState(2);

  return (
    <header className={s.projectDetailHeader}>
      <div className={s.projectHeaderTop}>
        <div className={s.pageTitleBlock}>
          <ButtonLink href="/projects" tone="subtle" icon={ArrowLeft} className={s.pageBackLink}>
            返回项目列表
          </ButtonLink>
          <span className={s.eyebrow}>项目</span>
          <div className={s.projectTitleRow}>
            <h1 className={s.pageTitle}>{project.title}</h1>
            <ButtonLink href={`/projects/${project.id}/edit`} icon={Edit3} className={s.projectTitleEdit}>编辑</ButtonLink>
          </div>
          <div className={s.pageSubtitle}>{subtitle}</div>
        </div>
        <div className={s.projectHeaderControls}>
          <ProjectViewToggle projectId={project.id} value={view} />
        </div>
      </div>
      {!isResultView ? (
        <div className={s.projectCommandBar} role="toolbar" aria-label="项目命令">
          <div className={s.projectCommandSecondary}>
            <ButtonLink href={`/projects/${project.id}/batch-create`} tone="primary" icon={Rows3}>批量创建</ButtonLink>
            <Button icon={Download} feedback={{ title: "导入模板面板已准备" }}>导入模板</Button>
            <Button icon={ImageIcon} feedback={{ title: "图片整合已加入导出队列" }}>图片整合</Button>
            <Button icon={Save} feedback={{ title: "已保存为项目模板", detail: "使用当前小节结构和参数。" }}>保存模板</Button>
          </div>
          <div className={s.projectRunCluster} role="group" aria-label="整组运行">
            <span>批量张数</span>
            <BatchSizeSelector value={batchSize} onChange={setBatchSize} compact />
            <Button icon={Play} feedback={{ title: "整组运行已加入任务", detail: `${project.sectionCount} 个小节 · batch ${batchSize}` }}>整组运行</Button>
          </div>
        </div>
      ) : null}
    </header>
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

function BatchSizeSelector({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={cx(s.batchSizeSelector, compact && s.batchSizeSelectorCompact)} aria-label="批量张数">
      {[1, 2, 4, 8, 16].map((option) => (
        <button
          aria-pressed={value === option}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
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
  const defaultBatchSize = [1, 2, 4, 8, 16].includes(section.batchSize) ? section.batchSize : 2;
  const [batchSize, setBatchSize] = useState(defaultBatchSize);

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
            </div>
            <StatusBadge status={runStatus.status} label={runStatus.label} />
          </div>
          {!compact ? (
            <div className={s.sectionCardBody}>
              <ImageStrip images={section.images} wide />
            </div>
          ) : null}
        </Link>
      </div>
      <div className={s.sectionCardActions}>
        <div className={s.sectionRunControl}>
          <Button icon={Play} feedback={{ title: "小节运行已加入任务", detail: `${section.name} · batch ${batchSize}` }}>运行</Button>
          <BatchSizeSelector value={batchSize} onChange={setBatchSize} />
        </div>
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
  compact,
  onToggleCompact,
}: {
  project: DemoProject;
  activeSection?: DemoSection;
  mode: SectionNavMode;
  children: React.ReactNode;
  compact?: boolean;
  onToggleCompact?: () => void;
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
        compact={compact}
        mode={mode}
        onNavigateSection={handleNavigateSection}
        onToggleCompact={onToggleCompact}
      />
    </div>
  );
}

const SectionRail = forwardRef<HTMLElement, {
  project: DemoProject;
  activeSection?: DemoSection;
  activeSectionId?: string | null;
  compact?: boolean;
  mode?: SectionNavMode;
  onNavigateSection?: (section: DemoSection) => void;
  onToggleCompact?: () => void;
}>(function SectionRail(
  {
    project,
    activeSection,
    activeSectionId,
    compact,
    mode = "editor",
    onNavigateSection,
    onToggleCompact,
  },
  ref,
) {
  const resolvedActiveId = activeSectionId ?? activeSection?.id ?? project.sections[0]?.id ?? null;
  const showCompactToggle = mode === "detail" && onToggleCompact;
  const showReviewCounts = mode === "project-results" || mode === "section-results";
  return (
    <nav className={s.sectionRail} ref={ref} aria-label="小节导航">
      <div className={s.railHeading}>
        <div>
          <strong>小节导航</strong>
          <span>{project.sections.length} 小节</span>
        </div>
        {showCompactToggle ? (
          <Button tone="subtle" pressed={compact} onClick={onToggleCompact} icon={ListChecks}>
            {compact ? "标准" : "紧凑"}
          </Button>
        ) : null}
      </div>
      {project.sections.map((section) => {
        const pendingCount = section.images.filter((image) => image.status === "pending").length;
        return (
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
            {showReviewCounts ? <span className={s.small}>待审核 {pendingCount}</span> : null}
          </Link>
        );
      })}
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
  section,
}: {
  collapsed: boolean;
  images: DemoImage[];
  index: number;
  onToggleCollapsed: () => void;
  section: DemoSection;
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
      </div>
      <ImageGrid images={visibleImages} />
    </section>
  );
}

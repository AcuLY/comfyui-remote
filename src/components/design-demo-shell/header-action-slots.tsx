"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Edit3, FolderPlus, Play, Plus, Rows3 } from "lucide-react";

import type { DemoData, DemoProject, DemoSection } from "@/app/design-demos/data";
import { demoHref, rawSectionId } from "@/app/design-demos/routing";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import type { HeaderActionSlot } from "./header-surface";

type ProjectListFilter = "all" | "unfinished";
type ProjectListViewMode = "card" | "compact";
type ProjectSectionViewMode = "standard" | "compact";
type ProjectView = "sections" | "results";

const PROJECT_LIST_CREATE_FOLDER_EVENT = "design-demo:projects:create-folder";
const PROJECT_LIST_CREATE_PROJECT_EVENT = "design-demo:projects:create-project";
const PROJECT_LIST_VIEW_MODE_EVENT = "design-demo:projects:view-mode";
const PROJECT_LIST_VIEW_MODE_STORAGE_KEY = "design-demo:projects:view-mode";
const PROJECT_SECTION_VIEW_MODE_EVENT = "design-demo:projects:section-view-mode";
const PROJECT_SECTION_VIEW_MODE_STORAGE_KEY = "design-demo:projects:section-view-mode";
const projectBatchSizeItems = [1, 2, 4, 8, 16].map((value) => ({ value, label: value }));
const sectionBatchSizeItems = projectBatchSizeItems;
const projectListFilterItems: Array<{ value: ProjectListFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unfinished", label: "未完成" },
];
const projectListViewModeItems: Array<{ value: ProjectListViewMode; label: string }> = [
  { value: "card", label: "卡片" },
  { value: "compact", label: "缩略" },
];
const projectSectionViewModeItems: Array<{ value: ProjectSectionViewMode; label: string }> = [
  { value: "standard", label: "标准" },
  { value: "compact", label: "紧凑" },
];
const projectViewItems: Array<{ value: ProjectView; label: string }> = [
  { value: "sections", label: "小节" },
  { value: "results", label: "结果" },
];

function useProjectId() {
  const pathname = usePathname();
  return pathname?.match(/\/projects\/([^/?#]+)/)?.[1] ?? "";
}

function useSectionContext(data: DemoData) {
  const pathname = usePathname();
  const match = pathname?.match(/\/projects\/([^/?#]+)\/sections\/([^/?#]+)/);
  const projectId = match?.[1] ? decodeURIComponent(match[1]) : "";
  const sectionId = match?.[2] ? decodeURIComponent(match[2]) : "";
  const project = data.projects.find((item) => item.id === projectId) ?? data.projects[0];
  const sectionIndex = project?.sections.findIndex((item) => rawSectionId(item) === sectionId || item.id === sectionId) ?? -1;
  const section = sectionIndex >= 0 ? project?.sections[sectionIndex] : project?.sections[0];
  const resolvedIndex = sectionIndex >= 0 ? sectionIndex : 0;

  return {
    nextSection: project?.sections[resolvedIndex + 1] ?? null,
    prevSection: project?.sections[resolvedIndex - 1] ?? null,
    project,
    section,
  };
}

function sectionHref(project: DemoProject | undefined, section: DemoSection | null) {
  if (!project || !section) return "";
  return `/projects/${project.id}/sections/${rawSectionId(section)}`;
}

function ProjectListFilterControl() {
  const [value, setValue] = useState<ProjectListFilter>("all");

  return (
    <SegmentedControl
      ariaLabel="项目筛选"
      compact
      dense
      fitItems
      items={projectListFilterItems}
      onChange={setValue}
      value={value}
    />
  );
}

function isProjectListViewMode(value: unknown): value is ProjectListViewMode {
  return value === "card" || value === "compact";
}

function readProjectListViewMode(): ProjectListViewMode {
  if (typeof window === "undefined") return "card";
  const stored = window.localStorage.getItem(PROJECT_LIST_VIEW_MODE_STORAGE_KEY);
  return isProjectListViewMode(stored) ? stored : "card";
}

function ProjectListViewModeControl() {
  const [value, setValue] = useState<ProjectListViewMode>(readProjectListViewMode);

  function handleChange(nextValue: ProjectListViewMode) {
    setValue(nextValue);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_LIST_VIEW_MODE_STORAGE_KEY, nextValue);
    window.dispatchEvent(new CustomEvent(PROJECT_LIST_VIEW_MODE_EVENT, { detail: { mode: nextValue } }));
  }

  return (
    <SegmentedControl
      ariaLabel="项目列表显示模式"
      compact
      dense
      fitItems
      items={projectListViewModeItems}
      onChange={handleChange}
      value={value}
    />
  );
}

function isProjectSectionViewMode(value: unknown): value is ProjectSectionViewMode {
  return value === "standard" || value === "compact";
}

function readProjectSectionViewMode(): ProjectSectionViewMode {
  if (typeof window === "undefined") return "standard";
  const stored = window.localStorage.getItem(PROJECT_SECTION_VIEW_MODE_STORAGE_KEY);
  return isProjectSectionViewMode(stored) ? stored : "standard";
}

function ProjectSectionViewModeControl() {
  const [value, setValue] = useState<ProjectSectionViewMode>(readProjectSectionViewMode);

  function handleChange(nextValue: ProjectSectionViewMode) {
    setValue(nextValue);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECT_SECTION_VIEW_MODE_STORAGE_KEY, nextValue);
    window.dispatchEvent(
      new CustomEvent(PROJECT_SECTION_VIEW_MODE_EVENT, {
        detail: { compact: nextValue === "compact", mode: nextValue },
      }),
    );
  }

  return (
    <SegmentedControl
      ariaLabel="小节显示模式"
      compact
      dense
      fitItems
      items={projectSectionViewModeItems}
      onChange={handleChange}
      value={value}
    />
  );
}

function dispatchProjectListAction(eventName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(eventName));
}

function ProjectListCreateFolderAction() {
  return (
    <Button icon={FolderPlus} onClick={() => dispatchProjectListAction(PROJECT_LIST_CREATE_FOLDER_EVENT)}>
      新建文件夹
    </Button>
  );
}

function ProjectListCreateProjectAction() {
  return (
    <Button icon={Plus} tone="primary" onClick={() => dispatchProjectListAction(PROJECT_LIST_CREATE_PROJECT_EVENT)}>
      创建项目
    </Button>
  );
}

function ProjectViewControl() {
  const pathname = usePathname();
  const router = useRouter();
  const projectId = useProjectId();
  const view: ProjectView = pathname?.endsWith("/results") ? "results" : "sections";

  function handleViewChange(nextView: ProjectView) {
    if (!projectId) return;
    router.push(demoHref(nextView === "sections" ? `/projects/${projectId}` : `/projects/${projectId}/results`));
  }

  return (
    <div data-project-view-control="true">
      <SegmentedControl
        ariaLabel="项目视图"
        compact
        items={projectViewItems}
        onChange={handleViewChange}
        role="tablist"
        value={view}
      />
    </div>
  );
}

function ProjectEditAction() {
  const projectId = useProjectId();
  if (!projectId) return null;
  return (
    <ButtonLink href={`/projects/${projectId}/edit`} icon={Edit3}>
      编辑项目
    </ButtonLink>
  );
}

function ProjectNewSectionAction() {
  const projectId = useProjectId();
  if (!projectId) return null;
  return (
    <ButtonLink href={`/projects/${projectId}/batch-create?mode=single`} icon={Plus} tone="primary">
      新建小节
    </ButtonLink>
  );
}

function ProjectBatchCreateAction() {
  const projectId = useProjectId();
  if (!projectId) return null;
  return (
    <ButtonLink href={`/projects/${projectId}/batch-create?mode=batch`} icon={Rows3}>
      批量创建
    </ButtonLink>
  );
}

function ProjectRunControl() {
  const [batchSize, setBatchSize] = useState(2);

  return (
    <div data-project-run-control="true" role="group" aria-label="整组运行">
      <SegmentedControl
        ariaLabel="批量张数"
        compact
        dense
        fitItems
        fitItemWidth={32}
        items={projectBatchSizeItems}
        onChange={setBatchSize}
        value={batchSize}
      />
      <Button
        ariaLabel="整组运行"
        feedback={{ title: "整组运行已加入任务", detail: `batch ${batchSize}` }}
        icon={Play}
        iconOnly
        tone="primary"
      />
    </div>
  );
}

function SectionNavControl({ data }: { data: DemoData }) {
  const { nextSection, prevSection, project } = useSectionContext(data);
  const prevHref = sectionHref(project, prevSection);
  const nextHref = sectionHref(project, nextSection);

  return (
    <div data-section-nav-control="true" role="group" aria-label="切换小节">
      {prevHref ? (
        <ButtonLink href={prevHref} icon={ChevronLeft} iconOnly tone="subtle" ariaLabel={`上一节：${prevSection?.name}`} />
      ) : (
        <Button icon={ChevronLeft} iconOnly tone="subtle" ariaLabel="上一节" disabled />
      )}
      {nextHref ? (
        <ButtonLink href={nextHref} icon={ChevronRight} iconOnly tone="subtle" ariaLabel={`下一节：${nextSection?.name}`} />
      ) : (
        <Button icon={ChevronRight} iconOnly tone="subtle" ariaLabel="下一节" disabled />
      )}
    </div>
  );
}

function SectionWorkflowDownloadAction({ data }: { data: DemoData }) {
  const { project, section } = useSectionContext(data);
  const href = project && section ? `/api/projects/${project.id}/section-workflow/${rawSectionId(section)}` : "";

  return (
    <Button
      ariaLabel="下载工作流"
      disabled={!href}
      icon={Download}
      onClick={() => {
        if (href) window.location.assign(href);
      }}
    >
      下载工作流
    </Button>
  );
}

function SectionRunControl({ data }: { data: DemoData }) {
  const { section } = useSectionContext(data);
  const defaultBatchSize = section?.batchSize && sectionBatchSizeItems.some((item) => item.value === section.batchSize)
    ? section.batchSize
    : 2;
  const [batchSize, setBatchSize] = useState(defaultBatchSize);

  useEffect(() => {
    setBatchSize(defaultBatchSize);
  }, [defaultBatchSize]);

  return (
    <div data-project-run-control="true" data-section-run-control="true" role="group" aria-label="运行小节">
      <SegmentedControl
        ariaLabel="批量张数"
        compact
        dense
        fitItems
        fitItemWidth={32}
        items={sectionBatchSizeItems}
        onChange={setBatchSize}
        value={batchSize}
      />
      <Button
        ariaLabel="运行小节"
        feedback={{ title: "小节运行已加入任务", detail: `${section?.name ?? "当前小节"} · batch ${batchSize}` }}
        icon={Play}
        iconOnly
        tone="primary"
      />
    </div>
  );
}

export function getHeaderActionSlots(specKey: string, data: DemoData): HeaderActionSlot[] | undefined {
  if (specKey === "section-editor") {
    return [
      {
        key: "section-nav",
        label: "切换小节",
        node: <SectionNavControl data={data} />,
        overflowNode: <SectionNavControl data={data} />,
      },
      {
        key: "section-workflow",
        label: "下载工作流",
        node: <SectionWorkflowDownloadAction data={data} />,
        overflowNode: <SectionWorkflowDownloadAction data={data} />,
      },
      {
        key: "section-run",
        label: "运行小节",
        node: <SectionRunControl data={data} />,
        overflowNode: <SectionRunControl data={data} />,
        placement: "trailing",
      },
    ];
  }

  if (specKey === "project-detail" || specKey === "project-results") {
    const slots: HeaderActionSlot[] = [
      {
        key: "project-view",
        label: "项目视图",
        node: <ProjectViewControl />,
        overflowNode: <ProjectViewControl />,
        placement: "leading",
      },
    ];
    if (specKey === "project-detail") {
      slots.push(
        {
          key: "project-edit",
          label: "编辑项目",
          node: <ProjectEditAction />,
          overflowNode: <ProjectEditAction />,
        },
        {
          key: "project-section-view-mode",
          label: "小节显示模式",
          node: <ProjectSectionViewModeControl />,
          overflowNode: <ProjectSectionViewModeControl />,
        },
        {
          key: "project-new-section",
          label: "新建小节",
          node: <ProjectNewSectionAction />,
          overflowNode: <ProjectNewSectionAction />,
        },
        {
          key: "project-batch-create",
          label: "批量创建",
          node: <ProjectBatchCreateAction />,
          overflowNode: <ProjectBatchCreateAction />,
        },
      );
      slots.push({
        key: "project-run",
        label: "整组运行",
        node: <ProjectRunControl />,
        overflowNode: <ProjectRunControl />,
        placement: "trailing",
      });
    }
    return slots;
  }

  if (specKey !== "projects") return undefined;

  return [
    {
      key: "project-list-view-mode",
      label: "显示模式",
      node: <ProjectListViewModeControl />,
      overflowNode: <ProjectListViewModeControl />,
    },
    {
      key: "project-list-create-folder",
      label: "新建文件夹",
      node: <ProjectListCreateFolderAction />,
      overflowNode: <ProjectListCreateFolderAction />,
    },
    {
      key: "project-list-create-project",
      label: "创建项目",
      node: <ProjectListCreateProjectAction />,
      overflowNode: <ProjectListCreateProjectAction />,
    },
    {
      key: "project-list-filter",
      label: "项目筛选",
      node: <ProjectListFilterControl />,
      overflowNode: <ProjectListFilterControl />,
      placement: "trailing",
    },
  ];
}

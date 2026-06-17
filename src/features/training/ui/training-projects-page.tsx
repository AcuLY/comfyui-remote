"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Archive, CheckSquare, Grid2X2, List, Plus, X } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { SelectionBatchBar } from "@/components/design-demo-ui/patterns";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { SegmentedControl } from "@/components/design-demo-ui/primitives/segmented-control";
import { SortableList } from "@/components/design-demo-ui/primitives/sortable";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingProject } from "@/features/training/types";
import { TrainingProjectListItem } from "./training-project-list-item";
import s from "./training-projects-page.module.css";

type ProjectScope = "current" | "archived";
type ProjectViewMode = "card" | "compact";

function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

function scopeForProject(project: LoraTrainingProject): ProjectScope {
  return project.status === "archived" ? "archived" : "current";
}

function orderTrainingProjectsByIds(projects: LoraTrainingProject[], orderedIds: string[]) {
  const projectMap = Object.fromEntries(projects.map((project) => [project.id, project]));
  const orderedProjects = orderedIds.map((id) => projectMap[id]).filter((project): project is LoraTrainingProject => Boolean(project));
  const missingProjects = projects.filter((project) => !orderedIds.includes(project.id));
  return [...orderedProjects, ...missingProjects];
}

export function LoraTrainingProjectsPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const [scope, setScope] = useState<ProjectScope>("current");
  const [viewMode, setViewMode] = useState<ProjectViewMode>("card");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localProjects, setLocalProjects] = useState(training.projects);
  const [orderedProjectIds, setOrderedProjectIds] = useState(() => training.projects.map((project) => project.id));
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
  const [isDeletingProjects, setIsDeletingProjects] = useState(false);
  const [isPersistingProjectArchive, setIsPersistingProjectArchive] = useState(false);
  const orderedProjects = orderTrainingProjectsByIds(localProjects, orderedProjectIds);
  const visibleProjects = orderedProjects.filter((project) => scopeForProject(project) === scope && !hiddenProjectIds.has(project.id));
  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const currentCount = localProjects.filter((project) => scopeForProject(project) === "current" && !hiddenProjectIds.has(project.id)).length;
  const archivedCount = localProjects.filter((project) => scopeForProject(project) === "archived" && !hiddenProjectIds.has(project.id)).length;
  const selectedVisibleCount = visibleProjects.filter((project) => selectedIds.has(project.id)).length;
  const allVisibleSelected = visibleProjects.length > 0 && selectedVisibleCount === visibleProjects.length;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function toggleProjectSelection(projectId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleVisibleProjects() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleProjects.forEach((project) => next.delete(project.id));
        return next;
      }
      return new Set([...current, ...visibleProjects.map((project) => project.id)]);
    });
  }

  function handleReorderProjects(nextVisibleIds: string[]) {
    const visibleProjectIdSet = new Set(visibleProjectIds);
    const previousIds = orderedProjectIds;
    const reorderedVisibleIds = [...nextVisibleIds];
    const nextOrderedIds = orderedProjectIds.map((projectId) => (
      visibleProjectIdSet.has(projectId) ? reorderedVisibleIds.shift() ?? projectId : projectId
    ));
    setOrderedProjectIds(nextOrderedIds);

    if (!isProductionTrainingRoute) return;

    void (async () => {
      try {
        const response = await fetch("/api/training/projects/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderedProjectIds: nextOrderedIds,
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          setOrderedProjectIds(previousIds);
          pushToast({
            tone: "error",
            title: "项目排序保存失败",
            detail: payload?.error?.message ?? "训练项目排序保存请求失败",
          });
        }
      } catch (error) {
        setOrderedProjectIds(previousIds);
        pushToast({
          tone: "error",
          title: "项目排序保存失败",
          detail: error instanceof Error ? error.message : "训练项目排序保存请求失败",
        });
      }
    })();
  }

  function applyLocalDelete(projectIds: Iterable<string>) {
    const ids = new Set(projectIds);
    setHiddenProjectIds((current) => new Set([...current, ...ids]));
    setSelectedIds((current) => new Set([...current].filter((id) => !ids.has(id))));
  }

  async function handleToggleSelectedProjectArchive() {
    const selectedVisibleIds = new Set(visibleProjects.filter((project) => selectedIds.has(project.id)).map((project) => project.id));
    const applyLocalArchiveState = (projectIds: Set<string>) => {
      setLocalProjects((current) => current.map((project) =>
        projectIds.has(project.id)
          ? { ...project, status: scope === "current" ? "archived" : "ready" }
          : project,
      ));
      setSelectedIds((current) => new Set([...current].filter((id) => !projectIds.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalArchiveState(selectedVisibleIds);
      pushToast({
        tone: scope === "current" ? "warning" : "success",
        title: scope === "current" ? "训练项目已归档" : "训练项目已恢复",
        detail: `${selectedVisibleIds.size} 个训练项目`,
      });
      return;
    }

    if (isPersistingProjectArchive || selectedVisibleIds.size === 0) return;

    setIsPersistingProjectArchive(true);
    try {
      const responses = await Promise.all(
        [...selectedVisibleIds].map(async (projectId) => {
          const response = await fetch(`/api/training/projects/${projectId}/${scope === "current" ? "archive" : "restore"}`, {
            method: "POST",
          });
          const payload = await response.json().catch(() => null);
          return { payload, projectId, response };
        }),
      );

      const completedIds = new Set(
        responses
          .filter(({ payload, response }) => response.ok && payload?.ok)
          .map(({ projectId }) => projectId),
      );
      if (completedIds.size > 0) {
        applyLocalArchiveState(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: scope === "current" ? "归档失败" : "恢复失败",
          detail: failedResponse.payload?.error?.message ?? "训练项目状态更新请求失败",
        });
        return;
      }

      pushToast({
        tone: scope === "current" ? "warning" : "success",
        title: scope === "current" ? "训练项目已归档" : "训练项目已恢复",
        detail: `${completedIds.size} 个训练项目`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: scope === "current" ? "归档失败" : "恢复失败",
        detail: error instanceof Error ? error.message : "训练项目状态更新请求失败",
      });
    } finally {
      setIsPersistingProjectArchive(false);
    }
  }

  async function handleDeleteProjects(projectIds: Iterable<string>) {
    const ids = new Set(projectIds);
    const projects = visibleProjects.filter((project) => ids.has(project.id));

    if (!isProductionTrainingRoute) {
      applyLocalDelete(ids);
      pushToast({
        tone: "warning",
        title: "训练项目已从列表移除",
        detail: projects.length === 1 ? (projects[0]?.title ?? "训练项目") : `${projects.length} 个训练项目`,
      });
      return;
    }

    if (isDeletingProjects || projects.length === 0) return;

    setIsDeletingProjects(true);
    try {
      const responses = await Promise.all(
        projects.map(async (project) => {
          const response = await fetch(`/api/training/projects/${project.id}`, {
            method: "DELETE",
          });
          const payload = await response.json().catch(() => null);
          return { payload, project, response };
        }),
      );

      const completedIds = new Set(
        responses
          .filter(({ payload, response }) => response.ok && payload?.ok)
          .map(({ project }) => project.id),
      );
      if (completedIds.size > 0) {
        applyLocalDelete(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "删除失败",
          detail: failedResponse.payload?.error?.message ?? "训练项目删除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "训练项目已从列表移除",
        detail: completedIds.size === 1 ? (projects[0]?.title ?? "训练项目") : `${completedIds.size} 个训练项目`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "删除失败",
        detail: error instanceof Error ? error.message : "训练项目删除请求失败",
      });
    } finally {
      setIsDeletingProjects(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        title="项目"
        actions={<ButtonLink href="/training/projects/new" icon={Plus} tone="primary">新建</ButtonLink>}
      />

      <SegmentedControl
        ariaLabel="切换训练项目范围"
        panel
        role="tablist"
        items={[
          { value: "current", label: "当前", count: currentCount },
          { value: "archived", label: "已归档", count: archivedCount },
        ]}
        value={scope}
        onChange={(nextScope) => {
          setScope(nextScope);
          setSelectedIds(new Set());
        }}
      />

      <section className={s.projectWorkspace} aria-label="训练项目列表">
        <div className={s.projectToolbar}>
          <div className={s.projectToolbarMeta}>
            <strong>{scope === "current" ? "当前训练项目" : "已归档训练项目"}</strong>
            <span>{visibleProjects.length} 个项目{selectedVisibleCount ? ` · 已选 ${selectedVisibleCount}` : ""}</span>
          </div>
          <div className={s.projectToolbarControls}>
            <SegmentedControl
              ariaLabel="切换项目列表密度"
              compact
              dense
              fitItems
              items={[
                { value: "card", label: "卡片" },
                { value: "compact", label: "紧凑" },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
            <Button icon={CheckSquare} onClick={toggleVisibleProjects} disabled={visibleProjects.length === 0}>
              {allVisibleSelected ? "取消全选" : "全选"}
            </Button>
          </div>
        </div>

        {selectedVisibleCount > 0 ? (
          <SelectionBatchBar
            selectedCount={selectedVisibleCount}
            subject="个训练项目"
            onClear={() => setSelectedIds(new Set())}
            actions={(
              <>
                <Button icon={Archive} pending={isPersistingProjectArchive} onClick={handleToggleSelectedProjectArchive}>
                  {scope === "current" ? "归档" : "恢复"}
                </Button>
                <Button
                  tone="danger"
                  icon={X}
                  pending={isDeletingProjects}
                  feedback={{ tone: "warning", title: "训练项目已从列表移除", detail: `${selectedVisibleCount} 个训练项目` }}
                  onClick={() => handleDeleteProjects(selectedIds)}
                >
                  删除
                </Button>
              </>
            )}
          />
        ) : null}

        <div className={cx(s.projectSurface, viewMode === "compact" && s.projectSurfaceCompact)}>
          {visibleProjects.length ? (
            <div className={s.projectGrid}>
              <SortableList items={visibleProjectIds} onReorder={handleReorderProjects}>
                {visibleProjects.map((project) => (
                  <div data-training-project-id={project.id} key={project.id}>
                    <TrainingProjectListItem
                      compact={viewMode === "compact"}
                      onDelete={() => handleDeleteProjects([project.id])}
                      onToggleSelected={() => toggleProjectSelection(project.id)}
                      project={project}
                      selected={selectedIds.has(project.id)}
                    />
                  </div>
                ))}
              </SortableList>
            </div>
          ) : (
            <div className={s.emptyState}>
              {scope === "current" ? <Grid2X2 aria-hidden="true" /> : <List aria-hidden="true" />}
              <strong>{scope === "current" ? "暂无当前训练项目" : "暂无归档训练项目"}</strong>
              <span>{scope === "current" ? "新建训练项目后，会在这里管理角色资料、训练集和训练运行。" : "归档后的训练项目会显示在这里。"}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

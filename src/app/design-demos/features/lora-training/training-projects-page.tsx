"use client";

import { useState } from "react";
import { Archive, CheckSquare, Grid2X2, List, Plus, X } from "lucide-react";

import type { DemoData } from "../../data";
import { cx } from "../../routing";
import { PageHeader } from "../../shared/primitives/page-header";
import { Button, ButtonLink } from "../../shared/primitives/button";
import { SegmentedControl } from "../../shared/primitives/segmented-control";
import { SelectionBatchBar } from "../../shared/patterns";
import { buildLoraTrainingDemoData } from "./fixtures";
import { TrainingProjectListItem } from "./training-project-list-item";
import type { LoraTrainingProject } from "./types";
import s from "./training-projects-page.module.css";

type ProjectScope = "current" | "archived";
type ProjectViewMode = "card" | "compact";

function scopeForProject(project: LoraTrainingProject): ProjectScope {
  return project.status === "archived" ? "archived" : "current";
}

export function LoraTrainingProjectsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const [scope, setScope] = useState<ProjectScope>("current");
  const [viewMode, setViewMode] = useState<ProjectViewMode>("card");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localProjects, setLocalProjects] = useState(training.projects);
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());
  const visibleProjects = localProjects.filter((project) => scopeForProject(project) === scope && !hiddenProjectIds.has(project.id));
  const currentCount = localProjects.filter((project) => scopeForProject(project) === "current" && !hiddenProjectIds.has(project.id)).length;
  const archivedCount = localProjects.filter((project) => scopeForProject(project) === "archived" && !hiddenProjectIds.has(project.id)).length;
  const selectedVisibleCount = visibleProjects.filter((project) => selectedIds.has(project.id)).length;
  const allVisibleSelected = visibleProjects.length > 0 && selectedVisibleCount === visibleProjects.length;

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

  function removeProject(projectId: string) {
    setHiddenProjectIds((current) => new Set([...current, projectId]));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
  }

  function handleToggleSelectedProjectArchive() {
    const selectedVisibleIds = new Set(visibleProjects.filter((project) => selectedIds.has(project.id)).map((project) => project.id));
    setLocalProjects((current) => current.map((project) =>
      selectedVisibleIds.has(project.id)
        ? { ...project, status: scope === "current" ? "archived" : "ready" }
        : project,
    ));
    setSelectedIds(new Set());
  }

  function handleRemoveSelectedProjects() {
    const selectedVisibleIds = new Set(visibleProjects.filter((project) => selectedIds.has(project.id)).map((project) => project.id));
    setHiddenProjectIds((current) => new Set([...current, ...selectedVisibleIds]));
    setSelectedIds((current) => new Set([...current].filter((id) => !selectedVisibleIds.has(id))));
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练项目"
        subtitle={`${currentCount} 个当前项目 · ${archivedCount} 个已归档 · 最近结果按项目快速浏览`}
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
            <ButtonLink href="/training/projects/new" icon={Plus} tone="primary">
              新建
            </ButtonLink>
          </div>
        </div>

        {selectedVisibleCount > 0 ? (
          <SelectionBatchBar
            selectedCount={selectedVisibleCount}
            subject="个训练项目"
            onClear={() => setSelectedIds(new Set())}
            actions={(
              <>
                <Button icon={Archive} onClick={handleToggleSelectedProjectArchive} feedback={{ title: scope === "current" ? "训练项目已归档" : "训练项目已恢复", detail: `${selectedVisibleCount} 个训练项目` }}>
                  {scope === "current" ? "归档" : "恢复"}
                </Button>
                <Button
                  tone="danger"
                  icon={X}
                  feedback={{ tone: "warning", title: "训练项目已从列表移除", detail: `${selectedVisibleCount} 个训练项目` }}
                  onClick={handleRemoveSelectedProjects}
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
              {visibleProjects.map((project) => (
                <div data-training-project-id={project.id} key={project.id}>
                  <TrainingProjectListItem
                    compact={viewMode === "compact"}
                    onDelete={() => removeProject(project.id)}
                    onToggleSelected={() => toggleProjectSelection(project.id)}
                    project={project}
                    selected={selectedIds.has(project.id)}
                  />
                </div>
              ))}
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

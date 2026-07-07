"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Copy, GripVertical, ImagePlus, Trash2 } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { ImageListSmall } from "@/components/design-demo-ui/media/image-list-small";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { SortableList, useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import type { TrainingAppData } from "@/features/training/data";
import { TRAINING_PROJECT_SECTION_ADD_EVENT } from "@/features/training/header-action-slots";
import type { LoraTrainingProject, LoraTrainingSection } from "@/features/training/types";

import { findProject, isProductionTrainingPath, nextProjectSectionCopyNumber, nextProjectSectionDraftNumber } from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { TrainingSectionWorkspace } from "./training-section-workspace";
import s from "./training-project-pages.module.css";

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
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const [localSectionState, setLocalSections] = useState(() => ({
    projectId: project?.id ?? null,
    sections: project?.sections ?? [],
  }));
  const [orderedSectionState, setOrderedSectionIds] = useState(() => ({
    ids: project?.sections.map((section) => section.id) ?? [],
    projectId: project?.id ?? null,
  }));
  const [isMutatingSections, setIsMutatingSections] = useState(false);

  const handleAddSection = useCallback(async () => {
    if (!project) return;
    if (isProductionTrainingRoute && isMutatingSections) return;

    const activeProject = project;
    const localSections = localSectionState.projectId === activeProject.id ? localSectionState.sections : activeProject.sections;
    const orderedSectionIds = orderedSectionState.projectId === activeProject.id ? orderedSectionState.ids : activeProject.sections.map((section) => section.id);
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
  }, [isMutatingSections, isProductionTrainingRoute, localSectionState, orderedSectionState, project, pushToast]);

  useEffect(() => {
    function handleHeaderAddSection() {
      void handleAddSection();
    }

    window.addEventListener(TRAINING_PROJECT_SECTION_ADD_EVENT, handleHeaderAddSection);
    return () => window.removeEventListener(TRAINING_PROJECT_SECTION_ADD_EVENT, handleHeaderAddSection);
  }, [handleAddSection]);

  if (!project) return <EmptyPage title="没有训练小节数据" />;
  const localSections = localSectionState.projectId === project.id ? localSectionState.sections : project.sections;
  const orderedSectionIds = orderedSectionState.projectId === project.id ? orderedSectionState.ids : project.sections.map((section) => section.id);
  const activeProject = project;
  const sectionMap = new Map(localSections.map((section) => [section.id, section]));
  const sections = orderedSectionIds
    .map((sectionId) => sectionMap.get(sectionId))
    .filter((section): section is LoraTrainingSection => Boolean(section));

  async function handleCopySection(section: LoraTrainingSection) {
    if (isProductionTrainingRoute && isMutatingSections) return;

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
    if (isProductionTrainingRoute && isMutatingSections) return;

    const nextSections = localSections.filter((section) => section.id !== sectionId);
    const nextIds = orderedSectionIds.filter((id) => id !== sectionId);
    setLocalSections({ projectId: activeProject.id, sections: nextSections });
    setOrderedSectionIds({ ids: nextIds, projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;

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
    if (isProductionTrainingRoute && isMutatingSections) return;

    setOrderedSectionIds({ ids: nextSectionIds, projectId: activeProject.id });

    if (!isProductionTrainingRoute) return;

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

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
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

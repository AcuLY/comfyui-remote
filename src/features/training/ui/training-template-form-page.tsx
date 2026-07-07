"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { OperationStateStrip } from "@/components/design-demo-ui/feedback/operation-state-strip";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { SortableList } from "@/components/design-demo-ui/primitives/sortable";
import { EditorBlock, WorkbenchSurface } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingTemplate } from "@/features/training/types";
import { findTemplate, isProductionTrainingPath, readNewTemplateHints } from "./training-resource-page-utils";
import {
  buildTemplateSectionsFromProject,
  nextTemplateSectionCopyNumber,
  nextTemplateSectionDraftNumber,
  orderTemplateSectionsByIds,
} from "./training-template-page-utils";
import { TemplateEditorSectionRow, type LoraTrainingTemplateSection } from "./training-template-section-row";
import { useResourceUrlSearch } from "./use-resource-url-search";
import s from "./training-resource-pages.module.css";

export function LoraTrainingTemplateFormPage({ data, mode, templateId }: { data: TrainingAppData; mode: "new" | "edit"; templateId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const urlSearch = useResourceUrlSearch();
  const newTemplateHints = mode === "new" ? readNewTemplateHints(urlSearch) : { projectId: "", sections: "", sourceProject: "" };
  const template = mode === "edit" ? findTemplate(data, templateId) : undefined;
  const sourceProject = mode === "new"
    ? training.projects.find((project) => project.id === newTemplateHints.projectId)
      ?? training.projects.find((project) => project.title === newTemplateHints.sourceProject)
    : undefined;
  const seedTemplate = template;
  const title = mode === "new" ? "新建训练模板" : template?.title ?? "训练模板";
  const templateEditorId = seedTemplate?.id ?? "new-template";
  const templateSeedSections = sourceProject ? buildTemplateSectionsFromProject(sourceProject) : seedTemplate?.sections ?? [];
  const templateSeedSectionIds = templateSeedSections.map((section) => section.id);
  const templateFormContextId = [
    mode,
    template?.id ?? templateId ?? "new",
    seedTemplate?.id ?? "no-template",
    newTemplateHints.projectId,
    newTemplateHints.sourceProject,
    newTemplateHints.sections,
  ].join(":");
  const initialTemplateForm = {
    captionGuidance: seedTemplate?.captionGuidance ?? "先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。",
    description: seedTemplate?.description ?? "用于新角色 LoRA 训练项目的起始模板。",
    imageGuidance: seedTemplate?.imageGuidance ?? "每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。",
    title: newTemplateHints.sourceProject ? `${newTemplateHints.sourceProject} 训练模板` : seedTemplate?.title ?? "新角色 LoRA 模板",
  };
  const [templateSectionState, setTemplateSectionState] = useState(() => ({
    contextId: templateFormContextId,
    orderedIds: templateSeedSectionIds,
    sections: templateSeedSections,
  }));
  const [templateFormState, setTemplateFormState] = useState(() => ({
    contextId: templateFormContextId,
    form: initialTemplateForm,
  }));
  const [templateDraftState, setTemplateDraftState] = useState<{
    contextId: string;
    draft: typeof initialTemplateForm & { mode: "new" | "edit"; sectionCount: number; sourceProject: string } | null;
  }>(() => ({
    contextId: templateFormContextId,
    draft: null,
  }));
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [isMutatingTemplateSections, setIsMutatingTemplateSections] = useState(false);
  const templateSections = templateSectionState.contextId === templateFormContextId ? templateSectionState.sections : templateSeedSections;
  const orderedTemplateSectionIds = templateSectionState.contextId === templateFormContextId ? templateSectionState.orderedIds : templateSeedSectionIds;
  const templateForm = templateFormState.contextId === templateFormContextId ? templateFormState.form : initialTemplateForm;
  const templateDraft = templateDraftState.contextId === templateFormContextId ? templateDraftState.draft : null;
  const templateSectionMap = Object.fromEntries(templateSections.map((section) => [section.id, section]));
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function activeTemplateSectionState(current: typeof templateSectionState) {
    return current.contextId === templateFormContextId ? current : {
      contextId: templateFormContextId,
      orderedIds: templateSeedSectionIds,
      sections: templateSeedSections,
    };
  }

  function setLocalTemplateSections(updater: (current: LoraTrainingTemplateSection[]) => LoraTrainingTemplateSection[]) {
    setTemplateSectionState((current) => {
      const active = activeTemplateSectionState(current);
      const sections = updater(active.sections);
      const sectionIds = new Set(sections.map((section) => section.id));
      return {
        contextId: templateFormContextId,
        orderedIds: active.orderedIds.filter((id) => sectionIds.has(id)),
        sections,
      };
    });
  }

  function replaceTemplateSections(nextSections: LoraTrainingTemplateSection[]) {
    setTemplateSectionState({
      contextId: templateFormContextId,
      orderedIds: nextSections.map((section) => section.id),
      sections: nextSections,
    });
  }

  function setOrderedTemplateSectionIds(updater: string[] | ((current: string[]) => string[])) {
    setTemplateSectionState((current) => {
      const active = activeTemplateSectionState(current);
      const orderedIds = typeof updater === "function" ? updater(active.orderedIds) : updater;
      return {
        ...active,
        contextId: templateFormContextId,
        orderedIds,
      };
    });
  }

  function setTemplateForm(updater: (current: typeof initialTemplateForm) => typeof initialTemplateForm) {
    setTemplateFormState((current) => ({
      contextId: templateFormContextId,
      form: updater(current.contextId === templateFormContextId ? current.form : initialTemplateForm),
    }));
  }

  function setTemplateDraft(draft: typeof initialTemplateForm & { mode: "new" | "edit"; sectionCount: number; sourceProject: string }) {
    setTemplateDraftState({
      contextId: templateFormContextId,
      draft,
    });
  }

  function handleUpdateTemplateForm(field: keyof typeof templateForm, value: string) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveTemplate() {
    const nextDraft = {
      ...templateForm,
      mode,
      sectionCount: templateSections.length,
      sourceProject: newTemplateHints.sourceProject,
    };

    if (!isProductionTrainingRoute) {
      setTemplateDraft(nextDraft);
      pushToast({
        tone: "success",
        title: templateDraft ? "模板保存草稿已更新" : "模板保存草稿已记录",
        detail: templateForm.title,
      });
      return;
    }

    if (isSavingTemplate) return;

    setIsSavingTemplate(true);
    try {
      const saveTemplateSections = orderedTemplateSectionIds
        .map((sectionId) => templateSectionMap[sectionId])
        .filter((section): section is LoraTrainingTemplate["sections"][number] => Boolean(section));
      const saveTemplateEndpoint = sourceProject && mode === "new"
        ? `/api/training/projects/${sourceProject.id}/save-as-template`
        : mode === "new"
          ? "/api/training/templates"
          : `/api/training/templates/${template?.id}`;
      const saveTemplateMethod = sourceProject && mode === "new"
        ? "POST"
        : mode === "new"
          ? "POST"
          : "PATCH";
      const response = await fetch(saveTemplateEndpoint, {
        method: saveTemplateMethod,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: templateForm.title,
          description: templateForm.description,
          imageGuidance: templateForm.imageGuidance,
          captionGuidance: templateForm.captionGuidance,
          sections: saveTemplateSections,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: mode === "new" ? "训练模板创建失败" : "训练模板保存失败",
          detail: payload?.error?.message ?? "训练模板保存请求失败",
        });
        return;
      }

      setTemplateDraft(nextDraft);
      pushToast({
        tone: "success",
        title: mode === "new" ? "训练模板已创建" : "训练模板已保存",
        detail: templateForm.title,
      });
      router.push(`/training/templates/${payload.data.id}/edit`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: mode === "new" ? "训练模板创建失败" : "训练模板保存失败",
        detail: error instanceof Error ? error.message : "训练模板保存请求失败",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate() {
    if (mode !== "edit" || !template?.id) return;

    if (!isProductionTrainingRoute) {
      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: template.title,
      });
      router.push("/training/templates");
      return;
    }

    if (isDeletingTemplate) return;

    setIsDeletingTemplate(true);
    try {
      const response = await fetch(`/api/training/templates/${template.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "训练模板删除失败",
          detail: payload?.error?.message ?? "训练模板删除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: template.title,
      });
      router.push("/training/templates");
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练模板删除失败",
        detail: error instanceof Error ? error.message : "训练模板删除请求失败",
      });
    } finally {
      setIsDeletingTemplate(false);
    }
  }

  function createDraftTemplateSection(current: LoraTrainingTemplateSection[], titleSuffix: string): LoraTrainingTemplateSection {
    const source = current[0];
    const draftNumber = nextTemplateSectionDraftNumber(current);
    const draftId = `new-template-section-${draftNumber}`;
    const draftIndex = current.length + 1;
    return source ? {
      ...source,
      id: draftId,
      title: `新模板小节 ${draftIndex}${titleSuffix}`,
      enabled: true,
      scenePreview: "补充这个模板小节的训练场景摘要。",
    } : {
      id: draftId,
      title: `新模板小节 ${draftIndex}${titleSuffix}`,
      enabled: true,
      blockCount: 1,
      blocks: [
        { id: "draft-template-block", source: "本地", title: "本地场景描述", text: "补充这个模板小节的训练场景描述。" },
      ],
      resolvedScene: "补充这个模板小节的训练场景描述。",
      scenePreview: "补充这个模板小节的训练场景摘要。",
    };
  }

  function handleAddTemplateSection() {
    const activeTemplateId = isProductionTrainingRoute && mode === "edit" ? template?.id : null;
    if (activeTemplateId && isMutatingTemplateSections) return;

    const draft = createDraftTemplateSection(templateSections, "");
    setLocalTemplateSections((current) => [...current, draft]);
    setOrderedTemplateSectionIds((ids) => [...ids, draft.id]);

    if (!activeTemplateId) return;

    setIsMutatingTemplateSections(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplateId}/sections`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.sections)) {
          replaceTemplateSections(templateSections);
          setOrderedTemplateSectionIds(orderedTemplateSectionIds);
          pushToast({
            tone: "error",
            title: "模板小节创建失败",
            detail: payload?.error?.message ?? "模板小节创建请求失败",
          });
          return;
        }
        replaceTemplateSections(payload.data.sections as LoraTrainingTemplateSection[]);
      } catch (error) {
        replaceTemplateSections(templateSections);
        setOrderedTemplateSectionIds(orderedTemplateSectionIds);
        pushToast({
          tone: "error",
          title: "模板小节创建失败",
          detail: error instanceof Error ? error.message : "模板小节创建请求失败",
        });
      } finally {
        setIsMutatingTemplateSections(false);
      }
    })();
  }

  function handleCopyTemplateSection(section: LoraTrainingTemplateSection) {
    const activeTemplateId = isProductionTrainingRoute && mode === "edit" ? template?.id : null;
    if (activeTemplateId && isMutatingTemplateSections) return;

    const copyNumber = nextTemplateSectionCopyNumber(templateSections, section.id);
    const copy: LoraTrainingTemplateSection = {
      ...section,
      id: `${section.id}-copy-${copyNumber}`,
      title: `${section.title} (副本)`,
    };
    setLocalTemplateSections((current) => {
      const sourceIndex = current.findIndex((item) => item.id === section.id);
      if (sourceIndex === -1) return [...current, copy];
      return [
        ...current.slice(0, sourceIndex + 1),
        copy,
        ...current.slice(sourceIndex + 1),
      ];
    });
    setOrderedTemplateSectionIds((ids) => {
      const sourceIndex = ids.indexOf(section.id);
      if (sourceIndex === -1) return [...ids, copy.id];
      return [
        ...ids.slice(0, sourceIndex + 1),
        copy.id,
        ...ids.slice(sourceIndex + 1),
      ];
    });

    if (!activeTemplateId) return;

    const previousSections = templateSections;
    const previousIds = orderedTemplateSectionIds;
    setIsMutatingTemplateSections(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplateId}/sections`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceSectionId: section.id,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.sections)) {
          replaceTemplateSections(previousSections);
          setOrderedTemplateSectionIds(previousIds);
          pushToast({
            tone: "error",
            title: "模板小节复制失败",
            detail: payload?.error?.message ?? "模板小节复制请求失败",
          });
          return;
        }
        replaceTemplateSections(payload.data.sections as LoraTrainingTemplateSection[]);
      } catch (error) {
        replaceTemplateSections(previousSections);
        setOrderedTemplateSectionIds(previousIds);
        pushToast({
          tone: "error",
          title: "模板小节复制失败",
          detail: error instanceof Error ? error.message : "模板小节复制请求失败",
        });
      } finally {
        setIsMutatingTemplateSections(false);
      }
    })();
  }

  function handleDeleteTemplateSection(sectionId: string) {
    const activeTemplateId = isProductionTrainingRoute && mode === "edit" ? template?.id : null;
    if (activeTemplateId && isMutatingTemplateSections) return;

    setLocalTemplateSections((current) => current.filter((section) => section.id !== sectionId));
    setOrderedTemplateSectionIds((ids) => ids.filter((id) => id !== sectionId));

    if (!activeTemplateId) return;

    const previousSections = templateSections;
    const previousIds = orderedTemplateSectionIds;
    setIsMutatingTemplateSections(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplateId}/sections/${sectionId}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.sections)) {
          replaceTemplateSections(previousSections);
          setOrderedTemplateSectionIds(previousIds);
          pushToast({
            tone: "error",
            title: "模板小节删除失败",
            detail: payload?.error?.message ?? "模板小节删除请求失败",
          });
          return;
        }
        replaceTemplateSections(payload.data.sections as LoraTrainingTemplateSection[]);
      } catch (error) {
        replaceTemplateSections(previousSections);
        setOrderedTemplateSectionIds(previousIds);
        pushToast({
          tone: "error",
          title: "模板小节删除失败",
          detail: error instanceof Error ? error.message : "模板小节删除请求失败",
        });
      } finally {
        setIsMutatingTemplateSections(false);
      }
    })();
  }

  function handleReorderTemplateSections(nextIds: string[]) {
    const activeTemplateId = isProductionTrainingRoute && mode === "edit" ? template?.id : null;
    if (activeTemplateId && isMutatingTemplateSections) return;

    setOrderedTemplateSectionIds(nextIds);
    setLocalTemplateSections((current) => orderTemplateSectionsByIds(current, nextIds));

    if (!activeTemplateId) return;

    const previousSections = templateSections;
    const previousIds = orderedTemplateSectionIds;
    setIsMutatingTemplateSections(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplateId}/sections/reorder`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderedSectionIds: nextIds,
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.sections)) {
          replaceTemplateSections(previousSections);
          setOrderedTemplateSectionIds(previousIds);
          pushToast({
            tone: "error",
            title: "模板小节排序失败",
            detail: payload?.error?.message ?? "模板小节排序请求失败",
          });
          return;
        }
        replaceTemplateSections(payload.data.sections as LoraTrainingTemplateSection[]);
      } catch (error) {
        replaceTemplateSections(previousSections);
        setOrderedTemplateSectionIds(previousIds);
        pushToast({
          tone: "error",
          title: "模板小节排序失败",
          detail: error instanceof Error ? error.message : "模板小节排序请求失败",
        });
      } finally {
        setIsMutatingTemplateSections(false);
      }
    })();
  }

  if (mode === "edit" && !template) return <EmptyPage title="没有训练模板数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/templates", label: "返回训练模板" }}
        eyebrow="训练模板"
        title={title}
        subtitle="编辑项目指引、小节设置、预制块和本地块。"
        actions={(
          <>
            {mode === "edit" && template?.id ? (
              <Button
                tone="danger"
                icon={Trash2}
                pending={isDeletingTemplate}
                onClick={handleDeleteTemplate}
              >
                删除
              </Button>
            ) : null}
            <Button
              tone="primary"
              icon={Save}
              pending={isSavingTemplate}
              onClick={handleSaveTemplate}
            >
              {templateDraft ? "更新草稿" : mode === "new" ? "创建模板" : "保存模板"}
            </Button>
          </>
        )}
      />
      <WorkbenchSurface className={s.trainingTemplateEditorSurface}>
        <EditorBlock
          actions={<StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />}
          className={s.trainingTemplateEditorBlock}
          contentClassName={s.trainingTemplateFormGrid}
          description="模板只提供创建训练项目时的初始结构，创建后项目会独立编辑。"
          headerClassName={s.trainingTemplateEditorHeader}
          title="模板信息"
        >
          <Field label="名称" value={templateForm.title} onChange={(value) => handleUpdateTemplateForm("title", value)} />
          <Field multiline features={{ resize: true, clipboard: true }} label="描述" value={templateForm.description} onChange={(value) => handleUpdateTemplateForm("description", value)} />
          {mode === "new" && newTemplateHints.sourceProject ? (
            <Field readOnly label="来源训练项目" value={`${newTemplateHints.sourceProject}${newTemplateHints.sections ? ` · ${newTemplateHints.sections} 个小节` : ""}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="图片提示词指引" value={templateForm.imageGuidance} onChange={(value) => handleUpdateTemplateForm("imageGuidance", value)} />
          <Field multiline features={{ resize: true, clipboard: true }} label="说明文本生成指引" value={templateForm.captionGuidance} onChange={(value) => handleUpdateTemplateForm("captionGuidance", value)} />
        </EditorBlock>
        <EditorBlock
          actions={<Button icon={Plus} onClick={handleAddTemplateSection} feedback="小节草稿已添加">添加小节</Button>}
          className={s.trainingTemplateEditorBlock}
          contentClassName={s.trainingTemplateSectionBlockContent}
          description="排序、编辑、复制、删除；每个小节包含预制块与本地块。"
          headerClassName={s.trainingTemplateEditorHeader}
          title="小节配置"
        >
          <div className={s.trainingTemplateSectionList}>
            {orderedTemplateSectionIds.length === 0 ? (
              <div className={s.emptyInline}>没有初始小节。点击添加小节后，会在这里生成可调整的模板小节。</div>
            ) : null}
            <SortableList items={orderedTemplateSectionIds} onReorder={handleReorderTemplateSections}>
              {orderedTemplateSectionIds.map((sectionId, index) => {
                const section = templateSectionMap[sectionId];
                if (!section) return null;

                return (
                  <TemplateEditorSectionRow
                    index={index}
                    key={section.id}
                    onCopy={handleCopyTemplateSection}
                    onDelete={handleDeleteTemplateSection}
                    section={section}
                    templateId={mode === "edit" ? templateEditorId : undefined}
                  />
                );
              })}
            </SortableList>
          </div>
          <OperationStateStrip
            items={[
              { label: "排序", value: "拖拽释放后保存", tone: "info" },
              { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
        {templateDraft ? (
          <EditorBlock
            actions={<StatusBadge status="ready" label={templateDraft.mode === "new" ? "待创建" : "本地草稿"} />}
            className={s.trainingTemplateEditorBlock}
            description="页面内记录当前模板草稿，可继续调整基础信息和小节列表。"
            headerClassName={s.trainingTemplateEditorHeader}
            title="模板保存草稿"
          >
            <dl className={s.trainingTemplateDraft}>
              <div><dt>名称</dt><dd>{templateDraft.title}</dd></div>
              <div><dt>小节</dt><dd>{templateDraft.sectionCount} 个</dd></div>
              <div><dt>来源项目</dt><dd>{templateDraft.sourceProject || "无"}</dd></div>
              <div><dt>描述</dt><dd>{templateDraft.description}</dd></div>
              <div className={s.trainingTemplateDraftWide}><dt>图片提示词指引</dt><dd>{templateDraft.imageGuidance}</dd></div>
              <div className={s.trainingTemplateDraftWide}><dt>说明文本指引</dt><dd>{templateDraft.captionGuidance}</dd></div>
            </dl>
          </EditorBlock>
        ) : null}
      </WorkbenchSurface>
    </div>
  );
}

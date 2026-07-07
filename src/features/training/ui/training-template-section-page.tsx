"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { CheckSquare, CopyPlus, Plus, Save } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingPreset, LoraTrainingSectionBlock } from "@/features/training/types";
import { findTemplate, isProductionTrainingPath } from "./training-resource-page-utils";
import { TemplateSceneBlockCard, type TemplateSceneBlockPatch } from "./training-template-scene-block-card";
import {
  buildTemplateSectionStateKey,
  moveTemplateBlock,
  nextTemplateSceneBlockOrdinal,
} from "./training-template-page-utils";
import s from "./training-resource-pages.module.css";

type TemplateSectionFormState = {
  enabledLabel: string;
  title: string;
};

type TemplateSectionDraftState = {
  blockCount: number;
  enabledLabel: string;
  firstBlock: string;
  resolvedScene: string;
  sectionId: string;
  sectionTitle: string;
  templateId: string;
  templateTitle: string;
};

export function LoraTrainingTemplateSectionPage({ data, templateId, sectionIndex }: { data: TrainingAppData; templateId?: string; sectionIndex?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const template = findTemplate(data, templateId);
  const index = Number(sectionIndex);
  const section = template && Number.isInteger(index) && index >= 0 ? template.sections[index] : undefined;
  const [templateSectionSceneBlocksByKey, setTemplateSectionSceneBlocksByKey] = useState<Record<string, LoraTrainingSectionBlock[]>>(() => (
    template && section ? { [buildTemplateSectionStateKey(template.id, section.id)]: section.blocks } : {}
  ));
  const [templateSectionFormsByKey, setTemplateSectionFormsByKey] = useState<Record<string, TemplateSectionFormState>>(() => (
    template && section ? {
      [buildTemplateSectionStateKey(template.id, section.id)]: {
        enabledLabel: section.enabled ? "启用" : "停用",
        title: section.title,
      },
    } : {}
  ));
  const [editingTemplateBlockState, setEditingTemplateBlockState] = useState(() => ({
    blockId: null as string | null,
    sectionId: section?.id ?? null,
    templateId: template?.id ?? null,
  }));
  const [templatePresetImportOpen, setTemplatePresetImportOpen] = useState(false);
  const [selectedTemplatePresetId, setSelectedTemplatePresetId] = useState<string | null>(null);
  const [templateSectionDraftsByKey, setTemplateSectionDraftsByKey] = useState<Record<string, TemplateSectionDraftState>>({});
  const [isSavingTemplateSection, setIsSavingTemplateSection] = useState(false);
  const [isMutatingTemplateBlocks, setIsMutatingTemplateBlocks] = useState(false);
  if (!template || !section) return <EmptyPage title="没有模板小节数据" />;

  const activeTemplate = template;
  const activeSection = section;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  const templateSectionStateKey = buildTemplateSectionStateKey(activeTemplate.id, activeSection.id);
  const sceneBlocks = templateSectionSceneBlocksByKey[templateSectionStateKey] ?? activeSection.blocks;
  const visibleTemplateSectionDraft = templateSectionDraftsByKey[templateSectionStateKey] ?? null;
  const visibleEditingTemplateBlockId = editingTemplateBlockState.templateId === activeTemplate.id && editingTemplateBlockState.sectionId === activeSection.id ? editingTemplateBlockState.blockId : null;
  const templateSectionForm = templateSectionFormsByKey[templateSectionStateKey] ?? {
    enabledLabel: activeSection.enabled ? "启用" : "停用",
    title: activeSection.title,
  };
  const selectedTemplatePreset = training.presets.find((preset) => preset.id === selectedTemplatePresetId) ?? null;
  const resolvedTemplateScene = sceneBlocks.map((block) => block.text).join("\n\n");

  function setEditingTemplateBlockId(blockId: string | null) {
    setEditingTemplateBlockState({
      blockId,
      sectionId: activeSection.id,
      templateId: activeTemplate.id,
    });
  }

  function handleUpdateTemplateSectionForm(field: "enabledLabel" | "title", value: string) {
    setTemplateSectionFormsByKey((current) => ({
      ...current,
      [templateSectionStateKey]: {
        ...(current[templateSectionStateKey] ?? templateSectionForm),
        [field]: value,
      },
    }));
  }

  function updateTemplateBlocks(updater: (current: LoraTrainingSectionBlock[]) => LoraTrainingSectionBlock[]) {
    setTemplateSectionSceneBlocksByKey((current) => ({
      ...current,
      [templateSectionStateKey]: updater(current[templateSectionStateKey] ?? activeSection.blocks),
    }));
  }

  function replaceTemplateBlocks(blocks: LoraTrainingSectionBlock[]) {
    setTemplateSectionSceneBlocksByKey((current) => ({
      ...current,
      [templateSectionStateKey]: blocks,
    }));
  }

  function handleAddLocalTemplateBlock() {
    const nextBlock = {
      source: "本地" as const,
      title: `模板补充块 ${nextTemplateSceneBlockOrdinal(sceneBlocks, `${activeSection.id}-template-local-block-`)}`,
      text: "补充模板导入后默认带入的场景描述。",
    };

    if (!isProductionTrainingRoute) {
      updateTemplateBlocks((current) => {
        const ordinal = nextTemplateSceneBlockOrdinal(current, `${activeSection.id}-template-local-block-`);
        return [
          ...current,
          {
            id: `${activeSection.id}-template-local-block-${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      return;
    }

    if (isMutatingTemplateBlocks) return;

    setIsMutatingTemplateBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplate.id}/sections/${activeSection.id}/blocks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "模板场景块创建失败",
            detail: payload?.error?.message ?? "模板场景块创建请求失败",
          });
          return;
        }
        replaceTemplateBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "模板场景块创建失败",
          detail: error instanceof Error ? error.message : "模板场景块创建请求失败",
        });
      } finally {
        setIsMutatingTemplateBlocks(false);
      }
    })();
  }

  function handleImportTemplatePresetBlock(preset: LoraTrainingPreset | null) {
    if (!preset) return;
    const nextBlock = {
      source: "预制" as const,
      title: preset.title,
      text: preset.sceneDescriptionText,
    };

    if (!isProductionTrainingRoute) {
      updateTemplateBlocks((current) => {
        const prefix = `${activeSection.id}-template-preset-block-${preset.id}-`;
        const ordinal = nextTemplateSceneBlockOrdinal(current, `${activeSection.id}-template-preset-block-${preset.id}-`);
        return [
          ...current,
          {
            id: `${prefix}${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      setTemplatePresetImportOpen(false);
      return;
    }

    if (isMutatingTemplateBlocks) return;

    setIsMutatingTemplateBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplate.id}/sections/${activeSection.id}/blocks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "模板场景块创建失败",
            detail: payload?.error?.message ?? "模板场景块创建请求失败",
          });
          return;
        }
        replaceTemplateBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
        setTemplatePresetImportOpen(false);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "模板场景块创建失败",
          detail: error instanceof Error ? error.message : "模板场景块创建请求失败",
        });
      } finally {
        setIsMutatingTemplateBlocks(false);
      }
    })();
  }

  function handleMoveTemplateBlock(index: number, direction: -1 | 1) {
    const reorderedBlocks = moveTemplateBlock(sceneBlocks, index, direction);

    if (!isProductionTrainingRoute) {
      updateTemplateBlocks((current) => moveTemplateBlock(current, index, direction));
      return;
    }

    if (isMutatingTemplateBlocks) return;

    const previousBlocks = sceneBlocks;
    replaceTemplateBlocks(reorderedBlocks);
    setIsMutatingTemplateBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplate.id}/sections/${activeSection.id}/blocks/reorder`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ids: reorderedBlocks.map((block) => block.id),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
          replaceTemplateBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "模板场景块排序失败",
            detail: payload?.error?.message ?? "模板场景块排序请求失败",
          });
          return;
        }
        replaceTemplateBlocks(payload.data as LoraTrainingSectionBlock[]);
      } catch (error) {
        replaceTemplateBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "模板场景块排序失败",
          detail: error instanceof Error ? error.message : "模板场景块排序请求失败",
        });
      } finally {
        setIsMutatingTemplateBlocks(false);
      }
    })();
  }

  function handleUpdateTemplateBlock(blockId: string, patch: TemplateSceneBlockPatch) {
    if (!isProductionTrainingRoute) {
      updateTemplateBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
      return;
    }

    if (isMutatingTemplateBlocks) return;

    const previousBlocks = sceneBlocks;
    const nextBlocks = sceneBlocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block));
    replaceTemplateBlocks(nextBlocks);
    setIsMutatingTemplateBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplate.id}/blocks/${blockId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          replaceTemplateBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "模板场景块保存失败",
            detail: payload?.error?.message ?? "模板场景块保存请求失败",
          });
          return;
        }
        replaceTemplateBlocks(nextBlocks.map((block) => block.id === blockId ? payload.data as LoraTrainingSectionBlock : block));
      } catch (error) {
        replaceTemplateBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "模板场景块保存失败",
          detail: error instanceof Error ? error.message : "模板场景块保存请求失败",
        });
      } finally {
        setIsMutatingTemplateBlocks(false);
      }
    })();
  }

  function handleDeleteTemplateBlock(blockId: string) {
    if (!isProductionTrainingRoute) {
      if (visibleEditingTemplateBlockId === blockId) setEditingTemplateBlockId(null);
      updateTemplateBlocks((current) => current.filter((block) => block.id !== blockId));
      return;
    }

    if (isMutatingTemplateBlocks) return;

    const previousBlocks = sceneBlocks;
    if (visibleEditingTemplateBlockId === blockId) setEditingTemplateBlockId(null);
    replaceTemplateBlocks(sceneBlocks.filter((block) => block.id !== blockId));
    setIsMutatingTemplateBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/templates/${activeTemplate.id}/blocks/${blockId}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          replaceTemplateBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "模板场景块删除失败",
            detail: payload?.error?.message ?? "模板场景块删除请求失败",
          });
          return;
        }
      } catch (error) {
        replaceTemplateBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "模板场景块删除失败",
          detail: error instanceof Error ? error.message : "模板场景块删除请求失败",
        });
      } finally {
        setIsMutatingTemplateBlocks(false);
      }
    })();
  }

  async function handleSaveTemplateSection() {
    const nextDraft = {
      blockCount: sceneBlocks.length,
      enabledLabel: templateSectionForm.enabledLabel,
      firstBlock: sceneBlocks[0]?.title ?? "无场景块",
      resolvedScene: resolvedTemplateScene || activeSection.resolvedScene,
      sectionId: activeSection.id,
      sectionTitle: templateSectionForm.title,
      templateId: activeTemplate.id,
      templateTitle: activeTemplate.title,
    };

    if (!isProductionTrainingRoute) {
      setTemplateSectionDraftsByKey((current) => ({
        ...current,
        [templateSectionStateKey]: nextDraft,
      }));
      pushToast({
        tone: "success",
        title: visibleTemplateSectionDraft ? "模板小节保存草稿已更新" : "模板小节保存草稿已记录",
        detail: templateSectionForm.title,
      });
      return;
    }

    if (isSavingTemplateSection) return;

    setIsSavingTemplateSection(true);
    try {
      const response = await fetch(`/api/training/templates/${activeTemplate.id}/sections/${activeSection.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: templateSectionForm.title,
          enabled: templateSectionForm.enabledLabel === "启用",
          blocks: sceneBlocks,
          resolvedScene: resolvedTemplateScene || activeSection.resolvedScene,
          scenePreview: resolvedTemplateScene || activeSection.scenePreview,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "模板小节保存失败",
          detail: payload?.error?.message ?? "模板小节保存请求失败",
        });
        return;
      }

      setTemplateSectionDraftsByKey((current) => ({
        ...current,
        [templateSectionStateKey]: nextDraft,
      }));
      pushToast({
        tone: "success",
        title: "模板小节已保存",
        detail: templateSectionForm.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "模板小节保存失败",
        detail: error instanceof Error ? error.message : "模板小节保存请求失败",
      });
    } finally {
      setIsSavingTemplateSection(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/training/templates/${activeTemplate.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${activeTemplate.title} / ${templateSectionForm.title}`}
        subtitle="模板小节与项目小节保持相同的场景块编辑心智。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isSavingTemplateSection}
            onClick={handleSaveTemplateSection}
          >
            {visibleTemplateSectionDraft ? "更新小节草稿" : "保存小节"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="运行参数">
          <div className={s.stack}>
            <Field label="小节名" value={templateSectionForm.title} onChange={(value) => handleUpdateTemplateSectionForm("title", value)} />
            <FloatingSelect label="启用状态" value={templateSectionForm.enabledLabel} options={["启用", "停用"]} onChange={(value) => handleUpdateTemplateSectionForm("enabledLabel", value)} />
            <Field readOnly label="场景块数量" value={`${sceneBlocks.length}`} />
          </div>
        </Panel>
        <Panel
          title="场景块"
          subtitle="模板导入项目时会复制这些块；预制块保持引用，本地块复制文本。"
          actions={(
            <>
              <Button
                size="sm"
                icon={CopyPlus}
                onClick={() => setTemplatePresetImportOpen(!templatePresetImportOpen)}
                feedback={{ title: templatePresetImportOpen ? "模板预制选择已收起" : "模板预制选择已打开", detail: templateSectionForm.title }}
              >
                {templatePresetImportOpen ? "收起预制" : "选择预制"}
              </Button>
              <Button
                size="sm"
                icon={CheckSquare}
                disabled={!selectedTemplatePreset}
                onClick={() => handleImportTemplatePresetBlock(selectedTemplatePreset)}
                feedback={{ title: "预制已导入模板块", detail: selectedTemplatePreset?.title ?? section.title }}
              >
                导入所选
              </Button>
              <Button size="sm" icon={Plus} onClick={handleAddLocalTemplateBlock} feedback={{ title: "模板本地块已添加", detail: templateSectionForm.title }}>添加本地块</Button>
            </>
          )}
        >
          {templatePresetImportOpen ? (
            <div className={s.templatePresetImportPanel} aria-label="模板预制候选">
              <div className={s.templatePresetImportHeader}>
                <strong>选择要导入模板的小节预制</strong>
                <span>{selectedTemplatePreset ? `已选择 ${selectedTemplatePreset.title}` : "先选择一个预制，再导入为模板块"}</span>
              </div>
              <div className={s.templatePresetImportGrid}>
                {training.presets.map((preset) => {
                  const isSelected = selectedTemplatePresetId === preset.id;
                  return (
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      className={cx(s.templatePresetImportItem, isSelected && s.templatePresetImportItemSelected)}
                      key={preset.id}
                      onClick={() => setSelectedTemplatePresetId(preset.id)}
                    >
                      <span className={s.templatePresetImportItemTop}>
                        <strong>{preset.title}</strong>
                        <em>{preset.category} / {preset.folder}</em>
                      </span>
                      <span className={s.templatePresetImportStatus}>{preset.status === "active" ? "启用" : "停用"}</span>
                      <p>{preset.sceneDescriptionText}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className={s.templateSceneBlockList}>
            {sceneBlocks.map((block, blockIndex) => (
              <TemplateSceneBlockCard
                block={block}
                index={blockIndex}
                isEditing={visibleEditingTemplateBlockId === block.id}
                key={block.id}
                onDelete={handleDeleteTemplateBlock}
                onEdit={setEditingTemplateBlockId}
                onMove={handleMoveTemplateBlock}
                onUpdate={handleUpdateTemplateBlock}
                total={sceneBlocks.length}
              />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="合成预览" subtitle="模板小节保存的是可读业务文案，导入项目后仍可继续改。">
        <div className={s.templateResolvedPreview}>
          <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={resolvedTemplateScene || section.resolvedScene} />
          <Field readOnly multiline features={{ clipboard: true }} label="小节摘要" value={section.scenePreview} />
        </div>
      </Panel>
      {visibleTemplateSectionDraft ? (
        <Panel title="模板小节保存草稿" subtitle="页面内记录当前小节、场景块和合成场景描述。">
          <dl className={s.trainingTemplateSectionDraft}>
            <div><dt>模板</dt><dd>{visibleTemplateSectionDraft.templateTitle}</dd></div>
            <div><dt>小节</dt><dd>{visibleTemplateSectionDraft.sectionTitle}</dd></div>
            <div><dt>状态</dt><dd>{visibleTemplateSectionDraft.enabledLabel}</dd></div>
            <div><dt>场景块</dt><dd>{visibleTemplateSectionDraft.blockCount} 个 · {visibleTemplateSectionDraft.firstBlock}</dd></div>
            <div className={s.trainingTemplateDraftWide}><dt>合成场景</dt><dd>{visibleTemplateSectionDraft.resolvedScene}</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}

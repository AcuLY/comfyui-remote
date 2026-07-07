"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, CopyPlus, Edit3, GripVertical, Plus, Save, Trash2 } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingImageResult, LoraTrainingPreset, LoraTrainingSectionBlock } from "@/features/training/types";

import {
  buildProjectSectionStateKey,
  findProject,
  findSection,
  isProductionTrainingPath,
  moveSceneBlock,
  nextSceneBlockOrdinal,
  reviewResultToastTitle,
  sceneBlockPreviewText,
  toTrainingImageReviewApiStatus,
} from "./project-page-utils";
import { ProjectHeader } from "./project-page-shell";
import { TrainingResultGrid } from "./training-result-grid";
import { TrainingSectionWorkspace } from "./training-section-workspace";
import s from "./training-project-pages.module.css";
import { useProjectSectionResults } from "./use-project-section-results";
import { useProjectSectionSceneBlocks } from "./use-project-section-scene-blocks";
import { useProjectSectionDraft } from "./use-project-section-draft";

type SceneBlockPatch = Partial<Pick<LoraTrainingSectionBlock, "text" | "title">>;

function SceneBlockCard({
  block,
  index,
  isEditing,
  onDelete,
  onEdit,
  onMove,
  onUpdate,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  isEditing?: boolean;
  onDelete?: (blockId: string) => void;
  onEdit?: (blockId: string | null) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  onUpdate?: (blockId: string, patch: SceneBlockPatch) => void;
  total: number;
}) {
  return (
    <article className={s.sceneBlockCard} data-editing={isEditing ? "true" : undefined}>
      <span className={s.sceneBlockGrip} aria-hidden="true">
        <GripVertical />
      </span>
      <div className={s.sceneBlockBody}>
        <div className={s.sceneBlockTitleRow}>
          <strong>{block.title}</strong>
          <span className={s.sceneBlockSource}>{block.source}</span>
        </div>
        {!isEditing ? (
          <span className={s.sceneBlockPreview}>
            <span className={s.sceneBlockPreviewSign}>+</span>
            <code>{sceneBlockPreviewText(block.text)}</code>
          </span>
        ) : null}
      </div>
      <div className={s.sceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button className={s.sceneBlockIconButton} size="sm" iconOnly icon={Edit3} ariaLabel={isEditing ? `收起场景块编辑：${block.title}` : `编辑场景块：${block.title}`} onClick={() => onEdit?.(isEditing ? null : block.id)} />
        <Button className={s.sceneBlockIconButton} size="sm" iconOnly icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移场景块：${block.title}`} feedback={{ title: "场景块已上移", detail: block.title }} />
        <Button className={s.sceneBlockIconButton} size="sm" iconOnly icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移场景块：${block.title}`} feedback={{ title: "场景块已下移", detail: block.title }} />
        <Button className={s.sceneBlockIconButton} size="sm" iconOnly icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除场景块：${block.title}`} feedback={{ tone: "warning", title: "场景块已从草稿移除", detail: block.title }} />
      </div>
      {isEditing ? (
        <div className={s.sceneBlockInlineBody}>
          <div className={s.sceneBlockEditor}>
            <Field label="场景块标题" value={block.title} onChange={(value) => onUpdate?.(block.id, { title: value })} />
            <Field
              multiline
              features={{ clipboard: true, resize: true }}
              label="场景块文本"
              value={block.text}
              onChange={(value) => onUpdate?.(block.id, { text: value })}
            />
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function LoraTrainingProjectSectionDetailPage({ data, projectId, sectionId }: { data: TrainingAppData; projectId?: string; sectionId?: string }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const project = findProject(data, projectId);
  const section = findSection(project, sectionId);
  const initialProjectSectionStateKey = project && section ? buildProjectSectionStateKey(project.id, section.id) : null;
  const { sectionResults, updateSectionResultReviewStatus } = useProjectSectionResults(project?.id ?? null, section?.id ?? null, project?.resultPool ?? []);
  const {
    replaceSceneBlocks,
    sceneBlocks,
    scenePreview,
    setEditingSceneBlockId,
    updateSceneBlocks,
    visibleEditingSceneBlockId,
  } = useProjectSectionSceneBlocks(project?.id ?? null, section?.id ?? null, section?.blocks ?? []);
  const [presetImportOpen, setPresetImportOpen] = useState(false);
  const [selectedTrainingPresetId, setSelectedTrainingPresetId] = useState<string | null>(null);
  const { saveSectionDraft, visibleSectionDraft } = useProjectSectionDraft(initialProjectSectionStateKey);
  const [isReviewingSectionResult, setIsReviewingSectionResult] = useState(false);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [isMutatingSceneBlocks, setIsMutatingSceneBlocks] = useState(false);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);
  if (!project || !section) return <EmptyPage title="没有训练小节详情" />;

  const activeProject = project;
  const activeSection = section;
  const selectedTrainingPreset = training.presets.find((preset) => preset.id === selectedTrainingPresetId) ?? null;

  function handleAddLocalSceneBlock() {
    const nextBlock = {
      source: "本地" as const,
      title: `本地补充块 ${nextSceneBlockOrdinal(sceneBlocks, `${activeSection.id}-local-block-`)}`,
      text: "补充这一小节的造型、动作或画面约束。",
    };

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => {
        const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-local-block-`);
        return [
          ...current,
          {
            id: `${activeSection.id}-local-block-${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      return;
    }

    if (isMutatingSceneBlocks) return;

    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "场景块创建失败",
            detail: payload?.error?.message ?? "场景块创建请求失败",
          });
          return;
        }
        replaceSceneBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "场景块创建失败",
          detail: error instanceof Error ? error.message : "场景块创建请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleImportPresetBlock(preset: LoraTrainingPreset | null) {
    if (!preset) return;
    const nextBlock = {
      source: "预制" as const,
      title: preset.title,
      text: preset.sceneDescriptionText,
    };

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => {
        const prefix = `${activeSection.id}-preset-block-${preset.id}-`;
        const ordinal = nextSceneBlockOrdinal(current, `${activeSection.id}-preset-block-${preset.id}-`);
        return [
          ...current,
          {
            id: `${prefix}${ordinal}`,
            ...nextBlock,
          },
        ];
      });
      setPresetImportOpen(false);
      return;
    }

    if (isMutatingSceneBlocks) return;

    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextBlock),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          pushToast({
            tone: "error",
            title: "场景块创建失败",
            detail: payload?.error?.message ?? "场景块创建请求失败",
          });
          return;
        }
        replaceSceneBlocks([...sceneBlocks, payload.data as LoraTrainingSectionBlock]);
        setPresetImportOpen(false);
      } catch (error) {
        pushToast({
          tone: "error",
          title: "场景块创建失败",
          detail: error instanceof Error ? error.message : "场景块创建请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleMoveSceneBlock(index: number, direction: -1 | 1) {
    const reorderedBlocks = moveSceneBlock(sceneBlocks, index, direction);

    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => moveSceneBlock(current, index, direction));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    replaceSceneBlocks(reorderedBlocks);
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/sections/${activeSection.id}/blocks/reorder?projectId=${activeProject.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ids: reorderedBlocks.map((block) => block.id),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !Array.isArray(payload?.data)) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块排序失败",
            detail: payload?.error?.message ?? "场景块排序请求失败",
          });
          return;
        }
        replaceSceneBlocks(payload.data as LoraTrainingSectionBlock[]);
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块排序失败",
          detail: error instanceof Error ? error.message : "场景块排序请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleUpdateSceneBlock(blockId: string, patch: SceneBlockPatch) {
    if (!isProductionTrainingRoute) {
      updateSceneBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    const nextBlocks = sceneBlocks.map((block) => (block.id === blockId ? { ...block, ...patch } : block));
    replaceSceneBlocks(nextBlocks);
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/blocks/${blockId}?projectId=${activeProject.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok || !payload?.data?.id) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块保存失败",
            detail: payload?.error?.message ?? "场景块保存请求失败",
          });
          return;
        }
        replaceSceneBlocks(nextBlocks.map((block) => block.id === blockId ? payload.data as LoraTrainingSectionBlock : block));
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块保存失败",
          detail: error instanceof Error ? error.message : "场景块保存请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  function handleDeleteSceneBlock(blockId: string) {
    if (!isProductionTrainingRoute) {
      if (visibleEditingSceneBlockId === blockId) setEditingSceneBlockId(null);
      updateSceneBlocks((current) => current.filter((block) => block.id !== blockId));
      return;
    }

    if (isMutatingSceneBlocks) return;

    const previousBlocks = sceneBlocks;
    if (visibleEditingSceneBlockId === blockId) setEditingSceneBlockId(null);
    replaceSceneBlocks(sceneBlocks.filter((block) => block.id !== blockId));
    setIsMutatingSceneBlocks(true);
    void (async () => {
      try {
        const response = await fetch(`/api/training/blocks/${blockId}?projectId=${activeProject.id}`, {
          method: "DELETE",
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          replaceSceneBlocks(previousBlocks);
          pushToast({
            tone: "error",
            title: "场景块删除失败",
            detail: payload?.error?.message ?? "场景块删除请求失败",
          });
          return;
        }
      } catch (error) {
        replaceSceneBlocks(previousBlocks);
        pushToast({
          tone: "error",
          title: "场景块删除失败",
          detail: error instanceof Error ? error.message : "场景块删除请求失败",
        });
      } finally {
        setIsMutatingSceneBlocks(false);
      }
    })();
  }

  async function handleReviewSectionResult(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    const reviewedResult = sectionResults.find((result) => result.id === resultId);

    const applyLocalReview = () => {
      updateSectionResultReviewStatus(resultId, reviewStatus);
    };

    if (!isProductionTrainingRoute) {
      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? activeSection.title,
      });
      return;
    }

    if (isReviewingSectionResult) return;

    setIsReviewingSectionResult(true);
    try {
      const response = await fetch(`/api/training/image-results/${resultId}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reviewStatus: toTrainingImageReviewApiStatus(reviewStatus),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "结果审核失败",
          detail: payload?.error?.message ?? "训练结果审核请求失败",
        });
        return;
      }

      applyLocalReview();
      pushToast({
        tone: reviewStatus === "kept" ? "success" : "warning",
        title: reviewResultToastTitle(reviewStatus),
        detail: reviewedResult?.sourceLabel ?? activeSection.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "结果审核失败",
        detail: error instanceof Error ? error.message : "训练结果审核请求失败",
      });
    } finally {
      setIsReviewingSectionResult(false);
    }
  }

  async function handleSaveSection() {
    const nextDraft = {
      blockCount: sceneBlocks.length,
      firstBlock: sceneBlocks[0]?.title ?? "无场景块",
      imagePrompt: activeSection.imagePrompt,
      projectId: activeProject.id,
      projectTitle: activeProject.title,
      scenePreview: scenePreview || activeSection.resolvedScene,
      sectionId: activeSection.id,
      sectionTitle: activeSection.title,
    };

    if (!isProductionTrainingRoute) {
      saveSectionDraft(nextDraft);
      pushToast({
        tone: "success",
        title: visibleSectionDraft ? "小节保存草稿已更新" : "小节保存草稿已记录",
        detail: activeSection.title,
      });
      return;
    }

    if (isSavingSection) return;

    setIsSavingSection(true);
    try {
      const response = await fetch(`/api/training/projects/${activeProject.id}/sections/${activeSection.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: activeSection.title,
          enabled: activeSection.enabled,
          blocks: sceneBlocks,
          resolvedScene: scenePreview || activeSection.resolvedScene,
          imagePrompt: activeSection.imagePrompt,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "小节保存失败",
          detail: payload?.error?.message ?? "训练小节保存请求失败",
        });
        return;
      }

      saveSectionDraft(nextDraft);
      pushToast({
        tone: "success",
        title: "训练小节已保存",
        detail: activeSection.title,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "小节保存失败",
        detail: error instanceof Error ? error.message : "训练小节保存请求失败",
      });
    } finally {
      setIsSavingSection(false);
    }
  }

  return (
    <div className={s.page}>
      <ProjectHeader
        active="sections"
        project={project}
        title={`${project.title} / ${section.title}`}
        actions={(
          <Button
            icon={Save}
            pending={isSavingSection}
            onClick={handleSaveSection}
          >
            {visibleSectionDraft ? "更新小节草稿" : "保存小节"}
          </Button>
        )}
      />
      <TrainingSectionWorkspace activeSectionId={section.id} project={project}>
        <div id="section-results">
          <Panel title="小节结果">
            <TrainingResultGrid
              onReviewStatusChange={handleReviewSectionResult}
              results={sectionResults}
              title={`${section.title} 结果`}
            />
          </Panel>
        </div>
        <div className={s.twoCol}>
          <Panel
            title="场景块"
            subtitle="预制块和本地块按合成顺序生效，可单独编辑、排序或删除。"
            actions={(
              <>
                <Button
                  size="sm"
                  icon={CopyPlus}
                  onClick={() => setPresetImportOpen(!presetImportOpen)}
                  feedback={{ title: presetImportOpen ? "预制选择已收起" : "预制选择已打开", detail: section.title }}
                >
                  {presetImportOpen ? "收起预制" : "选择预制"}
                </Button>
                <Button
                  size="sm"
                  icon={Check}
                  disabled={!selectedTrainingPreset}
                  onClick={() => handleImportPresetBlock(selectedTrainingPreset)}
                  feedback={{ title: "预制已导入场景块", detail: selectedTrainingPreset?.title ?? section.title }}
                >
                  导入所选
                </Button>
                <Button size="sm" icon={Plus} onClick={handleAddLocalSceneBlock} feedback={{ title: "本地块已添加", detail: section.title }}>添加本地块</Button>
              </>
            )}
          >
            {presetImportOpen ? (
              <div className={s.trainingPresetImportPanel} aria-label="训练预制候选">
                <div className={s.trainingPresetImportHeader}>
                  <strong>选择要导入的小节预制</strong>
                  <span>{selectedTrainingPreset ? `已选择 ${selectedTrainingPreset.title}` : "先选择一个预制，再导入为场景块"}</span>
                </div>
                <div className={s.trainingPresetImportGrid}>
                  {training.presets.map((preset) => {
                    const isSelected = selectedTrainingPresetId === preset.id;
                    return (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        className={cx(s.trainingPresetImportItem, isSelected && s.trainingPresetImportItemSelected)}
                        key={preset.id}
                        onClick={() => setSelectedTrainingPresetId(preset.id)}
                      >
                        <span className={s.trainingPresetImportItemTop}>
                          <strong>{preset.title}</strong>
                          <em>{preset.category} / {preset.folder}</em>
                        </span>
                        <span className={s.trainingPresetImportStatus}>{preset.status === "active" ? "启用" : "停用"}</span>
                        <p>{preset.sceneDescriptionText}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className={s.sceneBlockList}>
              {sceneBlocks.map((block, index) => (
                <SceneBlockCard
                  block={block}
                  index={index}
                  isEditing={visibleEditingSceneBlockId === block.id}
                  key={block.id}
                  onDelete={handleDeleteSceneBlock}
                  onEdit={setEditingSceneBlockId}
                  onMove={handleMoveSceneBlock}
                  onUpdate={handleUpdateSceneBlock}
                  total={sceneBlocks.length}
                />
              ))}
            </div>
          </Panel>
          <Panel title="合成预览">
            <div className={s.formStack}>
              <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={scenePreview || section.resolvedScene} />
              <Field readOnly multiline features={{ clipboard: true }} label="图片提示词" value={section.imagePrompt} />
            </div>
          </Panel>
        </div>
        {visibleSectionDraft ? (
          <Panel title="小节保存草稿" subtitle="页面内记录当前场景块、合成场景和图片提示词。">
            <dl className={s.sectionDraftGrid}>
              <div><dt>项目</dt><dd>{visibleSectionDraft.projectTitle}</dd></div>
              <div><dt>小节</dt><dd>{visibleSectionDraft.sectionTitle}</dd></div>
              <div><dt>场景块</dt><dd>{visibleSectionDraft.blockCount} 个 · {visibleSectionDraft.firstBlock}</dd></div>
              <div><dt>图片提示词</dt><dd>{visibleSectionDraft.imagePrompt}</dd></div>
              <div><dt>合成场景</dt><dd>{visibleSectionDraft.scenePreview}</dd></div>
            </dl>
          </Panel>
        ) : null}
      </TrainingSectionWorkspace>
    </div>
  );
}

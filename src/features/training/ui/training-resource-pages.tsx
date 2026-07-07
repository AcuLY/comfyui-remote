"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, CheckSquare, CopyPlus, Edit3, Plus, Save, Trash2 } from "lucide-react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { OperationStateStrip } from "@/components/design-demo-ui/feedback/operation-state-strip";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { Field } from "@/components/design-demo-ui/primitives/field";
import { FloatingSelect } from "@/components/design-demo-ui/primitives/floating-select";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { Panel } from "@/components/design-demo-ui/primitives/panel";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { SortableList } from "@/components/design-demo-ui/primitives/sortable";
import { EditorBlock, FolderBreadcrumb, FolderRow, SelectionBatchBar, UnitRowShell, WorkbenchSurface } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingPreset, LoraTrainingProject, LoraTrainingSectionBlock, LoraTrainingTemplate } from "@/features/training/types";
import {
  createProjectFromTemplateHref,
  findPreset,
  findTemplate,
  isProductionTrainingPath,
  readNewPresetHints,
  readNewTemplateHints,
  type NewPresetHints,
  uniquePresetCategories,
  uniquePresetFolders,
} from "./training-resource-page-utils";
import { TrainingPresetCategoryRailItem, TrainingPresetLibraryItemRow, presetStatus } from "./training-preset-library-primitives";
import { TrainingPresetSortPanel, orderTrainingPresetSortItems, type TrainingPresetSortItem } from "./training-preset-sort-panel";
import { TrainingTemplateListItem, readAndClearTrainingTemplateListAnchor } from "./training-template-list-primitives";
import { TemplateEditorSectionRow, type LoraTrainingTemplateSection } from "./training-template-section-row";
import { useResourceUrlSearch } from "./use-resource-url-search";
import s from "./training-resource-pages.module.css";

type TemplateSceneBlockPatch = Partial<Pick<LoraTrainingSectionBlock, "text" | "title">>;

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

function buildTemplateSectionStateKey(templateId: string, sectionId: string) {
  return `${templateId}:${sectionId}`;
}

function moveTemplateBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

function nextTemplateSceneBlockOrdinal(blocks: LoraTrainingSectionBlock[], prefix: string) {
  const ordinals = blocks
    .map((block) => (block.id.startsWith(prefix) ? Number(block.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextTemplateSectionCopyNumber(sections: LoraTrainingTemplateSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function nextTemplateSectionDraftNumber(sections: LoraTrainingTemplateSection[]) {
  const draftPrefix = "new-template-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

function orderTemplateSectionsByIds(sections: LoraTrainingTemplateSection[], orderedIds: string[]) {
  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));
  const orderedSections = orderedIds.map((id) => sectionMap[id]).filter((section): section is LoraTrainingTemplateSection => Boolean(section));
  const missingSections = sections.filter((section) => !orderedIds.includes(section.id));
  return [...orderedSections, ...missingSections];
}

function orderTrainingTemplatesByIds(templates: LoraTrainingTemplate[], orderedIds: string[]) {
  const templateMap = Object.fromEntries(templates.map((template) => [template.id, template]));
  const orderedTemplates = orderedIds.map((id) => templateMap[id]).filter((template): template is LoraTrainingTemplate => Boolean(template));
  const missingTemplates = templates.filter((template) => !orderedIds.includes(template.id));
  return [...orderedTemplates, ...missingTemplates];
}

function buildTemplateSectionsFromProject(project: LoraTrainingProject): LoraTrainingTemplateSection[] {
  return project.sections.map((section) => ({
    id: `project-${project.id}-${section.id}`,
    title: section.title,
    enabled: section.enabled,
    blockCount: section.blocks.length,
    blocks: section.blocks.map((block) => ({
      ...block,
      id: `project-${project.id}-${section.id}-${block.id}`,
    })),
    resolvedScene: section.resolvedScene,
    scenePreview: section.resolvedScene || section.title,
  }));
}

function createDraftTrainingPreset(hints: NewPresetHints): LoraTrainingPreset {
  const artifactTitle = hints.artifact.replace(/\.safetensors$/i, "");
  const sourceLabel = hints.project || artifactTitle;
  return {
    id: "new-training-preset",
    title: sourceLabel ? `${sourceLabel} 训练预制` : "新训练预制",
    category: hints.category || "未分类",
    folder: hints.folder || "未归档",
    status: "active",
    updatedAt: "本地草稿",
    sceneDescriptionText: hints.artifact
      ? `从 ${hints.project || "训练项目"} 的训练产物 ${hints.artifact} 创建，补充后作为可复用场景描述导入训练小节。`
      : "在这里补充可复用的场景描述，只描述训练小节需要导入的场景文本。",
    projectUsage: [],
    templateUsage: [],
  };
}

function TemplateSceneBlockCard({
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
  onUpdate?: (blockId: string, patch: TemplateSceneBlockPatch) => void;
  total: number;
}) {
  return (
    <article className={s.templateSceneBlockCard}>
      <div className={s.templateSceneBlockBody}>
        <span>{block.source === "预制" ? "预制块" : "本地块"}</span>
        {isEditing ? (
          <div className={s.templateSceneBlockEditor}>
            <Field label="模板块标题" value={block.title} onChange={(value) => onUpdate?.(block.id, { title: value })} />
            <Field
              multiline
              features={{ clipboard: true, resize: true }}
              label="模板块文本"
              value={block.text}
              onChange={(value) => onUpdate?.(block.id, { text: value })}
            />
          </div>
        ) : (
          <>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </>
        )}
      </div>
      <div className={s.templateSceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={isEditing ? `收起模板场景块编辑：${block.title}` : `编辑模板场景块：${block.title}`} onClick={() => onEdit?.(isEditing ? null : block.id)}>{isEditing ? "收起" : "编辑"}</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移模板场景块：${block.title}`} feedback={{ title: "模板块已上移", detail: block.title }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移模板场景块：${block.title}`} feedback={{ title: "模板块已下移", detail: block.title }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除模板场景块：${block.title}`} feedback={{ tone: "warning", title: "模板块已从草稿移除", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}

export function LoraTrainingPresetsPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const categories = uniquePresetCategories(training.presets);
  const [orderedPresetCategories, setOrderedPresetCategories] = useState(() => categories);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [hiddenPresetIds, setHiddenPresetIds] = useState<Set<string>>(() => new Set());
  const [orderedPresetIds, setOrderedPresetIds] = useState(() => training.presets.reduce<string[]>((ids, preset) => [...ids, preset.id], []));
  const [isDeletingPresets, setIsDeletingPresets] = useState(false);
  const presetMap = new Map(training.presets.reduce<Array<[string, LoraTrainingPreset]>>((entries, preset) => [...entries, [preset.id, preset]], []));
  const orderedPresets = orderedPresetIds
    .map((presetId) => presetMap.get(presetId))
    .filter((preset): preset is LoraTrainingPreset => Boolean(preset));
  const categoryPresets = orderedPresets.filter((preset) => preset.category === activeCategory && !hiddenPresetIds.has(preset.id));
  const folders = uniquePresetFolders(categoryPresets);
  const visiblePresets = categoryPresets.filter((preset) => !currentFolder || preset.folder === currentFolder);
  const visiblePresetIds = visiblePresets.map((preset) => preset.id);
  const selectedCount = selectedIds.size;
  const activeCategoryLabel = activeCategory || "训练预制";
  const newPresetInCategoryHref = `/training/presets/new?category=${encodeURIComponent(activeCategory)}${currentFolder ? `&folder=${encodeURIComponent(currentFolder)}` : ""}`;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  async function persistPresetLibrarySortRules(input: {
    categoryOrder: string[];
    onError: () => void;
    presetOrder: string[];
  }) {
    try {
      const response = await fetch("/api/training/presets/sort-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryOrder: input.categoryOrder,
          presetOrder: input.presetOrder,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        input.onError();
        pushToast({
          tone: "error",
          title: "训练预制排序保存失败",
          detail: payload?.error?.message ?? "训练预制排序保存请求失败",
        });
      }
    } catch (error) {
      input.onError();
      pushToast({
        tone: "error",
        title: "训练预制排序保存失败",
        detail: error instanceof Error ? error.message : "训练预制排序保存请求失败",
      });
    }
  }

  function togglePresetSelection(presetId: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(presetId);
      else next.delete(presetId);
      return next;
    });
  }

  function applyLocalPresetDelete(presetIds: Iterable<string>) {
    const removed = new Set(presetIds);
    setHiddenPresetIds((previous) => new Set([...previous, ...removed]));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      removed.forEach((presetId) => next.delete(presetId));
      return next;
    });
  }

  async function hidePreset(presetId: string) {
    if (!isProductionTrainingRoute) {
      applyLocalPresetDelete([presetId]);
      return;
    }

    if (isDeletingPresets) return;

    setIsDeletingPresets(true);
    try {
      const response = await fetch(`/api/training/presets/${presetId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "训练预制删除失败",
          detail: payload?.error?.message ?? "训练预制删除请求失败",
        });
        return;
      }

      applyLocalPresetDelete([presetId]);
      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: presetId,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练预制删除失败",
        detail: error instanceof Error ? error.message : "训练预制删除请求失败",
      });
    } finally {
      setIsDeletingPresets(false);
    }
  }

  async function hideSelectedPresets() {
    const selectedPresetIds = [...selectedIds];

    if (!isProductionTrainingRoute) {
      applyLocalPresetDelete(selectedPresetIds);
      return;
    }

    if (isDeletingPresets || selectedPresetIds.length === 0) return;

    setIsDeletingPresets(true);
    try {
      const responses = await Promise.all(
        selectedPresetIds.map(async (presetId) => {
          const response = await fetch(`/api/training/presets/${presetId}`, {
            method: "DELETE",
          });
          const payload = await response.json().catch(() => null);
          return { payload, presetId, response };
        }),
      );

      const completedIds = responses
        .filter(({ payload, response }) => response.ok && payload?.ok)
        .map(({ presetId }) => presetId);
      if (completedIds.length > 0) {
        applyLocalPresetDelete(completedIds);
      }

      const failedResponse = responses.find(({ payload, response }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "训练预制删除失败",
          detail: failedResponse.payload?.error?.message ?? "训练预制删除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: `${completedIds.length} 项`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练预制删除失败",
        detail: error instanceof Error ? error.message : "训练预制删除请求失败",
      });
    } finally {
      setIsDeletingPresets(false);
    }
  }

  function handleReorderPresets(nextVisiblePresetIds: string[]) {
    const visiblePresetIdSet = new Set(visiblePresetIds);
    const reorderedVisiblePresetIds = [...nextVisiblePresetIds];
    const previousIds = orderedPresetIds;
    const nextOrderedPresetIds = orderedPresetIds.map((presetId) =>
      visiblePresetIdSet.has(presetId) ? reorderedVisiblePresetIds.shift() ?? presetId : presetId,
    );
    setOrderedPresetIds(nextOrderedPresetIds);

    if (!isProductionTrainingRoute) return;

    void persistPresetLibrarySortRules({
      categoryOrder: orderedPresetCategories,
      onError: () => setOrderedPresetIds(previousIds),
      presetOrder: nextOrderedPresetIds,
    });
  }

  function handleReorderPresetCategories(nextCategoryOrder: string[]) {
    const previousCategories = orderedPresetCategories;
    setOrderedPresetCategories(nextCategoryOrder);

    if (!isProductionTrainingRoute) return;

    void persistPresetLibrarySortRules({
      categoryOrder: nextCategoryOrder,
      onError: () => setOrderedPresetCategories(previousCategories),
      presetOrder: orderedPresetIds,
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练预制"
        subtitle="管理可复用的训练场景描述，导入小节时只带入场景文本。"
      />
      <div className={s.resourceLayout}>
        <aside className={s.resourceRail}>
          <strong>分类</strong>
          <SortableList items={orderedPresetCategories} onReorder={handleReorderPresetCategories}>
            {orderedPresetCategories.map((category) => (
              <TrainingPresetCategoryRailItem
                active={activeCategory === category}
                category={category}
                count={training.presets.filter((preset) => preset.category === category && !hiddenPresetIds.has(preset.id)).length}
                key={category}
                onSelect={() => {
                  setActiveCategory(category);
                  setCurrentFolder(null);
                  setSelectedIds(new Set());
                }}
              />
            ))}
          </SortableList>
        </aside>
        <section className={s.resourceWorkspace}>
          <header className={s.trainingPresetWorkspaceHeader}>
            <div>
              <strong>{activeCategory || "训练预制"}</strong>
            <span>{categoryPresets.length} 个场景描述 · 当前文件夹 {currentFolder ?? "全部"}</span>
          </div>
            <ButtonLink href={newPresetInCategoryHref} size="sm" icon={Plus} ariaLabel={`新建训练预制到分类：${activeCategoryLabel}`}>
              新建到当前分类
            </ButtonLink>
          </header>
          <div className={s.trainingPresetContextBar}>
            <FolderBreadcrumb
              items={currentFolder ? [{ id: currentFolder, label: currentFolder }] : []}
              onNavigate={setCurrentFolder}
              rootLabel={activeCategory || "分类"}
              size="sm"
            />
            <span>{visiblePresets.length} 个可见预制</span>
          </div>
          {selectedCount > 0 ? (
                <SelectionBatchBar
                  className={s.trainingPresetBatchBar}
                  selectedCount={selectedCount}
                  subject="个训练预制"
                  onClear={() => setSelectedIds(new Set())}
                  actions={(
                    <Button size="sm" tone="danger" icon={Trash2} pending={isDeletingPresets} onClick={hideSelectedPresets} feedback={{ tone: "warning", title: "训练预制已从列表移除", detail: `${selectedCount} 项` }}>
                      删除所选
                    </Button>
                  )}
                />
          ) : null}
          <div className={s.trainingPresetLibrarySurface}>
            {!currentFolder && folders.length > 0 ? (
              <div className={s.trainingPresetFolderGrid}>
                {folders.map((folder) => (
                  <FolderRow
                    key={folder}
                    name={folder}
                    countLabel={`${categoryPresets.filter((preset) => preset.folder === folder).length} 个预制`}
                    onOpen={() => {
                      setCurrentFolder(folder);
                      setSelectedIds(new Set());
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div className={s.trainingPresetItemList}>
              <SortableList items={visiblePresetIds} onReorder={handleReorderPresets}>
                {visiblePresets.map((preset, index) => (
                  <TrainingPresetLibraryItemRow
                    index={index}
                    key={preset.id}
                    onDelete={() => hidePreset(preset.id)}
                    onToggleSelected={(checked) => togglePresetSelection(preset.id, checked)}
                    preset={preset}
                    selected={selectedIds.has(preset.id)}
                  />
                ))}
              </SortableList>
            </div>
            {visiblePresets.length === 0 ? <div className={s.emptyInline}>当前分类或文件夹没有训练预制</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function LoraTrainingPresetDetailPage({ data, mode = "edit", presetId }: { data: TrainingAppData; mode?: "new" | "edit"; presetId?: string }) {
  const urlSearch = useResourceUrlSearch();
  const newPresetHints = mode === "new" ? readNewPresetHints(urlSearch) : { artifact: "", category: "", folder: "", project: "", sourceRun: "" };
  const preset = mode === "new" ? createDraftTrainingPreset(newPresetHints) : findPreset(data, presetId);
  if (!preset) return <EmptyPage title="没有训练预制数据" />;
  return <LoraTrainingPresetDetailContent isNew={mode === "new"} newPresetHints={newPresetHints} preset={preset} />;
}

function LoraTrainingPresetDetailContent({
  isNew,
  newPresetHints,
  preset,
}: {
  isNew: boolean;
  newPresetHints: NewPresetHints;
  preset: LoraTrainingPreset;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { pushToast } = useDemoFeedback();
  const usages = [...preset.projectUsage, ...preset.templateUsage];
  const presetFormContextId = [
    isNew ? "new" : preset.id,
    isNew ? newPresetHints.sourceRun : "",
    isNew ? newPresetHints.artifact : "",
    isNew ? newPresetHints.category : preset.category,
    isNew ? newPresetHints.folder : preset.folder,
  ].join(":");
  const initialPresetForm = {
    category: preset.category,
    folder: preset.folder,
    sceneDescriptionText: preset.sceneDescriptionText,
    title: preset.title,
  };
  const [presetFormState, setPresetFormState] = useState(() => ({
    contextId: presetFormContextId,
    form: initialPresetForm,
  }));
  const [presetDraftState, setPresetDraftState] = useState<{
    contextId: string;
    draft: typeof initialPresetForm & { usageCount: number } | null;
  }>(() => ({
    contextId: presetFormContextId,
    draft: null,
  }));
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isDeletingPreset, setIsDeletingPreset] = useState(false);
  const presetForm = presetFormState.contextId === presetFormContextId ? presetFormState.form : initialPresetForm;
  const presetDraft = presetDraftState.contextId === presetFormContextId ? presetDraftState.draft : null;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function setPresetForm(updater: (current: typeof initialPresetForm) => typeof initialPresetForm) {
    setPresetFormState((current) => ({
      contextId: presetFormContextId,
      form: updater(current.contextId === presetFormContextId ? current.form : initialPresetForm),
    }));
  }

  function setPresetDraft(draft: typeof initialPresetForm & { usageCount: number }) {
    setPresetDraftState({
      contextId: presetFormContextId,
      draft,
    });
  }

  function handleUpdatePresetForm(field: keyof typeof presetForm, value: string) {
    setPresetForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSavePreset() {
    const nextDraft = {
      ...presetForm,
      usageCount: usages.length,
    };

    if (!isProductionTrainingRoute) {
      setPresetDraft(nextDraft);
      pushToast({
        tone: "success",
        title: presetDraft ? "预制保存草稿已更新" : "预制保存草稿已记录",
        detail: presetForm.title,
      });
      return;
    }

    if (isSavingPreset) return;

    setIsSavingPreset(true);
    try {
      const response = await fetch(isNew ? "/api/training/presets" : `/api/training/presets/${preset.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: presetForm.title,
          category: presetForm.category,
          folder: presetForm.folder,
          sceneDescriptionText: presetForm.sceneDescriptionText,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok || !payload?.data?.id) {
        pushToast({
          tone: "error",
          title: isNew ? "训练预制创建失败" : "训练预制保存失败",
          detail: payload?.error?.message ?? "训练预制保存请求失败",
        });
        return;
      }

      setPresetDraft(nextDraft);
      pushToast({
        tone: "success",
        title: isNew ? "训练预制已创建" : "训练预制已保存",
        detail: presetForm.title,
      });
      router.push(`/training/presets/${payload.data.id}`);
    } catch (error) {
      pushToast({
        tone: "error",
        title: isNew ? "训练预制创建失败" : "训练预制保存失败",
        detail: error instanceof Error ? error.message : "训练预制保存请求失败",
      });
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleDeletePreset() {
    if (isNew) return;

    if (!isProductionTrainingRoute) {
      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: preset.title,
      });
      router.push("/training/presets");
      return;
    }

    if (isDeletingPreset) return;

    setIsDeletingPreset(true);
    try {
      const response = await fetch(`/api/training/scene-description/presets/${preset.id}/cascade`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          confirm: true,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "训练预制删除失败",
          detail: payload?.error?.message ?? "训练预制删除请求失败",
        });
        return;
      }

      pushToast({
        tone: "warning",
        title: "训练预制已从列表移除",
        detail: preset.title,
      });
      router.push("/training/presets");
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练预制删除失败",
        detail: error instanceof Error ? error.message : "训练预制删除请求失败",
      });
    } finally {
      setIsDeletingPreset(false);
    }
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title={isNew ? "新建训练预制" : presetForm.title}
        subtitle={isNew ? `${presetForm.category} / ${presetForm.folder} · 本地草稿` : `${presetForm.category} / ${presetForm.folder} · 更新 ${preset.updatedAt}`}
        actions={(
          <>
            {!isNew ? (
              <Button
                tone="danger"
                icon={Trash2}
                pending={isDeletingPreset}
                onClick={handleDeletePreset}
              >
                删除
              </Button>
            ) : null}
            <Button
              tone="primary"
              icon={Save}
              pending={isSavingPreset}
              onClick={handleSavePreset}
            >
              {presetDraft ? "更新草稿" : isNew ? "创建预制" : "保存"}
            </Button>
          </>
        )}
      />
      <WorkbenchSurface className={s.trainingPresetEditorSurface}>
        <EditorBlock
          actions={isNew ? <StatusBadge status="queued" label="草稿" /> : presetStatus(preset)}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetFormGrid}
          description="训练预制只维护一段可复用场景描述。"
          headerClassName={s.trainingPresetEditorHeader}
          title="预制内容"
        >
          <Field label="名称" value={presetForm.title} onChange={(value) => handleUpdatePresetForm("title", value)} />
          <FloatingSelect label="分类" value={presetForm.category} options={[preset.category, "光线", "环境", "构图"]} onChange={(value) => handleUpdatePresetForm("category", value)} />
          <FloatingSelect label="文件夹" value={presetForm.folder} options={[preset.folder, "舞台", "城市", "训练净图"]} onChange={(value) => handleUpdatePresetForm("folder", value)} />
          {isNew && newPresetHints.artifact ? (
            <Field readOnly label="来源训练产物" value={`${newPresetHints.project || "训练项目"} · ${newPresetHints.artifact}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="场景描述" value={presetForm.sceneDescriptionText} onChange={(value) => handleUpdatePresetForm("sceneDescriptionText", value)} />
        </EditorBlock>
        <EditorBlock
          actions={<StatusBadge status={usages.length ? "pending" : "ready"} label={`${usages.length} 处引用`} />}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetUsageList}
          description="删除前展示项目侧和模板侧引用，确认后只移除当前预制关联。"
          headerClassName={s.trainingPresetEditorHeader}
          title="引用影响"
        >
          {usages.map((usage) => (
            <UnitRowShell
              className={s.trainingPresetUsageRow}
              description="引用当前场景块"
              key={usage}
              meta={<StatusBadge status="template" label={usage.startsWith("模板") ? "模板" : "项目"} />}
              title={usage}
            />
          ))}
          {usages.length === 0 ? <div className={s.emptyInline}>没有引用</div> : null}
          <OperationStateStrip
            items={[
              { label: "保存", value: isNew ? "待创建" : "本地草稿", tone: isNew ? "warning" : "info" },
              { label: "删除影响", value: `${usages.length} 处`, tone: usages.length ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
        {presetDraft ? (
          <EditorBlock
            actions={<StatusBadge status="ready" label={isNew ? "待创建" : "本地草稿"} />}
            className={s.trainingPresetEditorBlock}
            description="页面内记录当前场景描述草稿，可继续调整分类、文件夹和引用影响。"
            headerClassName={s.trainingPresetEditorHeader}
            title="预制保存草稿"
          >
            <dl className={s.trainingPresetDraft}>
              <div><dt>名称</dt><dd>{presetDraft.title}</dd></div>
              <div><dt>分类</dt><dd>{presetDraft.category}</dd></div>
              <div><dt>文件夹</dt><dd>{presetDraft.folder}</dd></div>
              <div><dt>引用影响</dt><dd>{presetDraft.usageCount} 处</dd></div>
              <div className={s.trainingPresetDraftWide}><dt>场景描述</dt><dd>{presetDraft.sceneDescriptionText}</dd></div>
            </dl>
          </EditorBlock>
        ) : null}
      </WorkbenchSurface>
    </div>
  );
}

export function LoraTrainingPresetSortRulesPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const categories = [...new Set(training.presets.map((preset) => preset.category))];
  const categoryItems = categories.map((category) => ({
    id: category,
    title: category,
    meta: `${training.presets.filter((preset) => preset.category === category).length} 个预制`,
  }));
  const presetItems = training.presets.map((preset) => ({
    id: preset.id,
    title: preset.title,
    meta: `${preset.category} / ${preset.folder}`,
  }));
  const [orderedCategoryIds, setOrderedCategoryIds] = useState(() => categoryItems.map((item) => item.id));
  const [orderedPresetIds, setOrderedPresetIds] = useState(() => presetItems.map((item) => item.id));
  const [sortRulesDraft, setSortRulesDraft] = useState<{
    categoryCount: number;
    firstCategory: string;
    firstPreset: string;
    presetCount: number;
    scope: string;
  } | null>(null);
  const [isSavingSortRules, setIsSavingSortRules] = useState(false);
  const orderedCategoryItems = orderTrainingPresetSortItems(categoryItems, orderedCategoryIds);
  const orderedPresetItems = orderTrainingPresetSortItems(presetItems, orderedPresetIds);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function buildSortRulesDraft(scope: string) {
    return {
      categoryCount: orderedCategoryIds.length,
      firstCategory: orderedCategoryItems[0]?.title ?? "无",
      firstPreset: orderedPresetItems[0]?.title ?? "无",
      presetCount: orderedPresetIds.length,
      scope,
    };
  }

  async function persistTrainingPresetSortRules(scope: string) {
    const nextDraft = buildSortRulesDraft(scope);

    if (!isProductionTrainingRoute) {
      setSortRulesDraft(nextDraft);
      pushToast({
        tone: "success",
        title: sortRulesDraft ? "排序保存草稿已更新" : "排序保存草稿已记录",
        detail: scope,
      });
      return;
    }

    if (isSavingSortRules) return;

    setIsSavingSortRules(true);
    try {
      const response = await fetch("/api/training/presets/sort-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          categoryOrder: orderedCategoryIds,
          presetOrder: orderedPresetIds,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        pushToast({
          tone: "error",
          title: "排序保存失败",
          detail: payload?.error?.message ?? "训练预制排序保存请求失败",
        });
        return;
      }

      setSortRulesDraft(nextDraft);
      pushToast({
        tone: "success",
        title: "训练预制排序已保存",
        detail: scope,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "排序保存失败",
        detail: error instanceof Error ? error.message : "训练预制排序保存请求失败",
      });
    } finally {
      setIsSavingSortRules(false);
    }
  }

  async function handleSaveSortRules() {
    await persistTrainingPresetSortRules("全部排序");
  }

  async function handleSaveSortGroup(scope: string, ids: string[], items: TrainingPresetSortItem[]) {
    const orderedItems = orderTrainingPresetSortItems(items, ids);
    const nextDraft = {
      categoryCount: scope === "合成顺序" ? ids.length : orderedCategoryIds.length,
      firstCategory: scope === "合成顺序" ? orderedItems[0]?.title ?? "无" : orderedCategoryItems[0]?.title ?? "无",
      firstPreset: scope === "分类内顺序" ? orderedItems[0]?.title ?? "无" : orderedPresetItems[0]?.title ?? "无",
      presetCount: scope === "分类内顺序" ? ids.length : orderedPresetIds.length,
      scope,
    };

    if (!isProductionTrainingRoute) {
      setSortRulesDraft(nextDraft);
      pushToast({
        tone: "success",
        title: sortRulesDraft ? "排序保存草稿已更新" : "排序保存草稿已记录",
        detail: scope,
      });
      return;
    }

    await persistTrainingPresetSortRules(scope);
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title="排序规则"
        subtitle="管理合成顺序和分类内顺序，保证导入小节时顺序稳定。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            pending={isSavingSortRules}
            onClick={handleSaveSortRules}
          >
            {sortRulesDraft ? "更新排序草稿" : "保存全部"}
          </Button>
        )}
      />
      <div className={s.trainingPresetSortGrid}>
        <TrainingPresetSortPanel
          title="合成顺序"
          subtitle="决定训练小节导入预制块时的分类顺序。"
          items={categoryItems}
          orderedIds={orderedCategoryIds}
          onReorder={setOrderedCategoryIds}
          onSave={handleSaveSortGroup}
        />
        <TrainingPresetSortPanel
          title="分类内顺序"
          subtitle="决定同分类下训练场景描述的稳定排序。"
          items={presetItems}
          orderedIds={orderedPresetIds}
          onReorder={setOrderedPresetIds}
          onSave={handleSaveSortGroup}
        />
      </div>
      {sortRulesDraft ? (
        <EditorBlock
          actions={<StatusBadge status="ready" label={sortRulesDraft.scope} />}
          className={s.trainingPresetSortPanel}
          description="页面内记录当前排序结果，可继续调整合成顺序和分类内顺序。"
          headerClassName={s.trainingPresetSortHeader}
          title="排序保存草稿"
        >
          <dl className={s.trainingPresetSortDraft}>
            <div><dt>范围</dt><dd>{sortRulesDraft.scope}</dd></div>
            <div><dt>合成顺序</dt><dd>{sortRulesDraft.categoryCount} 项 · {sortRulesDraft.firstCategory}</dd></div>
            <div><dt>分类内顺序</dt><dd>{sortRulesDraft.presetCount} 项 · {sortRulesDraft.firstPreset}</dd></div>
          </dl>
        </EditorBlock>
      ) : null}
    </div>
  );
}

export function LoraTrainingTemplatesPage({ data }: { data: TrainingAppData }) {
  const pathname = usePathname();
  const { pushToast } = useDemoFeedback();
  const training = buildLoraTrainingData(data);
  const listRef = useRef<HTMLDivElement>(null);
  const [fromTemplateId] = useState(readAndClearTrainingTemplateListAnchor);
  const [orderedTemplateIds, setOrderedTemplateIds] = useState(() => training.templates.reduce<string[]>((ids, template) => [...ids, template.id], []));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(() => new Set());
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<string>>(() => new Set());
  const [isDeletingTemplates, setIsDeletingTemplates] = useState(false);
  const orderedTemplates = orderTrainingTemplatesByIds(training.templates, orderedTemplateIds);
  const visibleTemplates = orderedTemplates.filter((template) => !hiddenTemplateIds.has(template.id));
  const visibleTemplateIds = visibleTemplates.map((template) => template.id);
  const selectedVisibleTemplates = visibleTemplates.filter((template) => selectedTemplateIds.has(template.id));
  const selectedVisibleCount = selectedVisibleTemplates.length;
  const allVisibleSelected = visibleTemplates.length > 0 && selectedVisibleCount === visibleTemplates.length;
  const projectTemplateSource = selectedVisibleTemplates.length === 1 ? selectedVisibleTemplates[0] : null;
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  useLayoutEffect(() => {
    if (!fromTemplateId) return;
    const target = listRef.current?.querySelector(`[data-training-template-id="${fromTemplateId}"]`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [fromTemplateId]);

  async function hideTemplate(templateId: string) {
    const applyLocalDelete = (ids: Iterable<string>) => {
      const removed = new Set(ids);
      setHiddenTemplateIds((current) => new Set([...current, ...removed]));
      setSelectedTemplateIds((current) => new Set([...current].filter((id) => !removed.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalDelete([templateId]);
      return;
    }

    if (isDeletingTemplates) return;

    setIsDeletingTemplates(true);
    try {
      const response = await fetch(`/api/training/templates/${templateId}`, {
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
      applyLocalDelete([templateId]);
      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: templateId,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练模板删除失败",
        detail: error instanceof Error ? error.message : "训练模板删除请求失败",
      });
    } finally {
      setIsDeletingTemplates(false);
    }
  }

  function toggleTemplateSelection(templateId: string) {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  function toggleVisibleTemplates() {
    setSelectedTemplateIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleTemplates.forEach((template) => next.delete(template.id));
        return next;
      }
      return new Set([...current, ...visibleTemplateIds]);
    });
  }

  async function handleRemoveSelectedTemplates() {
    const selectedVisibleIds = new Set(visibleTemplates.filter((template) => selectedTemplateIds.has(template.id)).map((template) => template.id));

    const applyLocalDelete = (ids: Iterable<string>) => {
      const removed = new Set(ids);
      setHiddenTemplateIds((current) => new Set([...current, ...removed]));
      setSelectedTemplateIds((current) => new Set([...current].filter((id) => !removed.has(id))));
    };

    if (!isProductionTrainingRoute) {
      applyLocalDelete(selectedVisibleIds);
      return;
    }

    if (isDeletingTemplates || selectedVisibleIds.size === 0) return;

    setIsDeletingTemplates(true);
    try {
      const responses = await Promise.all(
        [...selectedVisibleIds].map(async (templateId) => {
          const response = await fetch(`/api/training/templates/${templateId}`, {
            method: "DELETE",
          });
          const payload = await response.json().catch(() => null);
          return { templateId, response, payload };
        }),
      );
      const completedIds = new Set(
        responses
          .filter(({ response, payload }) => response.ok && payload?.ok)
          .map(({ templateId }) => templateId),
      );
      if (completedIds.size > 0) {
        applyLocalDelete(completedIds);
      }
      const failedResponse = responses.find(({ response, payload }) => !response.ok || !payload?.ok);
      if (failedResponse) {
        pushToast({
          tone: "error",
          title: "训练模板删除失败",
          detail: failedResponse.payload?.error?.message ?? "训练模板删除请求失败",
        });
        return;
      }
      pushToast({
        tone: "warning",
        title: "训练模板已移除",
        detail: `${completedIds.size} 个训练模板`,
      });
    } catch (error) {
      pushToast({
        tone: "error",
        title: "训练模板删除失败",
        detail: error instanceof Error ? error.message : "训练模板删除请求失败",
      });
    } finally {
      setIsDeletingTemplates(false);
    }
  }

  function handleReorderTemplates(nextVisibleIds: string[]) {
    const visibleTemplateIdSet = new Set(visibleTemplateIds);
    const reorderedVisibleIds = [...nextVisibleIds];
    const previousIds = orderedTemplateIds;
    const nextOrderedIds = orderedTemplateIds.map((templateId) =>
      visibleTemplateIdSet.has(templateId) ? reorderedVisibleIds.shift() ?? templateId : templateId,
    );
    setOrderedTemplateIds(nextOrderedIds);

    if (!isProductionTrainingRoute) return;

    void (async () => {
      try {
        const response = await fetch("/api/training/templates/reorder", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            orderedTemplateIds: nextOrderedIds,
          }),
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          setOrderedTemplateIds(previousIds);
          pushToast({
            tone: "error",
            title: "训练模板排序保存失败",
            detail: payload?.error?.message ?? "训练模板排序保存请求失败",
          });
        }
      } catch (error) {
        setOrderedTemplateIds(previousIds);
        pushToast({
          tone: "error",
          title: "训练模板排序保存失败",
          detail: error instanceof Error ? error.message : "训练模板排序保存请求失败",
        });
      }
    })();
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练模板"
        subtitle="模板提供创建训练项目时的初始小节结构；项目创建后会独立编辑。"
        actions={projectTemplateSource ? (
          <ButtonLink
            href={createProjectFromTemplateHref(projectTemplateSource)}
            icon={CopyPlus}
            ariaLabel={`从训练模板创建项目：${projectTemplateSource.title}`}
          >
            从模板创建项目
          </ButtonLink>
        ) : undefined}
      />
      <div className={s.trainingTemplateListToolbar}>
        <div>
          <strong>模板列表</strong>
          <span>{visibleTemplates.length} 个模板{selectedVisibleCount ? ` · 已选 ${selectedVisibleCount}` : ""}</span>
        </div>
        <Button icon={CheckSquare} onClick={toggleVisibleTemplates} disabled={visibleTemplates.length === 0}>
          {allVisibleSelected ? "取消全选" : "全选"}
        </Button>
      </div>
      {selectedVisibleCount > 0 ? (
        <SelectionBatchBar
          className={s.trainingTemplateBatchBar}
          selectedCount={selectedVisibleCount}
          subject="个训练模板"
          onClear={() => setSelectedTemplateIds(new Set())}
          actions={(
            <Button tone="danger" icon={Trash2} onClick={handleRemoveSelectedTemplates} feedback={{ tone: "warning", title: "训练模板已从列表移除", detail: `${selectedVisibleCount} 个训练模板` }}>
              删除所选
            </Button>
          )}
        />
      ) : null}
      <div className={s.trainingTemplateListSurface}>
        <div className={s.trainingTemplateList} ref={listRef}>
          <SortableList items={visibleTemplateIds} onReorder={handleReorderTemplates}>
            {visibleTemplates.map((template) => (
              <TrainingTemplateListItem
                createProjectHref={createProjectFromTemplateHref(template)}
                key={template.id}
                onDelete={() => hideTemplate(template.id)}
                onToggleSelected={() => toggleTemplateSelection(template.id)}
                selected={selectedTemplateIds.has(template.id)}
                template={template}
              />
            ))}
          </SortableList>
          {visibleTemplates.length === 0 ? (
            <div className={s.emptyInline}>
              <strong>暂无训练模板</strong>
              <span>当前本地视图里的模板都已移除，可通过新建模板重新开始。</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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

"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { SortableList } from "@/components/design-demo-ui/primitives/sortable";
import { FolderBreadcrumb, FolderRow, SelectionBatchBar } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import {
  isProductionTrainingPath,
  orderTrainingPresetsByIds,
  uniquePresetCategories,
  uniquePresetFolders,
} from "./training-resource-page-utils";
import { TrainingPresetCategoryRailItem, TrainingPresetLibraryItemRow } from "./training-preset-library-primitives";
import s from "./training-resource-pages.module.css";

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
  const orderedPresets = orderTrainingPresetsByIds(training.presets, orderedPresetIds);
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

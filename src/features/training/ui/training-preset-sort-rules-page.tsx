"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";

import { useDemoFeedback } from "@/components/design-demo-ui/feedback/context";
import { Button } from "@/components/design-demo-ui/primitives/button";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { EditorBlock } from "@/components/design-demo-ui/patterns";
import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import { isProductionTrainingPath } from "./training-resource-page-utils";
import {
  TrainingPresetSortPanel,
  buildTrainingPresetSortRulesDraft,
  orderTrainingPresetSortItems,
  type TrainingPresetSortItem,
  type TrainingPresetSortRulesDraft,
} from "./training-preset-sort-panel";
import s from "./training-resource-pages.module.css";

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
  const [sortRulesDraft, setSortRulesDraft] = useState<TrainingPresetSortRulesDraft | null>(null);
  const [isSavingSortRules, setIsSavingSortRules] = useState(false);
  const orderedCategoryItems = orderTrainingPresetSortItems(categoryItems, orderedCategoryIds);
  const orderedPresetItems = orderTrainingPresetSortItems(presetItems, orderedPresetIds);
  const isProductionTrainingRoute = isProductionTrainingPath(pathname);

  function buildSortRulesDraft(scope: string) {
    return buildTrainingPresetSortRulesDraft({
      categoryIds: orderedCategoryIds,
      categoryItems: orderedCategoryItems,
      presetIds: orderedPresetIds,
      presetItems: orderedPresetItems,
      scope,
    });
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
    const nextDraft = buildTrainingPresetSortRulesDraft({
      categoryIds: scope === "合成顺序" ? ids : orderedCategoryIds,
      categoryItems: scope === "合成顺序" ? orderedItems : orderedCategoryItems,
      presetIds: scope === "分类内顺序" ? ids : orderedPresetIds,
      presetItems: scope === "分类内顺序" ? orderedItems : orderedPresetItems,
      scope,
    });

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

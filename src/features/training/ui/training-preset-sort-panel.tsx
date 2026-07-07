"use client";

import { Save } from "lucide-react";

import { Button } from "@/components/design-demo-ui/primitives/button";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { SortableList, useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import { SortableRowShell } from "@/components/design-demo-ui/patterns";
import s from "./training-resource-pages.module.css";

export type TrainingPresetSortItem = { id: string; meta: string; title: string };

export type TrainingPresetSortRulesDraft = {
  categoryCount: number;
  firstCategory: string;
  firstPreset: string;
  presetCount: number;
  scope: string;
};

export function orderTrainingPresetSortItems(items: TrainingPresetSortItem[], orderedIds: string[]) {
  const itemMap = Object.fromEntries(items.map((item) => [item.id, item]));
  const orderedItems = orderedIds.map((id) => itemMap[id]).filter((item): item is TrainingPresetSortItem => Boolean(item));
  const missingItems = items.filter((item) => !orderedIds.includes(item.id));
  return [...orderedItems, ...missingItems];
}

export function buildTrainingPresetSortRulesDraft({
  categoryIds,
  categoryItems,
  presetIds,
  presetItems,
  scope,
}: {
  categoryIds: string[];
  categoryItems: TrainingPresetSortItem[];
  presetIds: string[];
  presetItems: TrainingPresetSortItem[];
  scope: string;
}): TrainingPresetSortRulesDraft {
  return {
    categoryCount: categoryIds.length,
    firstCategory: categoryItems[0]?.title ?? "无",
    firstPreset: presetItems[0]?.title ?? "无",
    presetCount: presetIds.length,
    scope,
  };
}

export function TrainingPresetSortPanel({
  items,
  onReorder,
  onSave,
  orderedIds,
  subtitle,
  title,
}: {
  items: TrainingPresetSortItem[];
  onReorder: (ids: string[]) => void;
  onSave: (scope: string, ids: string[], items: TrainingPresetSortItem[]) => void;
  orderedIds: string[];
  subtitle: string;
  title: string;
}) {
  const orderedItems = orderTrainingPresetSortItems(items, orderedIds);

  return (
    <section className={s.trainingPresetSortPanel}>
      <div className={s.trainingPresetSortHeader}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <StatusBadge status="ready" label="已保存" />
      </div>
      <div className={s.trainingPresetSortList}>
        <SortableList items={orderedItems.map((item) => item.id)} onReorder={onReorder}>
          {orderedItems.map((item, index) => (
            <TrainingPresetSortableSortRow item={item} index={index} key={item.id} />
          ))}
        </SortableList>
      </div>
      <div className={s.trainingPresetSortFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} ariaLabel={`保存排序组：${title}`} onClick={() => onSave(title, orderedIds, items)}>保存此组</Button>
      </div>
    </section>
  );
}

function TrainingPresetSortableSortRow({ index, item }: { index: number; item: TrainingPresetSortItem }) {
  const { ref, style, handleProps } = useDemoSortable(item.id);
  return (
    <div ref={ref} style={style}>
      <SortableRowShell
        className={s.trainingPresetSortRow}
        contentClassName={s.trainingPresetSortRowContent}
        handleClassName={s.grip}
        handleProps={handleProps}
        index={index}
        indexClassName={s.trainingPresetSortIndex}
      >
        <div className={s.trainingPresetSortRowText}>
          <strong>{item.title}</strong>
          <em>{item.meta}</em>
        </div>
      </SortableRowShell>
    </div>
  );
}

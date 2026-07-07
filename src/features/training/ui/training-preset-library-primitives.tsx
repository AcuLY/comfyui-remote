"use client";

import Link from "next/link";
import { Edit3, GripVertical, Trash2 } from "lucide-react";

import { useRouteHref } from "@/components/design-demo-routing";
import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { Button, ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";
import { UnitRowShell } from "@/components/design-demo-ui/patterns";
import type { LoraTrainingPreset } from "@/features/training/types";
import s from "./training-resource-pages.module.css";

export function presetStatus(preset: LoraTrainingPreset) {
  return preset.status === "active" ? <StatusBadge status="ready" label="启用" /> : <StatusBadge status="archived" label="停用" />;
}

export function presetUsageLabel(preset: LoraTrainingPreset) {
  const usageCount = preset.projectUsage.length + preset.templateUsage.length;
  return usageCount > 0 ? `${usageCount} 处引用` : "未引用";
}

export function TrainingPresetLibraryItemRow({
  index,
  onDelete,
  onToggleSelected,
  preset,
  selected,
}: {
  index: number;
  onDelete: () => void;
  onToggleSelected: (checked: boolean) => void;
  preset: LoraTrainingPreset;
  selected: boolean;
}) {
  const hrefForRoute = useRouteHref();
  const { ref, style, handleProps } = useDemoSortable(preset.id);

  return (
    <div ref={ref} style={style}>
      <UnitRowShell
        className={s.trainingPresetItemFrame}
        selected={selected}
        dragHandle={<GripVertical className={s.grip} aria-hidden="true" {...handleProps} />}
        leading={(
          <Checkbox
            checked={selected}
            label={selected ? `取消选择训练预制：${preset.title}` : `选择训练预制：${preset.title}`}
            onCheckedChange={onToggleSelected}
            stopPropagation
            variant="compact"
          />
        )}
        title={<Link className={s.trainingPresetTitleLink} href={hrefForRoute(`/training/presets/${preset.id}`)}>{preset.title}</Link>}
        description={<Link className={s.trainingPresetDescriptionLink} href={hrefForRoute(`/training/presets/${preset.id}`)}>{preset.sceneDescriptionText}</Link>}
        body={(
          <div className={s.trainingPresetUsageChips}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{preset.folder}</span>
            <span>{presetUsageLabel(preset)}</span>
          </div>
        )}
        meta={<div className={s.trainingPresetMeta}>{presetStatus(preset)}<span>更新 {preset.updatedAt}</span></div>}
        actions={(
          <div className={s.trainingPresetActions}>
            <ButtonLink href={`/training/presets/${preset.id}`} size="sm" icon={Edit3} ariaLabel={`编辑训练预制：${preset.title}`}>编辑</ButtonLink>
            <Button size="sm" tone="danger" icon={Trash2} iconOnly ariaLabel={`删除训练预制：${preset.title}`} onClick={onDelete} feedback={{ tone: "warning", title: "训练预制已从列表移除", detail: preset.title }} />
          </div>
        )}
      />
    </div>
  );
}

export function TrainingPresetCategoryRailItem({
  active,
  category,
  count,
  onSelect,
}: {
  active: boolean;
  category: string;
  count: number;
  onSelect: () => void;
}) {
  const { ref, style, handleProps } = useDemoSortable(category);

  return (
    <div ref={ref} style={style}>
      <button
        className={cx(active && s.railItemActive)}
        type="button"
        onClick={onSelect}
      >
        <GripVertical className={s.resourceRailDragHandle} aria-hidden="true" {...handleProps} />
        <span>{category}</span>
        <em>{count}</em>
      </button>
    </div>
  );
}

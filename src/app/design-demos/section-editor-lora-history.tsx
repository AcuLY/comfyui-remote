"use client";

import type * as React from "react";
import { GripVertical, X, Unlink, Zap } from "lucide-react";

import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import s from "./design-demo-styles";
import { cx } from "./design-demo-utils";
import { parseHue } from "./section-editor-shared";
import { SelectChip, StepperInput } from "./section-editor-controls";
export type LoraRowData = {
  id: string;
  /** Bound preset display name; undefined for manual */
  presetName?: string;
  variantName?: string;
  categoryName?: string;
  categoryColor?: string | null;
  fileName: string;
  filePath: string;
  notes?: string;
  weight: number;
  enabled: boolean;
  triggerWords?: string;
  kind: "preset" | "manual";
};

export function LoraRow({
  entry,
  fileOptions,
  onWeightChange,
  onToggle,
  onPathChange,
  onUnlink,
  onDelete,
}: {
  entry: LoraRowData;
  fileOptions: string[];
  onWeightChange: (w: number) => void;
  onToggle: () => void;
  onPathChange: (path: string) => void;
  onUnlink?: () => void;
  onDelete: () => void;
}) {
  const hue = parseHue(entry.categoryColor);
  const color = `hsl(${hue} 70% 60%)`;

  return (
    <div
      className={cx(s.loraRow, s.sectionLoraRow)}
      data-enabled={entry.enabled}
      style={{
        gridTemplateColumns: "22px minmax(0, 1fr) auto",
        gridTemplateAreas: '"grip main actions" "grip weight weight"',
      }}
    >
      <span className={s.loraRowGrip}>
        <Button icon={GripVertical} iconOnly tone="subtle" ariaLabel="拖拽排序" size="sm" />
      </span>
      <div className={s.loraRowMain}>
        <span className={s.loraRowTopLine}>
          {entry.kind === "preset" ? (
            <>
              <span className={s.loraPresetName}>
                {entry.presetName}
                {entry.variantName ? <em> / {entry.variantName}</em> : null}
              </span>
              <span
                className={s.loraSourceBadge}
                style={{ "--cat": color } as React.CSSProperties}
              >
                {entry.categoryName}
              </span>
            </>
          ) : (
            <span className={s.loraManualBadge}>自定义</span>
          )}
          {entry.triggerWords ? (
            <span className={s.loraTrigger} title={entry.triggerWords}>
              <Zap className="size-3" />
              触发词
            </span>
          ) : null}
        </span>
        <SelectChip
          value={entry.filePath || entry.fileName}
          options={fileOptions}
          onChange={onPathChange}
        />
        {entry.notes ? <span className={s.loraNotes}>{entry.notes}</span> : null}
      </div>
      <div className={s.loraWeight}>
        <StepperInput
          value={entry.weight}
          onChange={onWeightChange}
          min={-2}
          max={2}
          step={0.05}
          width={112}
        />
      </div>
      <div className={s.loraActions}>
        <Switch checked={entry.enabled} onCheckedChange={onToggle} ariaLabel={entry.enabled ? "停用" : "启用"} size="sm" />
        {entry.kind === "preset" && onUnlink ? (
          <Button icon={Unlink} iconOnly onClick={onUnlink} ariaLabel="单独删除（仅本条）" tone="subtle" size="sm" />
        ) : null}
        <Button
          icon={X}
          iconOnly
          onClick={onDelete}
          ariaLabel="删除"
          tone="danger"
          size="sm"
        />
      </div>
    </div>
  );
}

// ============================================================================
// History diff row
// ============================================================================

export type HistoryDimensionKey = "all" | "params" | "preset" | "prompt" | "lora";

export type HistoryDiffChange = {
  id: string;
  timestamp: string;
  dimension: string;
  title: string;
  before: string | null;
  after: string | null;
  diff?: Array<{ field: string; before: string; after: string }>;
};

const DIM_LABEL: Record<string, string> = {
  params: "参数",
  preset: "预制",
  prompt: "提示词",
  lora: "LoRA",
};

export function dimensionLabel(d: string): string {
  return DIM_LABEL[d] ?? d;
}

export function HistoryDiffRow({ change }: { change: HistoryDiffChange }) {
  const diffs = change.diff ?? [];
  return (
    <div className={s.diffRow}>
      <span className={s.diffDim} data-dim={change.dimension}>
        {dimensionLabel(change.dimension)}
      </span>
      <div className={s.diffMain}>
        <div className={s.diffTitle}>{change.title}</div>
        {diffs.length === 0 ? (
          <div className={s.diffEmpty}>—</div>
        ) : (
          diffs.map((d, i) => (
            <div key={i} className={s.diffLine}>
              <span className={s.diffField}>{d.field}</span>
              <span className={cx(s.diffPill, s.diffBefore)}>{d.before || "—"}</span>
              <span className={s.diffArrow}>→</span>
              <span className={cx(s.diffPill, s.diffAfter)}>{d.after || "—"}</span>
            </div>
          ))
        )}
      </div>
      <span className={s.diffTime}>{change.timestamp}</span>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

"use client";

import type * as React from "react";
import { GripVertical, X, Unlink, Zap } from "lucide-react";

import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import s from "./styles/section-editor.module.css";
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
  const fileValue = entry.filePath || entry.fileName;
  const fileSelectOptions = Array.from(new Set([fileValue, ...fileOptions]));
  const displayName = entry.presetName ?? entry.fileName;

  return (
    <div className={s.loraEditorRow} data-enabled={entry.enabled}>
      <div className={s.loraEditorHandle}>
        <Button
          icon={GripVertical}
          iconOnly
          tone="subtle"
          ariaLabel={`拖拽排序 ${displayName}`}
          size="sm"
        />
      </div>
      <div className={s.loraEditorMain}>
        <div className={s.loraEditorMeta}>
          {entry.kind === "preset" ? (
            <>
              <span className={s.loraEditorTitle} title={displayName}>
                {displayName}
                {entry.variantName ? <em> / {entry.variantName}</em> : null}
              </span>
              <span
                className={s.loraEditorCategory}
                style={{ "--cat": color } as React.CSSProperties}
              >
                {entry.categoryName ?? "预制"}
              </span>
            </>
          ) : (
            <span className={s.loraEditorKind}>自定义</span>
          )}
          {entry.triggerWords ? (
            <span className={s.loraEditorTrigger} title={entry.triggerWords}>
              <Zap className={s.iconXs} />
              触发词
            </span>
          ) : null}
          {entry.notes ? <span className={s.loraEditorNotes}>{entry.notes}</span> : null}
        </div>
        <div className={s.loraEditorFile}>
          <SelectChip
            ariaLabel={`选择 LoRA 文件：${displayName}`}
            displayValue={entry.fileName}
            value={fileValue}
            options={fileSelectOptions}
            onChange={onPathChange}
          />
        </div>
        <div className={s.loraEditorWeight}>
          <StepperInput
            ariaLabel={`${displayName} 权重`}
            value={entry.weight}
            onChange={onWeightChange}
            min={-2}
            max={2}
            step={0.05}
            width={136}
          />
        </div>
      </div>
      <div className={s.loraEditorActions}>
        <Switch
          checked={entry.enabled}
          onCheckedChange={onToggle}
          ariaLabel={entry.enabled ? `停用 ${displayName}` : `启用 ${displayName}`}
          size="sm"
        />
        {entry.kind === "preset" && onUnlink ? (
          <Button
            icon={Unlink}
            iconOnly
            onClick={onUnlink}
            ariaLabel={`解除预制绑定 ${displayName}`}
            tone="subtle"
            size="sm"
          />
        ) : null}
        <Button
          icon={X}
          iconOnly
          onClick={onDelete}
          ariaLabel={`删除 ${displayName}`}
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

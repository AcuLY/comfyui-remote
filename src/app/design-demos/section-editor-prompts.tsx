"use client";

import type * as React from "react";
import { GripVertical, Trash2, Unlink } from "lucide-react";

import s from "./design-demo.module.css";
import { parseHue } from "./section-editor-shared";
export type PromptBlockRowData = {
  id: string;
  label: string;
  categoryName: string;
  categoryColor: string | null;
  presetName?: string;
  variantName?: string;
  positive: string;
  negative: string;
  /** kind: "preset" → bound, "manual" → custom */
  kind: "preset" | "manual";
};

export function PromptBlockRow({
  block,
  expanded,
  onToggle,
  onLabelChange,
  onPositiveChange,
  onNegativeChange,
  onUnlink,
  onDelete,
}: {
  block: PromptBlockRowData;
  expanded: boolean;
  onToggle: () => void;
  onLabelChange?: (label: string) => void;
  onPositiveChange?: (value: string) => void;
  onNegativeChange?: (value: string) => void;
  onUnlink?: () => void;
  onDelete?: () => void;
}) {
  const hue = parseHue(block.categoryColor);
  const color = `hsl(${hue} 70% 60%)`;

  return (
    <div className={s.pbRow} data-expanded={expanded}>
      <div className={s.pbRowGrip} aria-label="拖拽排序">
        <GripVertical className="size-4" />
      </div>
      <span
        className={s.pbCategory}
        style={{ "--cat": color } as React.CSSProperties}
      >
        {block.categoryName}
      </span>
      <button
        type="button"
        className={s.pbRowMain}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={s.pbRowTitleLine}>
          <strong>{block.label}</strong>
          {block.presetName ? (
            <em>
              ← {block.presetName}
              {block.variantName ? ` / ${block.variantName}` : ""}
            </em>
          ) : (
            <em className={s.pbRowManualMark}>自定义</em>
          )}
        </span>
        <span className={s.pbRowPreview}>
          <span className={s.pbRowPreviewPlus}>+</span>
          <code>{firstLine(block.positive) || "—"}</code>
          {block.negative ? (
            <>
              <span className={s.pbRowPreviewMinus}>−</span>
              <code>{firstLine(block.negative)}</code>
            </>
          ) : null}
        </span>
      </button>
      <div className={s.pbRowActions}>
        {block.kind === "preset" ? (
          <button
            type="button"
            className={s.iconGhostBtn}
            data-tone="warn"
            onClick={onUnlink}
            title="单独删除（仅本块）"
          >
            <Unlink className="size-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          className={s.iconGhostBtn}
          data-tone="danger"
          onClick={onDelete}
          title="级联删除（同预制全部）"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {expanded ? (
        <div className={s.pbInlineBody}>
          <label className={s.pbField}>
            <span>名称</span>
            <input
              type="text"
              value={block.label}
              onChange={(e) => onLabelChange?.(e.target.value)}
              className={s.pbFieldInput}
            />
          </label>
          <label className={s.pbField}>
            <span>正向</span>
            <textarea
              value={block.positive}
              onChange={(e) => onPositiveChange?.(e.target.value)}
              rows={2}
              className={s.pbFieldArea}
            />
          </label>
          <label className={s.pbField}>
            <span>负向</span>
            <textarea
              value={block.negative}
              onChange={(e) => onNegativeChange?.(e.target.value)}
              rows={2}
              className={s.pbFieldArea}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

function firstLine(text: string): string {
  return text.split(/[\n,，]/)[0]?.trim() ?? "";
}

// ============================================================================
// Compiled prompt preview
// ============================================================================

export function CompiledPromptPreview({
  positive,
  negative,
}: {
  positive: Array<{ presetName?: string; variantName?: string; categoryName: string; text: string }>;
  negative: Array<{ presetName?: string; variantName?: string; categoryName: string; text: string }>;
}) {
  const renderLine = (
    items: Array<{ presetName?: string; variantName?: string; categoryName: string; text: string }>,
    sign: "+" | "−",
  ) => {
    if (items.length === 0) return <em className={s.compiledEmpty}>无</em>;
    return items
      .map((part, idx) => (
        <span key={idx} className={s.compiledChunk}>
          <span className={s.compiledTag}>
            [{part.presetName ?? part.categoryName}
            {part.variantName ? ` / ${part.variantName}` : ""}]
          </span>
          <code>{part.text}</code>
        </span>
      ))
      .reduce<React.ReactNode[]>((acc, node, idx) => {
        if (idx > 0) acc.push(<span key={`sep-${idx}`} className={s.compiledSep}>，</span>);
        acc.push(node);
        return acc;
      }, [<span key="sign" className={s.compiledSign}>{sign}</span>]);
  };

  return (
    <div className={s.compiledPanel}>
      <header>
        <h4>合成后的提示词</h4>
        <p>按预制分类与预制顺序拼接，预览供复核。</p>
      </header>
      <pre className={s.compiledLine}>{renderLine(positive, "+")}</pre>
      <pre className={s.compiledLine}>{renderLine(negative, "−")}</pre>
    </div>
  );
}

// ============================================================================
// LoRA row
// ============================================================================

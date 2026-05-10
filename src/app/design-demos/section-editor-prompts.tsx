"use client";

import type * as React from "react";
import { GripVertical, Trash2, Unlink } from "lucide-react";

import { Button } from "./design-demo-ui";
import s from "./design-demo-styles";
import { cx } from "./design-demo-utils";
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
          <Button
            className={s.iconGhostBtn}
            icon={Unlink}
            iconOnly
            onClick={onUnlink}
            ariaLabel="单独删除（仅本块）"
            tone="subtle"
          />
        ) : null}
        <Button
          className={s.iconGhostBtn}
          icon={Trash2}
          iconOnly
          onClick={onDelete}
          ariaLabel="级联删除（同预制全部）"
          tone="danger"
        />
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

export type CompiledPromptGroup = {
  id: string;
  presetName?: string;
  variantName?: string;
  categoryName: string;
  positive: string[];
  negative: string[];
};

export function CompiledPromptPreview({ groups }: { groups: CompiledPromptGroup[] }) {
  const renderLine = (items: string[], sign: "+" | "−") => {
    return [
      <span key="sign" className={s.compiledSign}>
        {sign}
      </span>,
      items.length === 0 ? (
        <em key="empty" className={s.compiledEmpty}>无</em>
      ) : null,
      ...items.map((text, idx) => (
        <span key={idx} className={s.compiledChunk}>
          {idx > 0 ? <span className={s.compiledSep}>，</span> : null}
          <code>{text}</code>
        </span>
      )),
    ];
  };

  return (
    <div className={s.compiledPanel}>
      <header>
        <h4>合成后的提示词</h4>
        <p>按预制分隔，逐项显示正向与负向内容。</p>
      </header>
      <div className={s.compiledGroupList}>
        {groups.length === 0 ? (
          <div className={s.compiledGroupEmpty}>暂无提示词内容</div>
        ) : (
          groups.map((group) => (
            <section className={s.compiledGroup} key={group.id}>
              <div className={s.compiledGroupHead}>
                <span className={s.compiledGroupTitle}>
                  {group.presetName ?? group.categoryName}
                </span>
                {group.variantName ? (
                  <span className={s.compiledGroupVariant}>{group.variantName}</span>
                ) : null}
              </div>
              <pre className={cx(s.compiledLine, s.compiledLinePositive)}>{renderLine(group.positive, "+")}</pre>
              <pre className={cx(s.compiledLine, s.compiledLineNegative)}>{renderLine(group.negative, "−")}</pre>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LoRA row
// ============================================================================

"use client";

import { useState } from "react";
import type * as React from "react";
import { GripVertical, Pencil, Trash2, Unlink } from "lucide-react";

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
  onPositiveChange,
  onNegativeChange,
  onUnlink,
  onDelete,
  column = "positive",
}: {
  block: PromptBlockRowData;
  expanded: boolean;
  onToggle: () => void;
  column?: "positive" | "negative";
  onLabelChange?: (label: string) => void;
  onPositiveChange?: (value: string) => void;
  onNegativeChange?: (value: string) => void;
  onUnlink?: () => void;
  onDelete?: () => void;
}) {
  const hue = parseHue(block.categoryColor);
  const color = `hsl(${hue} 70% 60%)`;
  const text = column === "positive" ? block.positive : block.negative;
  const [draft, setDraft] = useState(text);

  function handleEdit() {
    setDraft(text);
    onToggle();
  }

  function handleBlur() {
    if (column === "positive") {
      onPositiveChange?.(draft);
    } else {
      onNegativeChange?.(draft);
    }
    onToggle();
  }

  return (
    <div className={s.pbRow} data-expanded={expanded}>
      <Button className={s.pbRowGrip} icon={GripVertical} iconOnly tone="subtle" ariaLabel="拖拽排序" />
      <div className={s.pbRowMain}>
        <span className={s.pbRowTitleLine}>
          <strong>{block.label}</strong>
          <span
            className={s.pbCategory}
            style={{ "--cat": color } as React.CSSProperties}
          >
            {block.categoryName}
          </span>
        </span>
        <span className={s.pbRowPreview}>
          <span className={s.pbRowPreviewPlus}>+</span>
          <code>{firstLine(text) || "—"}</code>
        </span>
      </div>
      <div className={s.pbRowActions}>
        {!expanded ? (
          <Button
            className={s.iconGhostBtn}
            icon={Pencil}
            iconOnly
            onClick={handleEdit}
            ariaLabel={column === "positive" ? "编辑正向提示词" : "编辑负向提示词"}
            tone="subtle"
          />
        ) : null}
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
            <span>{column === "positive" ? "正向" : "负向"}</span>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleBlur}
                rows={3}
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

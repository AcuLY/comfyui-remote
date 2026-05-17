"use client";

import { useState } from "react";
import type * as React from "react";
import { ChevronUp, GripVertical, Pencil, Trash2, Unlink } from "lucide-react";

import { Button } from "../../../shared/primitives/button";
import s from "./editor-prompts.module.css";
import { cx } from "../../../routing";
import { parseHue } from "./editor-shared";
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

function getVariantLabel(variantName?: string) {
  if (!variantName || variantName === "默认") return null;
  return variantName;
}

function promptPreview(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : "无";
}

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
  const variantLabel = getVariantLabel(block.variantName);
  const [draft, setDraft] = useState(text);

  function handleEdit() {
    setDraft(text);
    onToggle();
  }

  function commitDraft() {
    if (draft === text) return;
    if (column === "positive") {
      onPositiveChange?.(draft);
    } else {
      onNegativeChange?.(draft);
    }
  }

  return (
    <div className={s.pbRow} data-expanded={expanded}>
      <Button className={s.pbRowGrip} icon={GripVertical} iconOnly tone="subtle" ariaLabel="拖拽排序" />
      <div className={s.pbRowMain}>
        <div className={s.pbRowTitleLine}>
          <strong>{block.label}</strong>
          <span className={s.pbCategory} style={{ "--cat": color } as React.CSSProperties}>
            {block.categoryName}
          </span>
          {variantLabel ? <em>变体：{variantLabel}</em> : null}
        </div>
        {!expanded ? (
          <span className={s.pbRowPreview} data-column={column}>
            <span className={s.pbRowPreviewSign}>{column === "positive" ? "+" : "−"}</span>
            <code>{promptPreview(text)}</code>
          </span>
        ) : null}
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
        {expanded ? (
          <Button
            className={s.iconGhostBtn}
            icon={ChevronUp}
            iconOnly
            onClick={() => {
              commitDraft();
              onToggle();
            }}
            ariaLabel="收起提示词编辑"
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
              onBlur={commitDraft}
              rows={3}
              className={s.pbFieldArea}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
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
    return (
      <>
        <span className={s.compiledSign}>{sign}</span>
        <span className={s.compiledLineBody}>
          {items.length === 0 ? (
            <em className={s.compiledEmpty}>无</em>
          ) : (
            items.map((text, idx) => (
              <span key={idx} className={s.compiledChunk}>
                {idx > 0 ? <span className={s.compiledSep}>，</span> : null}
                <code>{text}</code>
              </span>
            ))
          )}
        </span>
      </>
    );
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
          groups.map((group) => {
            const variantLabel = getVariantLabel(group.variantName);

            return (
              <section className={s.compiledGroup} key={group.id}>
                <div className={s.compiledGroupHead}>
                  <span className={s.compiledGroupTitle}>
                    {group.presetName ?? group.categoryName}
                  </span>
                  {variantLabel ? (
                    <span className={s.compiledVariant}>变体：{variantLabel}</span>
                  ) : null}
                </div>
                <div className={s.compiledLines}>
                  <pre className={cx(s.compiledLine, s.compiledLinePositive)}>
                    {renderLine(group.positive, "+")}
                  </pre>
                  <pre className={cx(s.compiledLine, s.compiledLineNegative)}>
                    {renderLine(group.negative, "−")}
                  </pre>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// LoRA row
// ============================================================================

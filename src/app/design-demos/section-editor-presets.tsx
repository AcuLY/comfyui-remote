"use client";

import { useState } from "react";
import type * as React from "react";
import Link from "next/link";
import { Search, Trash2, Unlink } from "lucide-react";

import { Button } from "./ui/button";
import { SegmentedControl } from "./ui/segmented-control";
import s from "./styles/section-editor.module.css";
import { cx } from "./design-demo-utils";
import { parseHue } from "./section-editor-shared";
import { VariantSwitcher } from "./section-editor-controls";
export type PresetBinding = {
  id: string;
  kind: "preset" | "group";
  scope: "project" | "section";
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  name: string;
  variantId?: string;
  variantName?: string;
  blockCount: number;
  loraCount: number;
  variants?: Array<{ id: string; name: string }>;
  /** member presets for kind=group */
  members?: Array<{
    id: string;
    presetName: string;
    variantId?: string;
    variantName?: string;
    variants?: Array<{ id: string; name: string }>;
    detailHref?: string;
  }>;
  detailHref?: string;
};

type PresetBindingRowProps = {
  binding: PresetBinding;
  onVariantChange?: (bindingId: string, variantId: string, memberId?: string) => void;
  onUnlink?: (binding: PresetBinding, memberId?: string) => void;
  onDelete?: (binding: PresetBinding) => void;
};

export function PresetBindingRow({
  binding,
  onVariantChange,
  onUnlink,
  onDelete,
}: PresetBindingRowProps) {
  const hue = parseHue(binding.categoryColor);
  const color = `hsl(${hue} 70% 60%)`;
  const isFromGroup = binding.kind === "group";

  return (
    <div className={s.bindRow}>
      {binding.detailHref ? (
        <Link className={s.bindRowMain} href={binding.detailHref}>
          <PresetBindingSummary binding={binding} color={color} isFromGroup={isFromGroup} />
        </Link>
      ) : (
        <div className={s.bindRowMain}>
          <PresetBindingSummary binding={binding} color={color} isFromGroup={isFromGroup} />
        </div>
      )}

      <div className={s.bindRowControls}>
        {binding.variants && binding.variants.length > 1 ? (
          <VariantSwitcher
            variants={binding.variants}
            currentVariantId={binding.variantId ?? binding.variants[0]?.id ?? ""}
            onChange={(vid) => onVariantChange?.(binding.id, vid)}
          />
        ) : null}

        <Button
          className={s.iconGhostBtn}
          icon={Unlink}
          iconOnly
          onClick={() => onUnlink?.(binding)}
          ariaLabel="单独解绑"
          tone="subtle"
        />
        <Button
          className={s.iconGhostBtn}
          icon={Trash2}
          iconOnly
          onClick={() => onDelete?.(binding)}
          ariaLabel="级联删除"
          tone="danger"
        />
      </div>

    </div>
  );
}

function PresetBindingSummary({
  binding,
  color,
  isFromGroup,
}: {
  binding: PresetBinding;
  color: string;
  isFromGroup: boolean;
}) {
  return (
    <div className={s.bindNameWrap}>
      <span className={s.bindName}>
        {binding.name}
        <span
          className={s.bindCategory}
          style={{ "--cat": color } as React.CSSProperties}
        >
          {binding.categoryName}
        </span>
        {isFromGroup ? <span className={s.bindGroupChip}>组</span> : null}
      </span>
      <span className={s.bindMeta}>
        <b>{binding.blockCount}</b> 块 · <b>{binding.loraCount}</b> LoRA
        {binding.variantName ? <> · {binding.variantName}</> : null}
      </span>
    </div>
  );
}

// ============================================================================
// Preset Import inline
// ============================================================================

export type ImportCategory = {
  id: string;
  name: string;
  color: string | null;
  presets: Array<{ id: string; name: string; variantCount: number }>;
  groups?: Array<{ id: string; name: string; memberCount: number }>;
};

export type PresetImportSelection = {
  type: "preset" | "group";
  id: string;
  categoryId: string;
};

export function PresetImportInline({
  open,
  categories,
  selected,
  onSelect,
}: {
  open: boolean;
  categories: ImportCategory[];
  selected: PresetImportSelection | null;
  onSelect: (selection: PresetImportSelection | null) => void;
}) {
  return (
    <div className={cx(s.importInline, open && s.importInlineOpen)}>
      {open ? (
        <PresetImportInlineBody
          key={open ? "open" : "closed"}
          categories={categories}
          selected={selected}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}

function PresetImportInlineBody({
  categories,
  selected,
  onSelect,
}: {
  categories: ImportCategory[];
  selected: PresetImportSelection | null;
  onSelect: (selection: PresetImportSelection | null) => void;
}) {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = categories
    .filter((c) => !activeCat || c.id === activeCat)
    .map((c) => {
      const term = q.toLowerCase();
      return {
        ...c,
        presets: c.presets.filter((p) => !term || p.name.toLowerCase().includes(term)),
        groups: (c.groups ?? []).filter((g) => !term || g.name.toLowerCase().includes(term)),
      };
    })
    .filter((c) => c.presets.length || (c.groups && c.groups.length));

  const total = filtered.reduce(
    (sum, c) => sum + c.presets.length + (c.groups?.length ?? 0),
    0,
  );

  return (
    <>
      <div className={s.importHeader}>
        <SegmentedControl
          ariaLabel="筛选预制分类"
          className={s.importTabs}
          compact
          items={[
            { value: "__all", label: "全部" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onChange={(value) => setActiveCat(value === "__all" ? null : value)}
          role="tablist"
          value={activeCat ?? "__all"}
        />
        <div className={s.importSearch}>
          <Search className={s.iconSm} aria-hidden />
          <input
            type="text"
            placeholder="搜索预制 / 预制组…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className={s.importBody}>
        {total === 0 ? (
          <div className={s.importEmpty}>未找到匹配内容</div>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className={s.importCatBlock}>
              <h5 className={s.importCatHead}>
                <span
                  className={s.importCatDot}
                  style={{ background: `hsl(${parseHue(c.color)} 70% 60%)` }}
                  aria-hidden
                />
                {c.name}
              </h5>
              <div className={s.importGrid}>
                {(c.groups ?? []).map((g) => {
                  const isSel = selected?.type === "group" && selected.id === g.id;
                  return (
                    <button
                      key={`g-${g.id}`}
                      type="button"
                      className={cx(s.importItem, isSel && s.importItemSel)}
                      onClick={() => onSelect({ type: "group", id: g.id, categoryId: c.id })}
                    >
                      <span className={s.importItemTop}>
                        <span className={s.importItemBadge}>组</span>
                        <span className={s.importItemName}>{g.name}</span>
                      </span>
                      <em className={s.importItemMeta}>{g.memberCount} 个预制</em>
                    </button>
                  );
                })}
                {c.presets.map((p) => {
                  const isSel = selected?.type === "preset" && selected.id === p.id;
                  return (
                    <button
                      key={`p-${p.id}`}
                      type="button"
                      className={cx(s.importItem, isSel && s.importItemSel)}
                      onClick={() => onSelect({ type: "preset", id: p.id, categoryId: c.id })}
                    >
                      <span className={s.importItemTop}>
                        <span className={s.importItemName}>{p.name}</span>
                      </span>
                      <em className={s.importItemMeta}>{p.variantCount} variants</em>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

    </>
  );
}

// ============================================================================
// Prompt block row — used in two-column positive/negative split
// ============================================================================

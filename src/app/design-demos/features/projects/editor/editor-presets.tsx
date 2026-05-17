"use client";

import { useState } from "react";
import type * as React from "react";
import Link from "next/link";
import { Search, Trash2, Unlink } from "lucide-react";

import { Button } from "../../../shared/primitives/button";
import { FloatingSelect } from "../../../shared/primitives/floating-select";
import { SegmentedControl } from "../../../shared/primitives/segmented-control";
import s from "./editor-presets.module.css";
import { cx } from "../../../routing";
import { parseHue } from "./editor-shared";

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
  positivePromptCount?: number;
  negativePromptCount?: number;
  lora1Count?: number;
  lora2Count?: number;
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
  const currentVariantId = binding.variantId ?? binding.variants?.[0]?.id ?? "";
  const currentVariant = binding.variants?.find((variant) => variant.id === currentVariantId);

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
          <FloatingSelect
            ariaLabel="Select variant"
            buttonClassName={s.variantSelectBtn}
            className={s.variantSelect}
            displayValue={currentVariant?.name ?? "切换"}
            menuClassName={s.variantSelectMenu}
            onChange={(vid) => onVariantChange?.(binding.id, vid)}
            optionClassName={s.variantSelectOption}
            options={binding.variants.map((variant) => ({
              value: variant.id,
              label: variant.name,
            }))}
            value={currentVariantId}
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
  const counts = getBindingCounts(binding);
  const displayName =
    binding.scope === "project" ? stripProjectDefaultSuffix(binding.name) : binding.name;

  return (
    <div className={s.bindNameWrap}>
      <span className={s.bindName}>
        <span className={s.bindTitleText}>{displayName}</span>
        <span
          className={s.bindCategory}
          style={{ "--cat": color } as React.CSSProperties}
        >
          {binding.categoryName}
        </span>
        {binding.scope === "project" ? <span className={s.bindScopeChip}>项目</span> : null}
        {isFromGroup ? <span className={s.bindGroupChip}>组</span> : null}
      </span>
      <span className={s.bindMeta}>
        <span className={s.bindMetric}>
          <em>正面</em>
          <b>{counts.positive}</b>
        </span>
        <span className={s.bindMetric}>
          <em>负面</em>
          <b>{counts.negative}</b>
        </span>
        <span className={s.bindMetric}>
          <em>LoRA1</em>
          <b>{counts.lora1}</b>
        </span>
        <span className={s.bindMetric}>
          <em>LoRA2</em>
          <b>{counts.lora2}</b>
        </span>
      </span>
    </div>
  );
}

function stripProjectDefaultSuffix(name: string) {
  return name.replace(/\s*·\s*项目默认\s*$/, "");
}

function getBindingCounts(binding: PresetBinding) {
  const blockCount = normalizeCount(binding.blockCount);
  const loraCount = normalizeCount(binding.loraCount);
  const lora1Fallback = Math.ceil(loraCount / 2);

  return {
    positive: binding.positivePromptCount ?? blockCount,
    negative: binding.negativePromptCount ?? blockCount,
    lora1: binding.lora1Count ?? lora1Fallback,
    lora2: binding.lora2Count ?? Math.max(0, loraCount - lora1Fallback),
  };
}

function normalizeCount(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value ?? 0)) : 0;
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

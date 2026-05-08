"use client";

import Link from "next/link";
import { useState } from "react";
import type * as React from "react";
import { ChevronDown, Search, Trash2, Unlink, ExternalLink, Copy as CopyIcon } from "lucide-react";

import s from "./design-demo-styles";
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
  onCopyName?: (binding: PresetBinding) => void;
  onUnlink?: (binding: PresetBinding, memberId?: string) => void;
  onDelete?: (binding: PresetBinding) => void;
};

export function PresetBindingRow({
  binding,
  onVariantChange,
  onCopyName,
  onUnlink,
  onDelete,
}: PresetBindingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hue = parseHue(binding.categoryColor);
  const color = `hsl(${hue} 70% 60%)`;
  const isGroup = binding.kind === "group";

  return (
    <div className={s.bindRow} data-expanded={expanded}>
      <div className={s.bindRowMain}>
        <div className={s.bindNameWrap}>
          <span className={s.bindName}>
            {binding.name}
            <span
              className={s.bindCategory}
              style={{ "--cat": color } as React.CSSProperties}
            >
              {binding.categoryName}
            </span>
            {isGroup ? <span className={s.bindGroupChip}>组</span> : null}
            {binding.scope === "project" ? (
              <span className={s.bindScopeChip}>项目</span>
            ) : null}
          </span>
          <span className={s.bindMeta}>
            <b>{binding.blockCount}</b> 块 · <b>{binding.loraCount}</b> LoRA
            {binding.variantName ? <> · {binding.variantName}</> : null}
            {isGroup && binding.members ? <> · {binding.members.length} 个预制</> : null}
          </span>
        </div>
      </div>

      <div className={s.bindRowControls}>
        {!isGroup && binding.variants && binding.variants.length > 1 ? (
          <VariantSwitcher
            variants={binding.variants}
            currentVariantId={binding.variantId ?? binding.variants[0]?.id ?? ""}
            onChange={(vid) => onVariantChange?.(binding.id, vid)}
          />
        ) : null}

        {isGroup ? (
          <button
            type="button"
            className={s.iconGhostBtn}
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            title={expanded ? "收起组内预制" : "展开组内预制"}
          >
            <ChevronDown
              className={cx("size-4", s.bindChevron)}
              data-expanded={expanded}
            />
          </button>
        ) : null}

        {binding.detailHref ? (
          <Link
            href={binding.detailHref}
            className={s.iconGhostBtn}
            title="跳转预制详情"
          >
            <ExternalLink className="size-3.5" />
          </Link>
        ) : null}
        <button
          type="button"
          className={s.iconGhostBtn}
          onClick={() => onCopyName?.(binding)}
          title="作为小节名"
        >
          <CopyIcon className="size-3.5" />
        </button>
        {!isGroup ? (
          <button
            type="button"
            className={s.iconGhostBtn}
            data-tone="warn"
            onClick={() => onUnlink?.(binding)}
            title="单独解绑"
          >
            <Unlink className="size-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          className={s.iconGhostBtn}
          data-tone="danger"
          onClick={() => onDelete?.(binding)}
          title="级联删除"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {isGroup && expanded && binding.members ? (
        <div className={s.bindMembers}>
          {binding.members.map((m) => (
            <div key={m.id} className={s.bindMemberRow}>
              <span className={s.bindMemberDot} aria-hidden />
              <span className={s.bindMemberName}>{m.presetName}</span>
              {m.variants && m.variants.length > 1 ? (
                <VariantSwitcher
                  variants={m.variants}
                  currentVariantId={m.variantId ?? m.variants[0]?.id ?? ""}
                  onChange={(vid) => onVariantChange?.(binding.id, vid, m.id)}
                />
              ) : (
                <span className={s.bindMemberVariant}>{m.variantName ?? "默认"}</span>
              )}
              {m.detailHref ? (
                <Link href={m.detailHref} className={s.iconGhostBtn} title="预制详情">
                  <ExternalLink className="size-3.5" />
                </Link>
              ) : null}
              <button
                type="button"
                className={s.iconGhostBtn}
                data-tone="warn"
                onClick={() => onUnlink?.(binding, m.id)}
                title="仅移除该成员"
              >
                <Unlink className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
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
        <div className={s.importTabs} role="tablist">
          <button
            type="button"
            className={cx(s.importTab, !activeCat && s.importTabActive)}
            onClick={() => setActiveCat(null)}
          >
            全部
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cx(s.importTab, activeCat === c.id && s.importTabActive)}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className={s.importSearch}>
          <Search className="size-3.5" aria-hidden />
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

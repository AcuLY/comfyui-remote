"use client";

import { useState } from "react";
import { ChevronDown, ClipboardCopy, FolderOpen, Plus, Save, X } from "lucide-react";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type {
  PresetCategoryFull,
  PresetGroupItem,
  SlotTemplateDef,
} from "@/lib/server-data";
import { toSlug } from "./group-utils";

// ---------------------------------------------------------------------------
// GroupCreateForm
// ---------------------------------------------------------------------------

export function GroupCreateForm({
  categoryId,
  folderId,
  slotTemplate,
  onSave,
  onCancel,
  isPending,
  allCategories,
  allGroups,
}: {
  categoryId: string;
  folderId?: string | null;
  slotTemplate: SlotTemplateDef[];
  onSave: (data: { categoryId: string; folderId?: string | null; name: string; slug: string }, members: Array<{ presetId?: string; variantId?: string; subGroupId?: string; slotCategoryId?: string }>) => void;
  onCancel: () => void;
  isPending: boolean;
  allCategories: PresetCategoryFull[];
  allGroups: PresetGroupItem[];
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  // Inline member drafts (not yet persisted)
  type MemberDraft = { presetId?: string; variantId?: string; subGroupId?: string; slotCategoryId?: string; displayName: string };
  // Initialize from slot template: each slot becomes an empty member with locked category
  const presetCategories = allCategories.filter((c) => c.type === "preset");
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    slotTemplate.map((slot) => {
      const cat = allCategories.find((c) => c.id === slot.categoryId);
      return {
        slotCategoryId: slot.categoryId,
        displayName: slot.label ?? cat?.name ?? "未选择",
      };
    }),
  );

  // Member add form state
  const [mode, setMode] = useState<"preset" | "group">("preset");
  const [pickerValue, setPickerValue] = useState<{ presetId: string; variantId: string } | null>(null);
  const [selGroupId, setSelGroupId] = useState<string>("");

  function addMember() {
    if (mode === "group" && selGroupId) {
      const g = allGroups.find((g) => g.id === selGroupId);
      setMembers([...members, { subGroupId: selGroupId, displayName: g?.name ?? selGroupId }]);
      setSelGroupId("");
    } else if (pickerValue) {
      // Resolve names from categories
      let presetName = pickerValue.presetId;
      let variantName = "";
      for (const cat of allCategories) {
        const p = cat.presets.find((px) => px.id === pickerValue.presetId);
        if (p) {
          presetName = p.name;
          const v = p.variants.find((vx) => vx.id === pickerValue.variantId);
          variantName = v?.name ?? "";
          if (p.variants.length > 1 && variantName) presetName = `${p.name} / ${variantName}`;
          break;
        }
      }
      setMembers([...members, {
        presetId: pickerValue.presetId,
        variantId: pickerValue.variantId || undefined,
        displayName: presetName,
      }]);
      setPickerValue(null);
    }
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  function applyMemberNames() {
    const slugParts = members.map((m) => toSlug(m.displayName));
    const joined = slugParts.join("-");
    setName(joined);
    setSlug(joined);
  }

  const canAddMember = mode === "group" ? !!selGroupId : !!pickerValue;
  // Allow creating with just slot members (even if no preset selected yet) or with manually added members
  const hasAnyMember = members.length > 0;
  const canCreate = !!name.trim() && !!slug.trim() && hasAnyMember;

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02]">
      <button
        type="button"
        onClick={onCancel}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <FolderOpen className="size-4 shrink-0 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200">新建预制组</div>
          <div className="text-[10px] text-zinc-500">
            {members.length} 个成员 · {slug || "slug"}
          </div>
        </div>
        <ChevronDown className="size-3.5 text-zinc-500" style={{ transform: "rotate(180deg)" }} />
      </button>

      <div className="border-t border-white/5 px-3 py-3 space-y-3">

      {/* Name + Slug */}
      <div className="flex gap-2 items-end">
        <label className="flex-1 space-y-1">
          <span className="text-[10px] text-zinc-500">组名</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug || slug === toSlug(name)) setSlug(toSlug(e.target.value));
            }}
            placeholder="如：基础组合"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        <label className="flex-1 space-y-1">
          <span className="text-[10px] text-zinc-500">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="basic-combo"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
          />
        </label>
        {members.length > 0 && (
          <button
            type="button"
            onClick={applyMemberNames}
            title="用成员名拼接为组名"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <ClipboardCopy className="size-3.5" />
          </button>
        )}
      </div>

      {/* Member list */}
      {members.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">成员 ({members.length})</span>
          {members.map((m, i) => {
            // Slot member: show category badge + PresetCascadePicker locked to category
            if (m.slotCategoryId) {
              const slotCat = presetCategories.find((c) => c.id === m.slotCategoryId);
              return (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-amber-500/10 bg-amber-500/[0.02] px-2 py-1.5">
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
                    style={slotCat?.color ? {
                      backgroundColor: `hsl(${slotCat.color} / 0.15)`,
                      color: `hsl(${slotCat.color})`,
                    } : { backgroundColor: "rgba(255,255,255,0.06)", color: "#a1a1aa" }}
                  >
                    {slotCat?.name ?? "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <PresetCascadePicker
                      categories={allCategories}
                      value={m.presetId && m.variantId ? { presetId: m.presetId, variantId: m.variantId } : null}
                      onChange={(val) => {
                        const updated = [...members];
                        updated[i] = {
                          ...m,
                          presetId: val?.presetId,
                          variantId: val?.variantId,
                          displayName: val?.presetName ?? m.displayName,
                        };
                        setMembers(updated);
                      }}
                      lockedCategoryId={m.slotCategoryId}
                      placeholder="选择预制…"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            }
            // Regular member
            return (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
                <div className="flex-1 min-w-0 text-xs text-zinc-300">
                  {m.subGroupId ? (
                    <span className="text-amber-400/80">
                      <FolderOpen className="mr-1 inline size-3" />
                      {m.displayName}
                    </span>
                  ) : m.displayName}
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add member inline */}
      <div className="space-y-2 rounded-lg border border-dashed border-white/10 p-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">添加成员:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("preset")}
              className={`rounded px-2 py-0.5 text-[10px] ${mode === "preset" ? "bg-sky-500/20 text-sky-300" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              预制
            </button>
            {allGroups.length > 0 && (
              <button
                type="button"
                onClick={() => setMode("group")}
                className={`rounded px-2 py-0.5 text-[10px] ${mode === "group" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                子组
              </button>
            )}
          </div>
        </div>

        {mode === "preset" ? (
          <PresetCascadePicker
            categories={allCategories}
            value={pickerValue}
            onChange={(val) => setPickerValue(val ? { presetId: val.presetId, variantId: val.variantId } : null)}
            placeholder="选择预制…"
            presetCategoriesOnly
          />
        ) : (
          <div className="relative">
            <select value={selGroupId} onChange={(e) => setSelGroupId(e.target.value)} className={selectClass}>
              <option value="">选择子组...</option>
              {allGroups.map((g) => (
                <option key={g.id} value={g.id} className="bg-zinc-900">{g.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          </div>
        )}

        <button
          type="button"
          disabled={!canAddMember}
          onClick={addMember}
          className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.1] disabled:opacity-40"
        >
          <Plus className="size-3" /> 添加
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={isPending || !canCreate}
          onClick={() => onSave(
            { categoryId, folderId, name: name.trim(), slug: slug.trim() },
            members.map((m) => ({ presetId: m.presetId, variantId: m.variantId, subGroupId: m.subGroupId, slotCategoryId: m.slotCategoryId })),
          )}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500/20 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/30 disabled:opacity-50"
        >
          <Save className="size-3" /> 创建
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.06]"
        >
          <X className="size-3" /> 取消
        </button>
      </div>
      </div>
    </div>
  );
}

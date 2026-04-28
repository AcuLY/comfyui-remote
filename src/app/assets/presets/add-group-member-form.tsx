"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import type { PresetCategoryFull, PresetGroupItem } from "@/lib/server-data";

export function AddGroupMemberForm({
  groupId,
  categories,
  groups,
  onAdd,
  isPending,
}: {
  groupId: string;
  categories: PresetCategoryFull[];
  groups: PresetGroupItem[];
  onAdd: (input: { groupId: string; presetId?: string; variantId?: string; subGroupId?: string }) => void;
  isPending: boolean;
}) {
  const [mode, setMode] = useState<"preset" | "group">("preset");
  const [pickerValue, setPickerValue] = useState<{ presetId: string; variantId: string } | null>(null);
  const [selGroupId, setSelGroupId] = useState<string>("");

  const canAdd = mode === "group" ? !!selGroupId : !!pickerValue;

  function handleAdd() {
    if (mode === "group" && selGroupId) {
      onAdd({ groupId, subGroupId: selGroupId });
      setSelGroupId("");
    } else if (pickerValue) {
      onAdd({
        groupId,
        presetId: pickerValue.presetId,
        variantId: pickerValue.variantId,
      });
      setPickerValue(null);
    }
  }

  const selectClass = "w-full appearance-none rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 pr-7 text-xs text-zinc-200 outline-none focus:border-sky-500/30";

  return (
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
          {groups.length > 0 && (
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
          categories={categories}
          value={pickerValue}
          onChange={(val) => setPickerValue(val ? { presetId: val.presetId, variantId: val.variantId } : null)}
          placeholder="选择预制..."
          presetCategoriesOnly
        />
      ) : (
        <div className="relative">
          <select value={selGroupId} onChange={(e) => setSelGroupId(e.target.value)} className={selectClass}>
            <option value="">选择子组...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id} className="bg-zinc-900">{g.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
        </div>
      )}

      <button
        type="button"
        disabled={isPending || !canAdd}
        onClick={handleAdd}
        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/[0.1] disabled:opacity-40"
      >
        <Plus className="size-3" /> 添加
      </button>
    </div>
  );
}

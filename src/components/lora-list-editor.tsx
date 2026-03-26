"use client";

import { Plus, Trash2 } from "lucide-react";
import { LoraCascadePicker } from "@/components/lora-cascade-picker";
import type { LoraEntry, LoraSource } from "@/lib/lora-types";

const SOURCE_LABELS: Record<LoraSource, { label: string; color: string }> = {
  character: { label: "角色", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  scene: { label: "场景", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  style: { label: "风格", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  position: { label: "Position", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  manual: { label: "自定义", color: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
};

type LoraListEditorProps = {
  entries: LoraEntry[];
  onChange: (entries: LoraEntry[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export function LoraListEditor({
  entries,
  onChange,
  disabled = false,
  readOnly = false,
}: LoraListEditorProps) {
  function handleAdd() {
    const newEntry: LoraEntry = {
      id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      path: "",
      weight: 1.0,
      enabled: true,
      source: "manual",
    };
    onChange([...entries, newEntry]);
  }

  function handleRemove(id: string) {
    onChange(entries.filter((e) => e.id !== id));
  }

  function handleUpdate(id: string, updates: Partial<LoraEntry>) {
    onChange(
      entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    );
  }

  function handleWeightChange(id: string, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      const clamped = Math.min(2.0, Math.max(0, num));
      const rounded = Math.round(clamped * 100) / 100;
      handleUpdate(id, { weight: rounded });
    }
  }

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span>LoRA 列表</span>
        {entries.length > 0 && (
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
            {enabledCount}/{entries.length}
          </span>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.01] p-3">
        {entries.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-zinc-600">
            暂无 LoRA，从词库导入或手动添加
          </div>
        ) : (
          entries.map((entry) => {
            const sourceConfig = SOURCE_LABELS[entry.source] || SOURCE_LABELS.manual;
            const isManual = entry.source === "manual";

            return (
              <div
                key={entry.id}
                className={`rounded-xl border p-2.5 transition ${
                  entry.enabled
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-white/[0.01] opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  {/* Enabled toggle (switch) */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={entry.enabled}
                    onClick={() =>
                      handleUpdate(entry.id, { enabled: !entry.enabled })
                    }
                    disabled={disabled}
                    className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:opacity-50 ${
                      entry.enabled
                        ? "border-sky-500/30 bg-sky-500"
                        : "border-white/10 bg-white/10"
                    }`}
                  >
                    <span
                      className={`pointer-events-none block size-3 rounded-full bg-white shadow transition-transform ${
                        entry.enabled ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>

                  {/* Path: selector for manual, display for imported */}
                  <div className="flex-1 min-w-0">
                    {isManual ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <LoraCascadePicker
                            value={entry.path}
                            onChange={(v) => handleUpdate(entry.id, { path: v })}
                            disabled={disabled}
                          />
                        </div>
                        <span
                          className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[9px] font-medium ${sourceConfig.color}`}
                        >
                          {sourceConfig.label}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-200 truncate">
                            {entry.path ? (entry.path.split("/").pop() || entry.path) : "未选择"}
                          </span>
                          <span
                            className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[9px] font-medium ${sourceConfig.color}`}
                          >
                            {entry.sourceLabel || sourceConfig.label}
                          </span>
                        </div>
                        {entry.path && (
                          <div className="mt-0.5 text-[10px] text-zinc-600 truncate">
                            {entry.path}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Weight input */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-500">权重</span>
                    <input
                      type="number"
                      value={entry.weight}
                      onChange={(e) => handleWeightChange(entry.id, e.target.value)}
                      step="0.05"
                      min="0"
                      max="2"
                      disabled={disabled}
                      className="input-number w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-50"
                    />
                  </div>

                  {/* Remove button */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemove(entry.id)}
                      disabled={disabled}
                      className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Add button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
          >
            <Plus className="size-3" />
            添加 LoRA
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { LoraEntry, LoraSource } from "@/lib/lora-types";

const SOURCE_LABELS: Record<LoraSource, { label: string; color: string }> = {
  character: { label: "角色", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  scene: { label: "场景", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  style: { label: "风格", color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  position: { label: "Position", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  manual: { label: "手动添加", color: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

type LoraListEditorProps = {
  entries: LoraEntry[];
  onChange: (entries: LoraEntry[]) => void;
  loraOptions?: { value: string; label: string }[];
  disabled?: boolean;
  readOnly?: boolean;  // v0.3: 只读模式（用于角色 LoRA）
};

export function LoraListEditor({
  entries,
  onChange,
  loraOptions,
  disabled = false,
  readOnly = false,
}: LoraListEditorProps) {
  const [expanded, setExpanded] = useState(entries.length > 0);

  function handleAdd() {
    const newEntry: LoraEntry = {
      id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      path: "",
      weight: 1.0,
      enabled: true,
      source: "manual",
    };
    onChange([...entries, newEntry]);
    setExpanded(true);
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
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-400 transition hover:bg-white/[0.04] disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          LoRA 列表
          {entries.length > 0 && (
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] text-sky-300">
              {enabledCount}/{entries.length}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="size-4" />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2 rounded-xl border border-white/5 bg-white/[0.01] p-3">
          {entries.length === 0 ? (
            <div className="py-3 text-center text-[11px] text-zinc-600">
              暂无 LoRA，从词库导入或手动添加
            </div>
          ) : (
            entries.map((entry) => {
              const sourceConfig = SOURCE_LABELS[entry.source] || SOURCE_LABELS.manual;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${
                    entry.enabled
                      ? "border-white/10 bg-white/[0.02]"
                      : "border-white/5 bg-white/[0.01] opacity-60"
                  }`}
                >
                  {/* Enabled toggle */}
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={(e) =>
                        handleUpdate(entry.id, { enabled: e.target.checked })
                      }
                      disabled={disabled}
                      className="size-4 rounded border-white/20 bg-white/10"
                    />
                  </label>

                  {/* Path input or display */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {entry.source !== "manual" ? (
                        <>
                          <span className="text-xs text-zinc-200 truncate">
                            {entry.path.split("/").pop() || entry.path}
                          </span>
                          <span
                            className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[9px] font-medium ${sourceConfig.color}`}
                          >
                            {entry.sourceLabel || sourceConfig.label}
                          </span>
                        </>
                      ) : loraOptions && loraOptions.length > 0 ? (
                        <select
                          value={entry.path}
                          onChange={(e) =>
                            handleUpdate(entry.id, { path: e.target.value })
                          }
                          disabled={disabled}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
                        >
                          <option value="">选择 LoRA...</option>
                          {loraOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={entry.path}
                          onChange={(e) =>
                            handleUpdate(entry.id, { path: e.target.value })
                          }
                          placeholder="LoRA 路径..."
                          disabled={disabled}
                          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
                        />
                      )}
                    </div>
                    {entry.source !== "manual" && (
                      <div className="mt-0.5 text-[10px] text-zinc-600 truncate">
                        {entry.path}
                      </div>
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

                  {/* Remove button (hidden in readOnly mode) */}
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
              );
            })
          )}

          {/* Add button (hidden in readOnly mode) */}
          {!readOnly && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={disabled}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.01] py-2 text-[11px] text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300 disabled:opacity-50"
            >
              <Plus className="size-3" />
              添加额外 LoRA
            </button>
          )}
        </div>
      )}
    </div>
  );
}

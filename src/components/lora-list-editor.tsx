"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

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

  function handleTagKeyDown(id: string, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const value = tagInputs[id]?.trim();
    if (!value) return;
    handleUpdate(id, { sourceLabel: value });
    setTagInputs((prev) => ({ ...prev, [id]: "" }));
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
                      ) : (
                        <>
                          {loraOptions && loraOptions.length > 0 ? (
                            <select
                              value={entry.path}
                              onChange={(e) =>
                                handleUpdate(entry.id, { path: e.target.value })
                              }
                              disabled={disabled}
                              className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none focus:border-sky-500/30"
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
                              className="flex-1 min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
                            />
                          )}
                          <span
                            className={`shrink-0 rounded-lg border px-1.5 py-0.5 text-[9px] font-medium ${sourceConfig.color}`}
                          >
                            {entry.sourceLabel || sourceConfig.label}
                          </span>
                        </>
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

                {/* Tag input for manual entries */}
                {entry.source === "manual" && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {entry.sourceLabel && (
                      <span className="rounded-lg border border-zinc-500/30 bg-zinc-500/20 px-1.5 py-0.5 text-[9px] font-medium text-zinc-300">
                        {entry.sourceLabel}
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => handleUpdate(entry.id, { sourceLabel: undefined })}
                            className="ml-1 text-zinc-500 hover:text-zinc-300"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    )}
                    {!readOnly && (
                      <input
                        type="text"
                        value={tagInputs[entry.id] ?? ""}
                        onChange={(e) => setTagInputs((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                        onKeyDown={(e) => handleTagKeyDown(entry.id, e)}
                        placeholder="添加标签 (回车确认)..."
                        disabled={disabled}
                        className="flex-1 rounded-lg border border-white/5 bg-transparent px-1.5 py-0.5 text-[10px] text-zinc-400 outline-none placeholder:text-zinc-600 focus:border-sky-500/20"
                      />
                    )}
                  </div>
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { LoraBinding } from "@/lib/lora-types";

type LoraBindingEditorProps = {
  bindings: LoraBinding[];
  onChange: (bindings: LoraBinding[]) => void;
  loraOptions?: { value: string; label: string }[];
};

export function LoraBindingEditor({
  bindings,
  onChange,
  loraOptions,
}: LoraBindingEditorProps) {
  // Track local weight input values (allow empty during editing)
  const [weightInputs, setWeightInputs] = useState<Record<number, string>>({});

  function handleAdd() {
    onChange([
      ...bindings,
      { path: "", weight: 1.0, enabled: true },
    ]);
  }

  function handleRemove(index: number) {
    onChange(bindings.filter((_, i) => i !== index));
    // Clean up local input state
    setWeightInputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function handleUpdate(index: number, updates: Partial<LoraBinding>) {
    onChange(
      bindings.map((b, i) =>
        i === index ? { ...b, ...updates } : b,
      ),
    );
  }

  // Get displayed weight value (local input or binding value)
  function getWeightDisplay(index: number, binding: LoraBinding): string {
    if (index in weightInputs) {
      return weightInputs[index];
    }
    return binding.weight.toFixed(2);
  }

  // Handle weight input change (allow any input including empty)
  function handleWeightInputChange(index: number, value: string) {
    setWeightInputs((prev) => ({ ...prev, [index]: value }));
  }

  // Handle weight input blur (validate and commit)
  function handleWeightBlur(index: number, binding: LoraBinding) {
    const inputValue = weightInputs[index];

    // If no local edit was made, nothing to do
    if (inputValue === undefined) return;

    const num = parseFloat(inputValue);
    if (!isNaN(num)) {
      const clamped = Math.min(2.0, Math.max(0, num));
      const rounded = Math.round(clamped * 100) / 100;
      handleUpdate(index, { weight: rounded });
    }
    // Clear local input state (will fall back to binding value)
    setWeightInputs((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500 mb-1">LoRA 绑定</div>

      <div className="space-y-2 rounded-lg border border-white/5 bg-white/[0.01] p-2">
        {bindings.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-zinc-600">
            暂无绑定的 LoRA
          </div>
        ) : (
          bindings.map((binding, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2"
            >
              {/* Enabled toggle (switch) */}
              <button
                type="button"
                role="switch"
                aria-checked={binding.enabled}
                onClick={() =>
                  handleUpdate(index, { enabled: !binding.enabled })
                }
                className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                  binding.enabled
                    ? "border-sky-500/30 bg-sky-500"
                    : "border-white/10 bg-white/10"
                }`}
              >
                <span
                  className={`pointer-events-none block size-3 rounded-full bg-white shadow transition-transform ${
                    binding.enabled ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </button>

              {/* Path input or select */}
              <div className="flex-1 min-w-0">
                {loraOptions && loraOptions.length > 0 ? (
                  <select
                    value={binding.path}
                    onChange={(e) =>
                      handleUpdate(index, { path: e.target.value })
                    }
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
                    value={binding.path}
                    onChange={(e) =>
                      handleUpdate(index, { path: e.target.value })
                    }
                    placeholder="LoRA 路径..."
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
                  />
                )}
              </div>

              {/* Weight input */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-zinc-500">权重</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={getWeightDisplay(index, binding)}
                  onChange={(e) => handleWeightInputChange(index, e.target.value)}
                  onBlur={() => handleWeightBlur(index, binding)}
                  className="w-14 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center text-xs text-zinc-200 outline-none focus:border-sky-500/30"
                />
              </div>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="rounded p-1 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 bg-white/[0.01] py-1.5 text-[11px] text-zinc-500 transition hover:bg-white/[0.03] hover:text-zinc-300"
        >
          <Plus className="size-3" />
          添加 LoRA
        </button>
      </div>
    </div>
  );
}

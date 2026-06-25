"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createProject } from "@/lib/actions";
import { toast } from "sonner";
import type { ProjectFormCategory } from "@/lib/server-data";
import { CheckpointCascadePicker } from "@/components/checkpoint-cascade-picker";
import { PresetCascadePicker } from "@/components/preset-cascade-picker";
import { DEFAULT_CHECKPOINT_NAME } from "@/lib/model-constants";

type Props = {
  categories: ProjectFormCategory[];
  folderId?: string | null;
};

export function ProjectForm({ categories, folderId = null }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [checkpointName, setCheckpointName] = useState(DEFAULT_CHECKPOINT_NAME);
  // categoryId → { presetId, variantId? } (one per category, empty string = not selected)
  const [selections, setSelections] = useState<Record<string, { presetId: string; variantId?: string }>>(() => {
    const init: Record<string, { presetId: string; variantId?: string }> = {};
    for (const cat of categories) {
      init[cat.id] = { presetId: "" };
    }
    return init;
  });
  const [notes, setNotes] = useState("");

  function setSelection(categoryId: string, presetId: string, variantId?: string) {
    // Auto-select first variant when choosing a preset
    if (presetId && !variantId) {
      const cat = categories.find((c) => c.id === categoryId);
      const preset = cat?.presets.find((p) => p.id === presetId);
      if (preset && preset.variants.length > 0) {
        variantId = preset.variants[0].id;
      }
    }
    setSelections((prev) => ({ ...prev, [categoryId]: { presetId, variantId } }));
  }

  function handleSubmit() {
    if (!title.trim() || !checkpointName.trim()) return;

    const presetBindings = Object.entries(selections)
      .filter(([, selection]) => selection.presetId)
      .map(([categoryId, selection]) => ({
        categoryId,
        presetId: selection.presetId,
        variantId: selection.variantId
      }));

    startTransition(async () => {
      try {
        const newProjectId = await createProject({
          title: title.trim(),
          checkpointName: checkpointName.trim(),
          folderId,
          presetBindings,
          notes: notes.trim() || null,
        });
        toast.success("项目已创建");
        router.push(`/projects/${newProjectId}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "创建失败");
      }
    });
  }

  const CATEGORY_LABELS: Record<string, string> = {
    sky: "text-sky-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
    amber: "text-amber-400",
  };

  return (
    <div className="space-y-4">
      {/* 项目标题 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">项目标题 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：Miku spring batch B"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Checkpoint *</label>
        <CheckpointCascadePicker
          value={checkpointName}
          onChange={setCheckpointName}
          size="md"
        />
      </div>

      {/* Dynamic category selectors */}
      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((cat) => {
          const labelClass = CATEGORY_LABELS[cat.color ?? ""] ?? "text-zinc-400";
          const currentSelection = selections[cat.id] ?? { presetId: "" };
          const selectedPreset = cat.presets.find((p) => p.id === currentSelection.presetId);
          const selectedVariant = selectedPreset?.variants.find((v) => v.id === currentSelection.variantId) ?? selectedPreset?.variants[0];
          const pickerValue = selectedPreset && selectedVariant
            ? { presetId: selectedPreset.id, variantId: selectedVariant.id }
            : null;

          return (
            <div key={cat.id} className="space-y-2">
              <label className={`text-xs ${labelClass}`}>
                {cat.name}（可选）
              </label>
              <PresetCascadePicker
                categories={categories}
                value={pickerValue}
                onChange={(value) => setSelection(cat.id, value?.presetId ?? "", value?.variantId)}
                lockedCategoryId={cat.id}
                placeholder={`不选择${cat.name}`}
                presetCategoriesOnly
                clearable
                clearLabel={`不选择${cat.name}`}
              />

              {selectedPreset && (
                <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                  {selectedVariant?.prompt || "\u65e0\u63d0\u793a\u8bcd"}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 备注 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">备注（可选）</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="项目备注..."
          className="cm-text-editor cm-text-editor--compact w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
        />
      </div>

      <p className="text-xs text-zinc-500">创建后可在项目详情页添加小节（Section）来设置画面参数和提示词。</p>

      {/* 提交 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim() || !checkpointName.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> 创建中...</>
        ) : (
          <><Plus className="size-4" /> 创建项目</>
        )}
      </button>
    </div>
  );
}

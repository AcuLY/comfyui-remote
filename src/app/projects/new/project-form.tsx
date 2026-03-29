"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { createProject } from "@/lib/actions";
import type { ProjectFormCategory } from "@/lib/server-data";

type Props = {
  categories: ProjectFormCategory[];
  // Legacy props (kept for backward compat but unused in new form)
  characters?: unknown[];
  scenes?: unknown[];
  styles?: unknown[];
};

export function ProjectForm({ categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  // categoryId → presetId (one per category, empty string = not selected)
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of categories) {
      init[cat.id] = "";
    }
    return init;
  });
  const [notes, setNotes] = useState("");

  function setSelection(categoryId: string, presetId: string) {
    setSelections((prev) => ({ ...prev, [categoryId]: presetId }));
  }

  // Find if there's a character category and it's required
  const characterCategory = categories.find((c) => c.slug === "character");
  const hasCharacterSelected = characterCategory
    ? !!selections[characterCategory.id]
    : true; // if no character category exists, don't block

  function handleSubmit() {
    if (!title.trim() || !hasCharacterSelected) return;

    const presetBindings = Object.entries(selections)
      .filter(([, presetId]) => presetId)
      .map(([categoryId, presetId]) => ({ categoryId, presetId }));

    startTransition(async () => {
      const newProjectId = await createProject({
        title: title.trim(),
        presetBindings,
        notes: notes.trim() || null,
      });
      router.push(`/projects/${newProjectId}`);
    });
  }

  const CATEGORY_COLORS: Record<string, string> = {
    sky: "border-sky-500/20 focus:border-sky-500/40",
    emerald: "border-emerald-500/20 focus:border-emerald-500/40",
    violet: "border-violet-500/20 focus:border-violet-500/40",
    amber: "border-amber-500/20 focus:border-amber-500/40",
  };

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

      {/* Dynamic category selectors */}
      <div className="grid gap-3 md:grid-cols-2">
        {categories.map((cat) => {
          const colorClass = CATEGORY_COLORS[cat.color ?? ""] ?? "border-white/10 focus:border-sky-500/40";
          const labelClass = CATEGORY_LABELS[cat.color ?? ""] ?? "text-zinc-400";
          const isRequired = cat.slug === "character";

          const selectedPreset = cat.presets.find((p) => p.id === selections[cat.id]);

          return (
            <div key={cat.id} className="space-y-2">
              <label className={`text-xs ${labelClass}`}>
                {cat.name}{isRequired ? " *" : "（可选）"}
              </label>
              <div className="relative">
                <select
                  value={selections[cat.id]}
                  onChange={(e) => setSelection(cat.id, e.target.value)}
                  className={`w-full appearance-none rounded-2xl bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none ${colorClass}`}
                >
                  <option value="" className="bg-zinc-900">
                    {isRequired ? `选择${cat.name}...` : `不选择${cat.name}`}
                  </option>
                  {cat.presets.map((preset) => (
                    <option key={preset.id} value={preset.id} className="bg-zinc-900">
                      {preset.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
              </div>
              {selectedPreset && (
                <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
                  {selectedPreset.prompt.slice(0, 80)}
                  {selectedPreset.prompt.length > 80 ? "..." : ""}
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
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
        />
      </div>

      <p className="text-xs text-zinc-500">创建后可在项目详情页添加小节（Section）来设置画面参数和提示词。</p>

      {/* 提交 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim() || !hasCharacterSelected}
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

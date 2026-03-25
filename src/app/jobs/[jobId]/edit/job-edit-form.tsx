"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { updateJob, type UpdateJobInput } from "@/lib/actions";
import type { JobEditData } from "@/lib/server-data";

type Character = { id: string; name: string; slug: string; prompt: string; loraPath: string };
type SceneStyle = { id: string; name: string; slug: string; prompt: string };
type Position = { id: string; name: string; slug: string; defaultAspectRatio: string | null; defaultBatchSize: number | null; defaultSeedPolicy: string | null };

type Props = {
  job: JobEditData;
  characters: Character[];
  scenes: SceneStyle[];
  styles: SceneStyle[];
  positions: Position[];
};

export function JobEditForm({ job, characters, scenes, styles, positions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(job.title);
  const [characterId, setCharacterId] = useState(job.characterId);
  const [sceneId, setSceneId] = useState(job.scenePresetId ?? "");
  const [styleId, setStyleId] = useState(job.stylePresetId ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");

  // Position 级别覆盖参数
  const [positionOverrides, setPositionOverrides] = useState<
    Map<string, { enabled: boolean; aspectRatio: string; batchSize: string; seedPolicy: string; positivePrompt: string; negativePrompt: string }>
  >(() => {
    const map = new Map();
    for (const pos of job.positions) {
      map.set(pos.positionTemplateId, {
        enabled: pos.enabled,
        aspectRatio: pos.aspectRatio ?? "",
        batchSize: pos.batchSize?.toString() ?? "",
        seedPolicy: pos.seedPolicy ?? "",
        positivePrompt: pos.positivePrompt ?? "",
        negativePrompt: pos.negativePrompt ?? "",
      });
    }
    // 也包含未在 job 中的 position（用模板默认值）
    for (const tpl of positions) {
      if (!map.has(tpl.id)) {
        map.set(tpl.id, {
          enabled: false,
          aspectRatio: tpl.defaultAspectRatio ?? "",
          batchSize: tpl.defaultBatchSize?.toString() ?? "",
          seedPolicy: tpl.defaultSeedPolicy ?? "",
          positivePrompt: "",
          negativePrompt: "",
        });
      }
    }
    return map;
  });

  const selectedChar = characters.find((c) => c.id === characterId);
  const selectedScene = scenes.find((s) => s.id === sceneId);
  const selectedStyle = styles.find((s) => s.id === styleId);

  function updatePositionField(templateId: string, field: string, value: string | boolean) {
    setPositionOverrides((prev) => {
      const next = new Map(prev);
      const current = next.get(templateId);
      if (current) {
        next.set(templateId, { ...current, [field]: value });
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!title.trim() || !characterId) return;

    const positionsArray: UpdateJobInput["positions"] = positions
      .map((tpl, i) => {
        const override = positionOverrides.get(tpl.id);
        return {
          positionTemplateId: tpl.id,
          sortOrder: i,
          enabled: override?.enabled ?? false,
          positivePrompt: override?.positivePrompt?.trim() || null,
          negativePrompt: override?.negativePrompt?.trim() || null,
          aspectRatio: override?.aspectRatio?.trim() || null,
          batchSize: override?.batchSize ? parseInt(override.batchSize, 10) || null : null,
          seedPolicy: override?.seedPolicy?.trim() || null,
        };
      });

    const input: UpdateJobInput = {
      jobId: job.id,
      title: title.trim(),
      characterId,
      scenePresetId: sceneId || null,
      stylePresetId: styleId || null,
      characterPrompt: selectedChar?.prompt ?? job.characterPrompt,
      characterLoraPath: selectedChar?.loraPath ?? job.characterLoraPath,
      scenePrompt: selectedScene?.prompt ?? null,
      stylePrompt: selectedStyle?.prompt ?? null,
      notes: notes.trim() || null,
      positions: positionsArray,
    };

    startTransition(async () => {
      await updateJob(input);
      router.push(`/jobs/${job.id}`);
    });
  }

  return (
    <div className="space-y-5">
      {/* 基础信息 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">基础信息</h3>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">任务标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">Character</label>
          <div className="relative">
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Scene</label>
            <div className="relative">
              <select
                value={sceneId}
                onChange={(e) => setSceneId(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="" className="bg-zinc-900">无</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Style</label>
            <div className="relative">
              <select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="" className="bg-zinc-900">无</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-zinc-400">备注</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
          />
        </div>
      </div>

      {/* Position 参数编辑 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">Position 参数</h3>

        {positions.map((tpl) => {
          const override = positionOverrides.get(tpl.id);
          if (!override) return null;
          return (
            <div
              key={tpl.id}
              className={`rounded-2xl border p-4 transition ${
                override.enabled
                  ? "border-sky-500/20 bg-sky-500/5"
                  : "border-white/10 bg-white/[0.02] opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{tpl.name}</span>
                <button
                  type="button"
                  onClick={() => updatePositionField(tpl.id, "enabled", !override.enabled)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    override.enabled
                      ? "bg-sky-500/20 text-sky-300"
                      : "bg-white/5 text-zinc-500"
                  }`}
                >
                  {override.enabled ? "已启用" : "已禁用"}
                </button>
              </div>

              {override.enabled && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">画幅</label>
                    <input
                      type="text"
                      value={override.aspectRatio}
                      onChange={(e) => updatePositionField(tpl.id, "aspectRatio", e.target.value)}
                      placeholder={tpl.defaultAspectRatio ?? "3:4"}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">Batch</label>
                    <input
                      type="number"
                      value={override.batchSize}
                      onChange={(e) => updatePositionField(tpl.id, "batchSize", e.target.value)}
                      placeholder={tpl.defaultBatchSize?.toString() ?? "1"}
                      className="input-number w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">Seed</label>
                    <input
                      type="text"
                      value={override.seedPolicy}
                      onChange={(e) => updatePositionField(tpl.id, "seedPolicy", e.target.value)}
                      placeholder="random"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] text-zinc-500">Positive prompt 覆盖</label>
                    <input
                      type="text"
                      value={override.positivePrompt}
                      onChange={(e) => updatePositionField(tpl.id, "positivePrompt", e.target.value)}
                      placeholder="留空则使用模板默认"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
                    />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[10px] text-zinc-500">Negative prompt 覆盖</label>
                    <input
                      type="text"
                      value={override.negativePrompt}
                      onChange={(e) => updatePositionField(tpl.id, "negativePrompt", e.target.value)}
                      placeholder="留空则使用模板默认"
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 保存 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim() || !characterId}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> 保存中...</>
        ) : (
          <><Save className="size-4" /> 保存修改</>
        )}
      </button>
    </div>
  );
}

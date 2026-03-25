"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { updateJob, type UpdateJobInput } from "@/lib/actions";
import type { JobEditData } from "@/lib/server-data";

type Character = { id: string; name: string; slug: string; prompt: string; loraPath: string };
type SceneStyle = { id: string; name: string; slug: string; prompt: string };

type Props = {
  job: JobEditData;
  characters: Character[];
  scenes: SceneStyle[];
  styles: SceneStyle[];
};

export function JobEditForm({ job, characters, scenes, styles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(job.title);
  const [characterId, setCharacterId] = useState(job.characterId);
  const [sceneId, setSceneId] = useState(job.scenePresetId ?? "");
  const [styleId, setStyleId] = useState(job.stylePresetId ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");

  // 小节默认值
  const [defaultAspectRatio, setDefaultAspectRatio] = useState(job.defaultAspectRatio);
  const [defaultShortSidePx, setDefaultShortSidePx] = useState(job.defaultShortSidePx.toString());
  const [defaultBatchSize, setDefaultBatchSize] = useState(job.defaultBatchSize.toString());
  const [defaultSeedPolicy, setDefaultSeedPolicy] = useState(job.defaultSeedPolicy);

  const selectedChar = characters.find((c) => c.id === characterId);
  const selectedScene = scenes.find((s) => s.id === sceneId);
  const selectedStyle = styles.find((s) => s.id === styleId);

  function handleSubmit() {
    if (!title.trim() || !characterId) return;

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
      // 小节默认值
      jobLevelOverrides: {
        defaultAspectRatio,
        defaultShortSidePx: parseInt(defaultShortSidePx, 10) || 512,
        defaultBatchSize: parseInt(defaultBatchSize, 10) || 2,
        defaultSeedPolicy,
      },
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

      {/* 小节默认值设置 */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">新建小节默认值</h3>
        <p className="text-[11px] text-zinc-500">创建新小节时自动应用这些默认值</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认画幅</label>
            <div className="relative">
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="1:1" className="bg-zinc-900">1:1 方形</option>
                <option value="2:3" className="bg-zinc-900">2:3 竖图</option>
                <option value="3:4" className="bg-zinc-900">3:4 竖图</option>
                <option value="9:16" className="bg-zinc-900">9:16 竖图</option>
                <option value="3:2" className="bg-zinc-900">3:2 横图</option>
                <option value="4:3" className="bg-zinc-900">4:3 横图</option>
                <option value="16:9" className="bg-zinc-900">16:9 横图</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认短边像素</label>
            <input
              type="number"
              min={256}
              max={4096}
              step={8}
              value={defaultShortSidePx}
              onChange={(e) => setDefaultShortSidePx(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Batch Size</label>
            <input
              type="number"
              min={1}
              max={100}
              value={defaultBatchSize}
              onChange={(e) => setDefaultBatchSize(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40"
            />
            <BatchSizeQuickFill
              onSelect={(val) => setDefaultBatchSize(String(val))}
              currentValue={defaultBatchSize ? parseInt(defaultBatchSize, 10) : null}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">默认 Seed 策略</label>
            <div className="relative">
              <select
                value={defaultSeedPolicy}
                onChange={(e) => setDefaultSeedPolicy(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
              >
                <option value="random" className="bg-zinc-900">随机 (random)</option>
                <option value="fixed" className="bg-zinc-900">固定 (fixed)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        </div>
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

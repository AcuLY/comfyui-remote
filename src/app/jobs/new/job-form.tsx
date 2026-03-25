"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { createJob, type CreateJobInput } from "@/lib/actions";

type Character = { id: string; name: string; slug: string; prompt: string; loraPath: string };
type SceneStyle = { id: string; name: string; slug: string; prompt: string };

type Props = {
  characters: Character[];
  scenes: SceneStyle[];
  styles: SceneStyle[];
};

export function JobForm({ characters, scenes, styles }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [characterId, setCharacterId] = useState("");
  const [sceneId, setSceneId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [notes, setNotes] = useState("");

  const selectedChar = characters.find((c) => c.id === characterId);
  const selectedScene = scenes.find((s) => s.id === sceneId);
  const selectedStyle = styles.find((s) => s.id === styleId);

  function handleSubmit() {
    if (!title.trim() || !characterId) return;

    const input: CreateJobInput = {
      title: title.trim(),
      characterId,
      scenePresetId: sceneId || null,
      stylePresetId: styleId || null,
      characterPrompt: selectedChar?.prompt ?? "",
      characterLoraPath: selectedChar?.loraPath ?? "",
      scenePrompt: selectedScene?.prompt ?? null,
      stylePrompt: selectedStyle?.prompt ?? null,
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const newJobId = await createJob(input);
      router.push(`/jobs/${newJobId}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* 任务标题 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">任务标题 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：Miku spring batch B"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
        />
      </div>

      {/* Character 选择 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Character *</label>
        <div className="relative">
          <select
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
          >
            <option value="" className="bg-zinc-900">选择角色...</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id} className="bg-zinc-900">{c.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        </div>
        {selectedChar && (
          <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
            Prompt: {selectedChar.prompt.slice(0, 80)}{selectedChar.prompt.length > 80 ? "..." : ""}
          </div>
        )}
      </div>

      {/* Scene 选择 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Scene（可选）</label>
        <div className="relative">
          <select
            value={sceneId}
            onChange={(e) => setSceneId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
          >
            <option value="" className="bg-zinc-900">不选择场景</option>
            {scenes.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      {/* Style 选择 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">Style（可选）</label>
        <div className="relative">
          <select
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40"
          >
            <option value="" className="bg-zinc-900">不选择风格</option>
            {styles.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        </div>
      </div>

      {/* 备注 */}
      <div className="space-y-2">
        <label className="text-xs text-zinc-400">备注（可选）</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="任务备注..."
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500/40"
        />
      </div>

      <p className="text-xs text-zinc-500">创建后可在任务详情页添加小节（Section）来设置画面参数和提示词。</p>

      {/* 提交 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !title.trim() || !characterId}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? (
          <><Loader2 className="size-4 animate-spin" /> 创建中...</>
        ) : (
          <><Plus className="size-4" /> 创建大任务</>
        )}
      </button>
    </div>
  );
}

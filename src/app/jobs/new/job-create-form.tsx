"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createJobAction, initialJobCreateState } from "@/app/jobs/actions";
import type { JobCreateOptions } from "@/lib/server-data";

const feedbackClassNames = {
  idle: "border-white/10 bg-white/[0.03] text-zinc-400",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  error: "border-rose-500/20 bg-rose-500/10 text-rose-200",
} as const;

export function JobCreateForm({ options }: { options: JobCreateOptions }) {
  const [state, formAction, pending] = useActionState(createJobAction, initialJobCreateState);
  const enabledPositionTemplates = options.positionTemplates.filter((template) => template.enabled);

  return (
    <form action={formAction} aria-busy={pending} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1.5 text-xs text-zinc-400 md:col-span-2">
          <span>任务标题</span>
          <input
            type="text"
            name="title"
            placeholder="例如：Miku spring draft B"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </label>

        <label className="space-y-1.5 text-xs text-zinc-400">
          <span>Character</span>
          <select name="characterId" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
            <option value="">请选择 Character</option>
            {options.characters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-zinc-400">
          <span>Scene</span>
          <select name="scenePresetId" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
            <option value="">不设置</option>
            {options.scenePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-zinc-400">
          <span>Style</span>
          <select name="stylePresetId" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none">
            <option value="">不设置</option>
            {options.stylePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-xs text-zinc-400 md:col-span-2">
          <span>备注</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="可选，记录这条草稿任务的用途。"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs text-zinc-400">Position templates（至少选一个）</legend>
        <div className="grid gap-2 md:grid-cols-2">
          {enabledPositionTemplates.map((template, index) => (
            <label key={template.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                name="positionTemplateIds"
                value={template.id}
                defaultChecked={index === 0}
                className="size-4"
              />
              <span>{template.name}</span>
              <span className="text-[11px] text-zinc-500">{template.slug}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassNames[state.status]}`}>
          {pending ? "正在向后端创建草稿任务..." : state.message}
        </p>
        {state.status === "success" && state.createdJobId ? (
          <Link href={`/jobs/${state.createdJobId}/edit`} className="inline-flex text-xs text-sky-300">
            打开新建草稿继续编辑
          </Link>
        ) : null}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm text-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "创建中..." : "创建草稿任务"}
        </button>
        <Link href="/jobs" className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
          返回任务列表
        </Link>
      </div>
    </form>
  );
}

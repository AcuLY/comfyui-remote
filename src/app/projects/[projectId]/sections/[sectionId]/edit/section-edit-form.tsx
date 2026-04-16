"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Layers, Save } from "lucide-react";
import { useActionState } from "react";
import { saveSectionEditAction } from "@/app/projects/actions";
import { initialProjectSaveState } from "@/app/projects/action-types";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import type { ProjectDetailSection } from "@/lib/server-data";

type SectionEditFormProps = {
  projectId: string;
  section: ProjectDetailSection;
  positivePrompt: string;
};

export function SectionEditForm({ projectId, section, positivePrompt }: SectionEditFormProps) {
  const [state, formAction, pending] = useActionState(saveSectionEditAction, initialProjectSaveState);
  const [batchSize, setBatchSize] = useState<string>(section.batchSize?.toString() ?? "");
  const [upscaleFactor, setUpscaleFactor] = useState<string>(section.upscaleFactor?.toString() ?? "2");

  const feedbackClassName =
    state.status === "error"
      ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
      : state.status === "success"
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        : "border-white/10 bg-white/[0.03] text-zinc-400";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sectionId" value={section.id} />

      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${projectId}#section-${section.id}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回项目详情
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="size-4" />
          {pending ? "保存中..." : "保存小节"}
        </button>
      </div>

      <PageHeader
        title={`编辑 ${section.name}`}
        description="修改小节的提示词和生成参数"
      />

      <p aria-live="polite" className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${feedbackClassName}`}>
        {pending ? "保存中..." : state.message}
      </p>

      <SectionCard title="提示词" subtitle="清空字段将回退到预制默认值">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">正向提示词</span>
            <textarea
              name="positivePrompt"
              disabled={pending}
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none disabled:opacity-70 focus:border-sky-500/40"
              defaultValue={positivePrompt}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">负向提示词</span>
            <textarea
              name="negativePrompt"
              disabled={pending}
              className="min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none disabled:opacity-70 focus:border-sky-500/40"
              defaultValue={section.promptOverview.negativePrompt ?? ""}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="生成参数" subtitle="覆盖此小节的生成参数">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">画幅</label>
            <div className="relative">
              <select
                name="aspectRatio"
                disabled={pending}
                defaultValue={section.aspectRatio ?? "2:3"}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40 disabled:opacity-70"
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
            <label className="text-xs text-zinc-400">Batch Size</label>
            <input
              name="batchSize"
              type="number"
              min={1}
              max={100}
              disabled={pending}
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40 disabled:opacity-70"
            />
            <BatchSizeQuickFill
              onSelect={(val) => setBatchSize(String(val))}
              currentValue={batchSize ? parseInt(batchSize, 10) : null}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">放大倍数</label>
            <input
              name="upscaleFactor"
              type="number"
              min={1}
              max={4}
              step={0.5}
              disabled={pending}
              value={upscaleFactor}
              onChange={(e) => setUpscaleFactor(e.target.value)}
              className="input-number w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-sky-500/40 disabled:opacity-70"
            />
            <UpscaleFactorQuickFill
              onSelect={(val) => setUpscaleFactor(String(val))}
              currentValue={upscaleFactor ? parseFloat(upscaleFactor) : null}
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-zinc-400">Seed 策略</label>
            <div className="relative">
              <select
                name="seedPolicy1"
                disabled={pending}
                defaultValue={section.seedPolicy1 ?? "random"}
                className="w-full appearance-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-10 text-sm text-white outline-none focus:border-sky-500/40 disabled:opacity-70"
              >
                <option value="random" className="bg-zinc-900">随机 (random)</option>
                <option value="fixed" className="bg-zinc-900">固定 (fixed)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
        </div>
      </SectionCard>

      <Link
        href={`/projects/${projectId}/sections/${section.id}/blocks`}
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
      >
        <Layers className="size-4" /> 管理预制 & 提示词
      </Link>
    </form>
  );
}

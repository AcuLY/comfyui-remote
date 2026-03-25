"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Save, Loader2 } from "lucide-react";
import { saveJobPositionEditAction } from "@/app/jobs/actions";
import { initialJobSaveState } from "@/app/jobs/action-types";
import { AspectRatioPicker } from "@/components/aspect-ratio-picker";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";

type SectionParamsFormProps = {
  jobId: string;
  positionId: string;
  initialParams: {
    batchSize: number | null;
    aspectRatio: string | null;
    shortSidePx: number | null;
    seedPolicy: string | null;
  };
};

export function SectionParamsForm({ jobId, positionId, initialParams }: SectionParamsFormProps) {
  const [state, formAction, pending] = useActionState(saveJobPositionEditAction, initialJobSaveState);
  const [batchSize, setBatchSize] = useState<string>(initialParams.batchSize?.toString() ?? "");

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="positionId" value={positionId} />
      {/* 提交空值让 API 保持原 prompt 不变 */}
      <input type="hidden" name="positivePrompt" value="" />
      <input type="hidden" name="negativePrompt" value="" />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">运行参数</div>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[11px] text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
            {pending ? "保存中…" : "保存参数"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">画幅比例</div>
            <AspectRatioPicker
              name="aspectRatio"
              defaultValue={initialParams.aspectRatio}
              defaultShortSidePx={initialParams.shortSidePx}
              disabled={pending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="text-[11px] text-zinc-500">Batch Size</div>
              <input
                name="batchSize"
                type="number"
                min={1}
                disabled={pending}
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                placeholder="默认"
                className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70"
              />
              <BatchSizeQuickFill
                onSelect={(val) => setBatchSize(String(val))}
                currentValue={batchSize ? parseInt(batchSize, 10) : null}
                disabled={pending}
                size="sm"
              />
            </div>
            <label className="space-y-1.5">
              <div className="text-[11px] text-zinc-500">Seed 策略</div>
              <select
                name="seedPolicy"
                disabled={pending}
                defaultValue={initialParams.seedPolicy ?? ""}
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-70"
              >
                <option value="">默认</option>
                <option value="random">随机 (random)</option>
                <option value="fixed">固定 (fixed)</option>
              </select>
            </label>
          </div>
        </div>

        {state.status !== "idle" && (
          <p
            className={`rounded-xl border px-3 py-1.5 text-[11px] leading-5 ${
              state.status === "error"
                ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

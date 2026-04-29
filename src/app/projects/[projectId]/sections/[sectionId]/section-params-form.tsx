"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import { saveSectionEditAction } from "@/app/projects/actions";
import { initialProjectSaveState } from "@/app/projects/action-types";
import { AspectRatioPicker } from "@/components/aspect-ratio-picker";
import { KSamplerPanel, parseInitialKSampler } from "@/components/ksampler-panel";
import type { KSamplerParams } from "@/lib/lora-types";
import { DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2 } from "@/lib/lora-types";
import { CheckpointCascadePicker } from "@/components/checkpoint-cascade-picker";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Debounce delay for auto-save (ms) */
const AUTO_SAVE_DELAY = 600;

// ---------------------------------------------------------------------------
// Main Form
// ---------------------------------------------------------------------------

type SectionParamsFormProps = {
  projectId: string;
  sectionId: string;
  initialParams: {
    batchSize: number | null;
    aspectRatio: string | null;
    shortSidePx: number | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    ksampler1: unknown;
    ksampler2: unknown;
    upscaleFactor: number | null;
    checkpointName: string | null;
    projectCheckpointName: string | null;
  };
};

export function SectionParamsForm({ projectId, sectionId, initialParams }: SectionParamsFormProps) {
  const [state, formAction, pending] = useActionState(saveSectionEditAction, initialProjectSaveState);
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ks1, setKs1] = useState<KSamplerParams>(() =>
    parseInitialKSampler(initialParams.ksampler1, DEFAULT_KSAMPLER1),
  );
  const [ks2, setKs2] = useState<KSamplerParams>(() =>
    parseInitialKSampler(initialParams.ksampler2, DEFAULT_KSAMPLER2),
  );
  const [upscaleFactor, setUpscaleFactor] = useState<string>(
    String(initialParams.upscaleFactor ?? 2),
  );
  const [checkpointName, setCheckpointName] = useState(initialParams.checkpointName ?? "");

  // Auto-save: debounced form submit
  const scheduleAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      formRef.current?.requestSubmit();
    }, AUTO_SAVE_DELAY);
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sectionId" value={sectionId} />
      {/* 提交空值让 API 保持原 prompt 不变 */}
      <input type="hidden" name="positivePrompt" value="" />
      <input type="hidden" name="negativePrompt" value="" />
      {/* KSampler params as JSON */}
      <input type="hidden" name="ksampler1" value={JSON.stringify(ks1)} />
      <input type="hidden" name="ksampler2" value={JSON.stringify(ks2)} />
      <input type="hidden" name="upscaleFactor" value={upscaleFactor} />
      <input type="hidden" name="checkpointName" value={checkpointName} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">运行参数</div>
          {pending && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Loader2 className="size-3 animate-spin" />
              保存中…
            </span>
          )}
          {!pending && state.status === "success" && (
            <span className="text-[11px] text-emerald-400/70">已保存</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-zinc-500">Checkpoint</div>
            {checkpointName && (
              <button
                type="button"
                onClick={() => {
                  setCheckpointName("");
                  setTimeout(scheduleAutoSave, 0);
                }}
                disabled={pending}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
              >
                继承项目
              </button>
            )}
          </div>
          <CheckpointCascadePicker
            value={checkpointName || initialParams.projectCheckpointName || ""}
            onChange={(value) => {
              setCheckpointName(value);
              setTimeout(scheduleAutoSave, 0);
            }}
            disabled={pending}
            placeholder={initialParams.projectCheckpointName ? `继承项目：${initialParams.projectCheckpointName}` : "选择 checkpoint…"}
          />
          {!checkpointName && initialParams.projectCheckpointName && (
            <p className="text-[10px] text-zinc-600">当前继承项目 checkpoint</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,auto)_minmax(10rem,15rem)] md:items-end md:justify-start">
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">画幅比例</div>
            <AspectRatioPicker
              name="aspectRatio"
              defaultValue={initialParams.aspectRatio}
              defaultShortSidePx={initialParams.shortSidePx}
              disabled={pending}
              onChange={scheduleAutoSave}
            />
          </div>

          <div className="max-w-[15rem] space-y-1.5">
            <div className="text-[11px] text-zinc-500">放大倍数</div>
            <input
              type="number"
              min={1}
              max={4}
              step={0.5}
              value={upscaleFactor}
              onChange={(v) => {
                setUpscaleFactor(v.target.value);
                setTimeout(scheduleAutoSave, 0);
              }}
              disabled={pending}
              className="input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-sky-500/30 disabled:opacity-50"
            />
            <UpscaleFactorQuickFill
              onSelect={(val) => {
                setUpscaleFactor(String(val));
                setTimeout(scheduleAutoSave, 0);
              }}
              currentValue={upscaleFactor ? parseFloat(upscaleFactor) : null}
              disabled={pending}
              size="sm"
            />
            {upscaleFactor === "1" && (
              <p className="text-[10px] text-amber-400/70">
                1x 模式将跳过 Upscale Latent 和 KSampler2（无高清修复）
              </p>
            )}
          </div>
        </div>

          {/* KSampler panels */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <KSamplerPanel
              label="KSampler1（第一阶段）"
              subtitle={`steps ${ks1.steps ?? DEFAULT_KSAMPLER1.steps} · cfg ${ks1.cfg ?? DEFAULT_KSAMPLER1.cfg} · ${ks1.sampler_name ?? DEFAULT_KSAMPLER1.sampler_name}`}
              params={ks1}
              defaults={DEFAULT_KSAMPLER1}
              onChange={setKs1}
              onFieldBlur={scheduleAutoSave}
              disabled={pending}
            />
            <KSamplerPanel
              label="KSampler2（高清修复）"
              subtitle={upscaleFactor === "1" ? "1x 模式下不使用" : `steps ${ks2.steps ?? DEFAULT_KSAMPLER2.steps} · cfg ${ks2.cfg ?? DEFAULT_KSAMPLER2.cfg} · ${ks2.sampler_name ?? DEFAULT_KSAMPLER2.sampler_name}`}
              params={ks2}
              defaults={DEFAULT_KSAMPLER2}
              onChange={setKs2}
              onFieldBlur={scheduleAutoSave}
              disabled={pending || upscaleFactor === "1"}
            />
          </div>

        {state.status === "error" && (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] leading-5 text-rose-200">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

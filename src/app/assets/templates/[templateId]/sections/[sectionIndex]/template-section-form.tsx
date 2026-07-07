"use client";

import { AspectRatioPicker } from "@/components/aspect-ratio-picker";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { CheckpointCascadePicker } from "@/components/checkpoint-cascade-picker";
import { KSamplerPanel } from "@/components/ksampler-panel";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import { DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2, type KSamplerParams } from "@/lib/lora-types";

type TemplateSectionFormProps = {
  name: string;
  notes: string;
  aspectRatio: string | null;
  aspectRatios: string[] | null;
  shortSidePx: number | null;
  batchSize: string | null;
  upscaleFactor: string | null;
  useTwoStageKSampler: boolean;
  checkpointName: string | null;
  ks1: KSamplerParams | null;
  ks2: KSamplerParams | null;
  isPending: boolean;
  onNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAspectRatiosChange: (value: string[] | null) => void;
  onShortSidePxChange: (value: number | null) => void;
  onBatchSizeChange: (value: string | null) => void;
  onUpscaleFactorChange: (value: string | null) => void;
  onUseTwoStageKSamplerChange: (value: boolean) => void;
  onCheckpointNameChange: (value: string | null) => void;
  onKSampler1Change: (value: KSamplerParams | null) => void;
  onKSampler2Change: (value: KSamplerParams | null) => void;
  onSaveNow: () => void;
  onScheduleSaveAfterState: () => void;
};

const inputCls =
  "input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70";

export function TemplateSectionForm({
  name,
  notes,
  aspectRatio,
  aspectRatios,
  shortSidePx,
  batchSize,
  upscaleFactor,
  useTwoStageKSampler,
  checkpointName,
  ks1,
  ks2,
  isPending,
  onNameChange,
  onNotesChange,
  onAspectRatiosChange,
  onShortSidePxChange,
  onBatchSizeChange,
  onUpscaleFactorChange,
  onUseTwoStageKSamplerChange,
  onCheckpointNameChange,
  onKSampler1Change,
  onKSampler2Change,
  onSaveNow,
  onScheduleSaveAfterState,
}: TemplateSectionFormProps) {
  return (
    <>
      <div className="space-y-2 border-t border-white/5 pt-3">
        <label className="text-xs text-zinc-500">小节名称</label>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onBlur={onSaveNow}
          placeholder="小节名称"
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        <label className="text-xs text-zinc-500">备注</label>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onBlur={onSaveNow}
          placeholder="给这个模板小节添加备注"
          rows={3}
          className="cm-text-editor cm-text-editor--compact min-h-20 w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm leading-5 text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30"
        />
      </div>

      <div className="space-y-3 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">运行参数</div>
          <div className="text-[10px] text-zinc-500">空值参数在导入时不会覆盖项目设置</div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] text-zinc-500">Checkpoint</div>
            {checkpointName !== null && (
              <button
                type="button"
                onClick={() => {
                  onCheckpointNameChange(null);
                  onScheduleSaveAfterState();
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                清除
              </button>
            )}
          </div>
          {checkpointName === null ? (
            <button
              type="button"
              onClick={() => {
                onCheckpointNameChange("");
              }}
              className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
            >
              点击设置
            </button>
          ) : (
            <CheckpointCascadePicker
              value={checkpointName}
              onChange={(value) => {
                onCheckpointNameChange(value);
                onScheduleSaveAfterState();
              }}
              disabled={isPending}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">画幅比例</div>
              {aspectRatio !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onAspectRatiosChange(null);
                    onShortSidePxChange(null);
                    onScheduleSaveAfterState();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {aspectRatio === null ? (
              <button
                type="button"
                onClick={() => {
                  onAspectRatiosChange(["2:3"]);
                  onShortSidePxChange(512);
                  onScheduleSaveAfterState();
                }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <AspectRatioPicker
                name="aspectRatio"
                defaultValue={aspectRatio}
                defaultValues={aspectRatios}
                defaultShortSidePx={shortSidePx}
                disabled={isPending}
                multiple
                onChange={onSaveNow}
                onValueChange={(ratio, px, ratios) => {
                  onAspectRatiosChange(ratios.length > 0 ? ratios : (ratio ? [ratio] : null));
                  onShortSidePxChange(px);
                  onScheduleSaveAfterState();
                }}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">Batch Size</div>
              {batchSize !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onBatchSizeChange(null);
                    onScheduleSaveAfterState();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {batchSize === null ? (
              <button
                type="button"
                onClick={() => {
                  onBatchSizeChange("");
                  onScheduleSaveAfterState();
                }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  disabled={isPending}
                  value={batchSize}
                  onChange={(event) => onBatchSizeChange(event.target.value || null)}
                  onBlur={onSaveNow}
                  placeholder="不设置"
                  className={inputCls}
                />
                <BatchSizeQuickFill
                  onSelect={(value) => {
                    onBatchSizeChange(String(value));
                    onScheduleSaveAfterState();
                  }}
                  currentValue={batchSize ? parseInt(batchSize, 10) : null}
                  disabled={isPending}
                  size="sm"
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">放大倍数</div>
              {upscaleFactor !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onUpscaleFactorChange(null);
                    onScheduleSaveAfterState();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {upscaleFactor === null ? (
              <button
                type="button"
                onClick={() => {
                  onUpscaleFactorChange("2");
                  onScheduleSaveAfterState();
                }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  max={4}
                  step={0.5}
                  value={upscaleFactor}
                  onChange={(event) => onUpscaleFactorChange(event.target.value || null)}
                  onBlur={onSaveNow}
                  disabled={isPending}
                  className={inputCls}
                />
                <UpscaleFactorQuickFill
                  onSelect={(value) => {
                    onUpscaleFactorChange(String(value));
                    onScheduleSaveAfterState();
                  }}
                  currentValue={upscaleFactor ? parseFloat(upscaleFactor) : null}
                  disabled={isPending}
                  size="sm"
                />
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-pressed={useTwoStageKSampler}
          disabled={isPending}
          onClick={() => {
            onUseTwoStageKSamplerChange(!useTwoStageKSampler);
            onScheduleSaveAfterState();
          }}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          <span className="min-w-0">
            <span className="block text-xs font-medium text-zinc-200">使用二阶段 KSampler</span>
            <span className="block truncate text-[11px] text-zinc-500">
              {useTwoStageKSampler ? "Upscale Latent + KSampler2" : "一阶段直接生成最终尺寸"}
            </span>
          </span>
          <span
            className={`relative h-5 w-10 rounded-full border transition ${
              useTwoStageKSampler
                ? "border-sky-400/40 bg-sky-400/25"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <span
              className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full bg-white transition ${
                useTwoStageKSampler ? "left-5" : "left-1"
              }`}
            />
          </span>
        </button>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">KSampler1（第一阶段）</div>
              {ks1 !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onKSampler1Change(null);
                    onScheduleSaveAfterState();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {ks1 === null ? (
              <button
                type="button"
                onClick={() => {
                  onKSampler1Change({ ...DEFAULT_KSAMPLER1 });
                  onScheduleSaveAfterState();
                }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <KSamplerPanel
                label=""
                subtitle={`steps ${ks1.steps ?? DEFAULT_KSAMPLER1.steps} · cfg ${ks1.cfg ?? DEFAULT_KSAMPLER1.cfg} · ${ks1.sampler_name ?? DEFAULT_KSAMPLER1.sampler_name}`}
                params={ks1}
                defaults={DEFAULT_KSAMPLER1}
                onChange={onKSampler1Change}
                onFieldBlur={onSaveNow}
                disabled={isPending}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">KSampler2（高清修复）</div>
              {ks2 !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onKSampler2Change(null);
                    onScheduleSaveAfterState();
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {ks2 === null ? (
              <button
                type="button"
                onClick={() => {
                  onKSampler2Change({ ...DEFAULT_KSAMPLER2 });
                  onScheduleSaveAfterState();
                }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <KSamplerPanel
                label=""
                subtitle={!useTwoStageKSampler ? "单阶段模式下不使用" : `steps ${ks2.steps ?? DEFAULT_KSAMPLER2.steps} · cfg ${ks2.cfg ?? DEFAULT_KSAMPLER2.cfg} · ${ks2.sampler_name ?? DEFAULT_KSAMPLER2.sampler_name}`}
                params={ks2}
                defaults={DEFAULT_KSAMPLER2}
                onChange={onKSampler2Change}
                onFieldBlur={onSaveNow}
                disabled={isPending || !useTwoStageKSampler}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

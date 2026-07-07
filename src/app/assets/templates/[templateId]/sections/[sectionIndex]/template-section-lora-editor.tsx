"use client";

import { LoraListEditor } from "@/components/lora-list-editor";
import type { LoraEntry } from "@/lib/lora-types";

export type TemplateSectionLoraConfig = {
  lora1: LoraEntry[];
  lora2: LoraEntry[];
};

export type TemplateSectionLoraBindingSummary = {
  bindingId: string;
  presetName: string;
  blockCount: number;
  loraCount: number;
};

export function TemplateSectionLoraEditor({
  loraConfig,
  onLora1Change,
  onLora2Change,
  presetBindings,
}: {
  loraConfig: TemplateSectionLoraConfig;
  onLora1Change: (entries: LoraEntry[]) => void;
  onLora2Change: (entries: LoraEntry[]) => void;
  presetBindings: TemplateSectionLoraBindingSummary[];
}) {
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <div className="text-xs font-medium text-zinc-400">LoRA 配置</div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-sky-400">LoRA 1</div>
          <LoraListEditor
            entries={loraConfig.lora1}
            onChange={onLora1Change}
            presetBindings={presetBindings}
            enableStandaloneDelete
          />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-medium text-violet-400">LoRA 2</div>
          <LoraListEditor
            entries={loraConfig.lora2}
            onChange={onLora2Change}
            presetBindings={presetBindings}
            enableStandaloneDelete
          />
        </div>
      </div>
    </div>
  );
}

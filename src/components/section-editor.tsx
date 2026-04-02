"use client";

import { useState, useTransition } from "react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import type { LoraEntry } from "@/lib/lora-types";
import type { PromptLibraryV2 } from "@/components/prompt-block-editor";
import {
  parseLoraBindings,
  generateLoraEntryId,
} from "@/lib/lora-types";

/** 2-partition LoRA config (lora1 + lora2 only) */
type LoraConfig2 = {
  lora1: LoraEntry[];
  lora2: LoraEntry[];
};

type SectionEditorProps = {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  /** v0.4: loraConfig with lora1, lora2 */
  initialLoraConfig: LoraConfig2;
  libraryV2?: PromptLibraryV2;
  onLoraChange: (config: LoraConfig2) => Promise<void>;
};

export function SectionEditor({
  sectionId,
  initialBlocks,
  initialLoraConfig,
  libraryV2,
  onLoraChange,
}: SectionEditorProps) {
  const [lora1, setLora1] = useState<LoraEntry[]>(initialLoraConfig.lora1);
  const [lora2, setLora2] = useState<LoraEntry[]>(initialLoraConfig.lora2);
  const [isPending, startTransition] = useTransition();

  // 当从预制库导入时，自动添加关联的 LoRA
  function handleBlockImport(
    _sourceType: string,
    _sourceId: string,
    sourceName: string,
    lora1Bindings?: unknown,
    lora2Bindings?: unknown,
  ) {
    const sourceLabel = `${sourceName}`;

    let updatedLora1 = [...lora1];
    let updatedLora2 = [...lora2];
    let changed = false;

    // Import lora1Bindings into lora1
    if (lora1Bindings) {
      const bindings = parseLoraBindings(lora1Bindings);
      for (const binding of bindings) {
        if (!binding.path) continue;
        const exists = updatedLora1.some((e) => e.path === binding.path);
        if (!exists) {
          updatedLora1.push({
            id: generateLoraEntryId(),
            path: binding.path,
            weight: binding.weight,
            enabled: binding.enabled,
            source: "manual",
            sourceLabel,
          });
          changed = true;
        }
      }
    }

    // Import lora2Bindings into lora2
    if (lora2Bindings) {
      const bindings = parseLoraBindings(lora2Bindings);
      for (const binding of bindings) {
        if (!binding.path) continue;
        const exists = updatedLora2.some((e) => e.path === binding.path);
        if (!exists) {
          updatedLora2.push({
            id: generateLoraEntryId(),
            path: binding.path,
            weight: binding.weight,
            enabled: binding.enabled,
            source: "manual",
            sourceLabel,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      setLora1(updatedLora1);
      setLora2(updatedLora2);
      startTransition(async () => {
        await onLoraChange({
          lora1: updatedLora1,
          lora2: updatedLora2,
        });
      });
    }
  }

  function handleLora1Change(entries: LoraEntry[]) {
    setLora1(entries);
    startTransition(async () => {
      await onLoraChange({
        lora1: entries,
        lora2,
      });
    });
  }

  function handleLora2Change(entries: LoraEntry[]) {
    setLora2(entries);
    startTransition(async () => {
      await onLoraChange({
        lora1,
        lora2: entries,
      });
    });
  }

  return (
    <div className="space-y-4">
      <PromptBlockEditor
        sectionId={sectionId}
        initialBlocks={initialBlocks}
        libraryV2={libraryV2}
        onBlockImport={handleBlockImport}
      />

      <div className="border-t border-white/5 pt-4 space-y-4">
        {/* LoRA 1（可编辑） */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 1</div>
          <LoraListEditor
            entries={lora1}
            onChange={handleLora1Change}
            disabled={isPending}
          />
        </div>

        {/* LoRA 2（可编辑） */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 2</div>
          <LoraListEditor
            entries={lora2}
            onChange={handleLora2Change}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}

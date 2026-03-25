"use client";

import { useState, useTransition } from "react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import type { LoraEntry, LoraSource } from "@/lib/lora-types";
import type { PromptLibrary } from "@/lib/server-data";
import {
  parseLoraBindings,
  parsePositionLoraConfig,
  serializePositionLoraConfig,
  generateLoraEntryId,
} from "@/lib/lora-types";

type SectionEditorProps = {
  positionId: string;
  initialBlocks: PromptBlockData[];
  initialLoraEntries: LoraEntry[];
  library: PromptLibrary;
  loraOptions: { value: string; label: string }[];
  onLoraChange: (entries: LoraEntry[]) => Promise<void>;
};

export function SectionEditor({
  positionId,
  initialBlocks,
  initialLoraEntries,
  library,
  loraOptions,
  onLoraChange,
}: SectionEditorProps) {
  const [loraEntries, setLoraEntries] = useState<LoraEntry[]>(initialLoraEntries);
  const [isPending, startTransition] = useTransition();

  // 当从词库导入时，自动添加关联的 LoRA
  function handleBlockImport(
    sourceType: LoraSource,
    sourceId: string,
    sourceName: string,
    loraPath?: string | null,
    loraBindings?: unknown,
  ) {
    const newEntries: LoraEntry[] = [];
    const sourceLabels: Record<LoraSource, string> = {
      character: `角色: ${sourceName}`,
      scene: `场景: ${sourceName}`,
      style: `风格: ${sourceName}`,
      position: `Position: ${sourceName}`,
      manual: "",
    };

    // 首先检查 loraBindings（所有类型都可能有）
    if (loraBindings) {
      const bindings = parseLoraBindings(loraBindings);
      for (const binding of bindings) {
        if (!binding.path) continue;
        // 检查是否已存在相同路径的 LoRA
        const exists = loraEntries.some((e) => e.path === binding.path) ||
                       newEntries.some((e) => e.path === binding.path);
        if (!exists) {
          newEntries.push({
            id: generateLoraEntryId(),
            path: binding.path,
            weight: binding.weight,
            enabled: binding.enabled,
            source: sourceType,
            sourceLabel: sourceLabels[sourceType],
          });
        }
      }
    }
    
    // Character 的 loraPath 作为后备（向后兼容，如果 loraBindings 为空）
    if (sourceType === "character" && loraPath && newEntries.length === 0) {
      const exists = loraEntries.some((e) => e.path === loraPath);
      if (!exists) {
        newEntries.push({
          id: generateLoraEntryId(),
          path: loraPath,
          weight: 1.0,
          enabled: true,
          source: "character",
          sourceLabel: sourceLabels.character,
        });
      }
    }

    if (newEntries.length > 0) {
      const updated = [...loraEntries, ...newEntries];
      setLoraEntries(updated);
      startTransition(async () => {
        await onLoraChange(updated);
      });
    }
  }

  function handleLoraEntriesChange(entries: LoraEntry[]) {
    setLoraEntries(entries);
    startTransition(async () => {
      await onLoraChange(entries);
    });
  }

  return (
    <div className="space-y-4">
      <PromptBlockEditor
        positionId={positionId}
        initialBlocks={initialBlocks}
        library={library}
        onBlockImport={handleBlockImport}
      />
      
      <div className="border-t border-white/5 pt-4">
        <LoraListEditor
          entries={loraEntries}
          onChange={handleLoraEntriesChange}
          loraOptions={loraOptions}
          disabled={isPending}
        />
      </div>
    </div>
  );
}

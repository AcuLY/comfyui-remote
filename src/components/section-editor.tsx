"use client";

import { useState, useTransition } from "react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import type { LoraEntry, LoraSource, PositionLoraConfig } from "@/lib/lora-types";
import type { PromptLibrary } from "@/lib/server-data";
import {
  parseLoraBindings,
  generateLoraEntryId,
} from "@/lib/lora-types";

type SectionEditorProps = {
  positionId: string;
  initialBlocks: PromptBlockData[];
  /** v0.3: Full loraConfig with characterLora, lora1, lora2 */
  initialLoraConfig: PositionLoraConfig;
  library: PromptLibrary;
  loraOptions: { value: string; label: string }[];
  onLoraChange: (config: PositionLoraConfig) => Promise<void>;
};

export function SectionEditor({
  positionId,
  initialBlocks,
  initialLoraConfig,
  library,
  loraOptions,
  onLoraChange,
}: SectionEditorProps) {
  // v0.3: Separate state for each LoRA section
  const [characterLora, setCharacterLora] = useState<LoraEntry[]>(initialLoraConfig.characterLora);
  const [lora1, setLora1] = useState<LoraEntry[]>(initialLoraConfig.lora1);
  const [lora2, setLora2] = useState<LoraEntry[]>(initialLoraConfig.lora2);
  const [isPending, startTransition] = useTransition();

  // 当从词库导入时，自动添加关联的 LoRA
  function handleBlockImport(
    sourceType: LoraSource,
    sourceId: string,
    sourceName: string,
    loraPath?: string | null,
    loraBindings?: unknown,
    lora1Bindings?: unknown,
    lora2Bindings?: unknown,
  ) {
    const sourceLabels: Record<LoraSource, string> = {
      character: `角色: ${sourceName}`,
      scene: `场景: ${sourceName}`,
      style: `风格: ${sourceName}`,
      position: `Position: ${sourceName}`,
      manual: "",
    };

    let updatedCharacterLora = [...characterLora];
    let updatedLora1 = [...lora1];
    let updatedLora2 = [...lora2];
    let changed = false;

    // Character 的主 LoRA 和 loraBindings 都进入 characterLora
    if (sourceType === "character") {
      // 主 loraPath
      if (loraPath) {
        const exists = updatedCharacterLora.some((e) => e.path === loraPath);
        if (!exists) {
          updatedCharacterLora.push({
            id: generateLoraEntryId(),
            path: loraPath,
            weight: 1.0,
            enabled: true,
            source: "character",
            sourceLabel: sourceLabels.character,
          });
          changed = true;
        }
      }
      // Character 的扩展 loraBindings
      if (loraBindings) {
        const bindings = parseLoraBindings(loraBindings);
        for (const binding of bindings) {
          if (!binding.path) continue;
          const exists = updatedCharacterLora.some((e) => e.path === binding.path);
          if (!exists) {
            updatedCharacterLora.push({
              id: generateLoraEntryId(),
              path: binding.path,
              weight: binding.weight,
              enabled: binding.enabled,
              source: "character",
              sourceLabel: sourceLabels.character,
            });
            changed = true;
          }
        }
      }
    }

    // Position 模板的 lora1 和 lora2
    if (sourceType === "position") {
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
              source: "position",
              sourceLabel: sourceLabels.position,
            });
            changed = true;
          }
        }
      }
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
              source: "position",
              sourceLabel: sourceLabels.position,
            });
            changed = true;
          }
        }
      }
    }

    if (changed) {
      setCharacterLora(updatedCharacterLora);
      setLora1(updatedLora1);
      setLora2(updatedLora2);
      startTransition(async () => {
        await onLoraChange({
          characterLora: updatedCharacterLora,
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
        characterLora,
        lora1: entries,
        lora2,
      });
    });
  }

  function handleLora2Change(entries: LoraEntry[]) {
    setLora2(entries);
    startTransition(async () => {
      await onLoraChange({
        characterLora,
        lora1,
        lora2: entries,
      });
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
      
      <div className="border-t border-white/5 pt-4 space-y-4">
        {/* v0.3: 角色 LoRA（只读） */}
        {characterLora.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">角色 LoRA（只读）</div>
            <LoraListEditor
              entries={characterLora}
              onChange={() => {}} // 只读
              loraOptions={[]}
              disabled={true}
              readOnly={true}
            />
          </div>
        )}
        
        {/* v0.3: LoRA 1（可编辑） */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 1</div>
          <LoraListEditor
            entries={lora1}
            onChange={handleLora1Change}
            loraOptions={loraOptions}
            disabled={isPending}
          />
        </div>
        
        {/* v0.3: LoRA 2（可编辑） */}
        <div>
          <div className="mb-2 text-xs font-medium text-zinc-400">LoRA 2</div>
          <LoraListEditor
            entries={lora2}
            onChange={handleLora2Change}
            loraOptions={loraOptions}
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  );
}

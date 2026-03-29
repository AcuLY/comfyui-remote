"use client";

import { useState, useTransition } from "react";
import { PromptBlockEditor } from "@/components/prompt-block-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import type { PromptBlockData } from "@/lib/actions";
import type { LoraEntry, LoraSource, PositionLoraConfig } from "@/lib/lora-types";
import type { PromptLibraryV2 } from "@/components/prompt-block-editor";
import {
  parseLoraBindings,
  generateLoraEntryId,
} from "@/lib/lora-types";

type SectionEditorProps = {
  sectionId: string;
  initialBlocks: PromptBlockData[];
  /** v0.3: Full loraConfig with characterLora, lora1, lora2 */
  initialLoraConfig: PositionLoraConfig;
  libraryV2?: PromptLibraryV2;
  onLoraChange: (config: PositionLoraConfig) => Promise<void>;
};

export function SectionEditor({
  sectionId,
  initialBlocks,
  initialLoraConfig,
  libraryV2,
  onLoraChange,
}: SectionEditorProps) {
  // v0.3: Separate state for each LoRA section
  const [characterLora, setCharacterLora] = useState<LoraEntry[]>(initialLoraConfig.characterLora);
  const [lora1, setLora1] = useState<LoraEntry[]>(initialLoraConfig.lora1);
  const [lora2, setLora2] = useState<LoraEntry[]>(initialLoraConfig.lora2);
  const [isPending, startTransition] = useTransition();

  // 当从词库导入时，自动添加关联的 LoRA
  function handleBlockImport(
    sourceType: LoraSource | string,
    sourceId: string,
    sourceName: string,
    loraPath?: string | null,
    loraBindings?: unknown,
    lora1Bindings?: unknown,
    lora2Bindings?: unknown,
  ) {
    const sourceLabel = `${sourceName}`;

    let updatedCharacterLora = [...characterLora];
    let updatedLora1 = [...lora1];
    let updatedLora2 = [...lora2];
    let changed = false;

    // Import loraBindings (legacy character path) into lora1
    if (loraPath) {
      const existsInAny = updatedCharacterLora.some((e) => e.path === loraPath)
        || updatedLora1.some((e) => e.path === loraPath);
      if (!existsInAny) {
        updatedLora1.push({
          id: generateLoraEntryId(),
          path: loraPath,
          weight: 1.0,
          enabled: true,
          source: (sourceType === "character" || sourceType === "scene" || sourceType === "style" || sourceType === "position" || sourceType === "manual") ? sourceType as LoraSource : "manual",
          sourceLabel,
        });
        changed = true;
      }
    }
    if (loraBindings) {
      const bindings = parseLoraBindings(loraBindings);
      for (const binding of bindings) {
        if (!binding.path) continue;
        const existsInAny = updatedCharacterLora.some((e) => e.path === binding.path)
          || updatedLora1.some((e) => e.path === binding.path);
        if (!existsInAny) {
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

  function handleCharacterLoraChange(entries: LoraEntry[]) {
    setCharacterLora(entries);
    startTransition(async () => {
      await onLoraChange({
        characterLora: entries,
        lora1,
        lora2,
      });
    });
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
        sectionId={sectionId}
        initialBlocks={initialBlocks}
        libraryV2={libraryV2}
        onBlockImport={handleBlockImport}
      />
      
      <div className="border-t border-white/5 pt-4 space-y-4">
        {/* v0.3: 角色 LoRA（不可删除，可调权重） */}
        {characterLora.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium text-zinc-500">角色 LoRA（不可删除）</div>
            <LoraListEditor
              entries={characterLora}
              onChange={handleCharacterLoraChange}
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
            disabled={isPending}
          />
        </div>

        {/* v0.3: LoRA 2（可编辑） */}
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

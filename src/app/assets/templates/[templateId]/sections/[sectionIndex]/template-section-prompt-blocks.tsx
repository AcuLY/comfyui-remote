"use client";

import { TemplatePromptBlockEditor } from "@/components/template-prompt-block-editor";
import type { TemplateBlockData } from "@/components/template-prompt-block-editor";

export type { TemplateBlockData } from "@/components/template-prompt-block-editor";

export type TemplateSectionPromptCategoryConfig = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

export function TemplateSectionPromptBlocks({
  blocks,
  onChange,
  onDetachBinding,
  categoryMap,
}: {
  blocks: TemplateBlockData[];
  onChange: (blocks: TemplateBlockData[]) => void;
  onDetachBinding: (bindingId: string) => void;
  categoryMap: Map<string, TemplateSectionPromptCategoryConfig>;
}) {
  return (
    <div className="space-y-3 border-t border-white/5 pt-3">
      <div className="text-xs font-medium text-zinc-400">Prompt Blocks</div>
      <TemplatePromptBlockEditor
        blocks={blocks}
        onChange={onChange}
        onDetachBinding={onDetachBinding}
        categoryMap={categoryMap}
      />
    </div>
  );
}

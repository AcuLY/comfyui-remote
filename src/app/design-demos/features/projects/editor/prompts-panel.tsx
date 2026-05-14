"use client";

import { Plus } from "lucide-react";

import { cx } from "../../../routing";
import {
  CompiledPromptPreview,
  PromptBlockRow,
} from "./editor-parts";
import s from "./prompts-panel.editor.module.css";
import type { SectionEditorModel } from "./use-section-editor-state";

export function PromptsPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={cx(s.sectionTabBody, s.promptTabBody)}>
      <div className={s.tabPanelHeader}>
        <div className={s.tabPanelTitle}>
          <h3>提示词块</h3>
          <span>{editor.promptBlocks.length} 块 · 支持拖动排序</span>
        </div>
      </div>
      <div className={s.promptTwoColumn}>
        <div>
          <div className={s.pbColumnHead}>
            <h4>正向</h4>
          </div>
          <div className={s.pbList}>
            {editor.promptBlocks
              .filter(
                (block) =>
                  block.positive.trim().length > 0 ||
                  editor.expandedBlockKey === `positive:${block.id}`,
              )
              .map((block) => (
                <PromptBlockRow
                  key={`pos-${block.id}`}
                  block={block}
                  expanded={editor.expandedBlockKey === `positive:${block.id}`}
                  column="positive"
                  onToggle={() => editor.togglePromptBlock("positive", block.id)}
                  onPositiveChange={(value) => editor.updatePromptPositive(block.id, value)}
                  onUnlink={() => editor.unlinkPromptBlock(block.id)}
                  onDelete={() => editor.deletePromptBlock(block.id)}
                />
              ))}
          </div>
        </div>
        <div>
          <div className={s.pbColumnHead}>
            <h4>负向</h4>
          </div>
          <div className={s.pbList}>
            {editor.promptBlocks
              .filter(
                (block) =>
                  block.negative.trim().length > 0 ||
                  editor.expandedBlockKey === `negative:${block.id}`,
              )
              .map((block) => (
                <PromptBlockRow
                  key={`neg-${block.id}`}
                  block={block}
                  expanded={editor.expandedBlockKey === `negative:${block.id}`}
                  column="negative"
                  onToggle={() => editor.togglePromptBlock("negative", block.id)}
                  onNegativeChange={(value) => editor.updatePromptNegative(block.id, value)}
                  onUnlink={() => editor.unlinkPromptBlock(block.id)}
                  onDelete={() => editor.deletePromptBlock(block.id)}
                />
              ))}
          </div>
        </div>
      </div>
      <div className={s.addRow}>
        <button type="button" onClick={editor.addPromptBlock}>
          <Plus className={s.iconMd} />
          新增自定义 Block
        </button>
      </div>
      <CompiledPromptPreview groups={editor.compiledPromptGroups} />
    </div>
  );
}

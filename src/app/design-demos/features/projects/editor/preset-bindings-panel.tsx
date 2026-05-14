"use client";

import { Check, Plus } from "lucide-react";

import {
  PresetBindingRow,
  PresetImportInline,
} from "./editor-parts";
import s from "./preset-bindings-panel.module.css";
import type { SectionEditorModel } from "./use-section-editor-state";

export function PresetsPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <div className={s.tabPanelHeader}>
        <div className={s.tabPanelTitle}>
          <h3>已绑定的预制</h3>
          <span>{editor.bindings.length} 项（含项目级与小节级）</span>
        </div>
        <div className={s.tabPanelSpacer} />
        <div className={s.importHeaderActions}>
          {editor.importOpen ? (
            <>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() => {
                  editor.setImportOpen(false);
                  editor.setImportSelection(null);
                }}
              >
                收起
              </button>
              <button
                type="button"
                className={s.btnPrimary}
                disabled={!editor.importSelection}
                onClick={() => {
                  if (!editor.importSelection) return;
                  editor.commitPresetImport(editor.importSelection);
                  editor.setImportSelection(null);
                  editor.setImportOpen(false);
                }}
              >
                <Check className={s.iconMd} />
                确认
              </button>
            </>
          ) : (
            <button
              type="button"
              className={s.btnPrimary}
              onClick={() => editor.setImportOpen(true)}
            >
              <Plus className={s.iconMd} />
              导入预制
            </button>
          )}
        </div>
      </div>

      <PresetImportInline
        open={editor.importOpen}
        categories={editor.importCategories}
        selected={editor.importSelection}
        onSelect={editor.setImportSelection}
      />

      {editor.bindings.length === 0 ? (
        <div className={s.bindEmpty}>
          <b>该小节还没有预制绑定</b>
          <span>你可以点击「导入预制」添加预制或预制组，变更会生效到所有运行任务。</span>
        </div>
      ) : (
        <div className={s.bindList}>
          {editor.bindings.map((binding) => (
            <PresetBindingRow
              key={binding.id}
              binding={binding}
              onVariantChange={editor.handleBindingVariantChange}
              onUnlink={editor.handleBindingUnlink}
              onDelete={editor.handleBindingDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import s from "../styles/section-editor.module.css";
import { LoraColumn } from "../section-editor-lora-column";
import type { SectionEditorModel } from "./use-section-editor-state";

export function LoraPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <div className={s.tabPanelHeader}>
        <div className={s.tabPanelTitle}>
          <h3>LoRA 配置</h3>
          <span>
            两段采样分别装载：LoRA 1 用于首次采样，LoRA 2 用于放大精修
          </span>
        </div>
      </div>
      <div className={s.loraPair}>
        <LoraColumn
          label="LoRA 1"
          entries={editor.lora1}
          onAdd={editor.addLora1}
          onWeight={editor.updateLora1Weight}
          onToggle={editor.toggleLora1}
          onPath={editor.updateLora1Path}
          onUnlink={editor.removeLora1}
          onDelete={editor.removeLora1}
        />
        <LoraColumn
          label="LoRA 2"
          entries={editor.lora2}
          onAdd={editor.addLora2}
          onWeight={editor.updateLora2Weight}
          onToggle={editor.toggleLora2}
          onPath={editor.updateLora2Path}
          onUnlink={editor.removeLora2}
          onDelete={editor.removeLora2}
        />
      </div>
    </div>
  );
}

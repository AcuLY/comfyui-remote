"use client";

import { Plus } from "lucide-react";

import s from "./design-demo-styles";
import { LORA_FILE_OPTIONS } from "./section-editor-page-data";
import { LoraRow, type LoraRowData } from "./section-editor-components";

export function LoraColumn({
  label,
  entries,
  onAdd,
  onWeight,
  onToggle,
  onPath,
  onUnlink,
  onDelete,
}: {
  label: string;
  entries: LoraRowData[];
  onAdd: () => void;
  onWeight: (id: string, w: number) => void;
  onToggle: (id: string) => void;
  onPath: (id: string, path: string) => void;
  onUnlink: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={s.loraColumn}>
      <div className={s.loraColumnHead}>
        <h4>{label}</h4>
        <span>{entries.length} 项</span>
      </div>
      {entries.length === 0 ? (
        <div className={s.bindEmpty}>
          <b>暂无 LoRA</b>
          <span>可从已导入预制中自动装载，或点击下方新增自定义。</span>
        </div>
      ) : (
        <div className={s.loraList}>
          {entries.map((entry) => (
            <LoraRow
              key={entry.id}
              entry={entry}
              fileOptions={LORA_FILE_OPTIONS}
              onWeightChange={(w) => onWeight(entry.id, w)}
              onToggle={() => onToggle(entry.id)}
              onPathChange={(p) => onPath(entry.id, p)}
              onUnlink={entry.kind === "preset" ? () => onUnlink(entry.id) : undefined}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </div>
      )}
      <div className={s.addRow}>
        <button type="button" onClick={onAdd}>
          <Plus className="size-4" />
          新增自定义 LoRA
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Mocks
// ----------------------------------------------------------------------------

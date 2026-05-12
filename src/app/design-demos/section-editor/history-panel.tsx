"use client";

import { cx } from "../design-demo-utils";
import {
  dimensionLabel,
  HistoryDiffRow,
} from "../section-editor-components";
import s from "./history-panel.section-editor.module.css";
import type { SectionEditorModel } from "./use-section-editor-state";

export function HistoryPanel({ editor }: { editor: SectionEditorModel }) {
  return (
    <div className={s.sectionTabBody}>
      <div className={s.tabPanelHeader}>
        <div className={s.tabPanelTitle}>
          <h3>变更记录</h3>
          <span>{editor.history.length} 条</span>
        </div>
        <div className={s.tabPanelSpacer} />
        <div className={s.resultsFilter}>
          {(
            [
              { k: "all" as const, label: `全部 ${editor.history.length}` },
              { k: "params" as const, label: `参数 ${editor.historyCounts.params ?? 0}` },
              { k: "preset" as const, label: `预制 ${editor.historyCounts.preset ?? 0}` },
              { k: "prompt" as const, label: `提示词 ${editor.historyCounts.prompt ?? 0}` },
              { k: "lora" as const, label: `LoRA ${editor.historyCounts.lora ?? 0}` },
            ]
          ).map((tab) => (
            <button
              key={tab.k}
              type="button"
              className={cx(
                s.resultsFilterBtn,
                editor.historyDim === tab.k && s.resultsFilterBtnActive,
              )}
              onClick={() => editor.setHistoryDim(tab.k)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {editor.filteredHistory.length === 0 ? (
        <div className={s.diffEmptyState}>
          暂无{editor.historyDim === "all" ? "" : dimensionLabel(editor.historyDim)}变更记录
        </div>
      ) : (
        <div className={s.diffList}>
          {editor.filteredHistory.map((change) => (
            <HistoryDiffRow key={change.id} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

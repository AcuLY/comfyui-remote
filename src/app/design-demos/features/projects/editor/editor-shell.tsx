"use client";

import { SectionTabs } from "./editor-parts";
import s from "./editor-shell.module.css";
import type { SectionEditorLoadedProps } from "./types";
import { HistoryPanel } from "./history-panel";
import { LightboxPreview } from "./lightbox-preview";
import { LoraPanel } from "./lora-panel";
import { ParamsPanel } from "./params-panel";
import { PresetsPanel } from "./preset-bindings-panel";
import { PromptsPanel } from "./prompts-panel";
import { ResultsPanel } from "./results-panel";
import { useSectionEditorState } from "./use-section-editor-state";

export function SectionEditorShell(props: SectionEditorLoadedProps) {
  const editor = useSectionEditorState(props);

  return (
    <div className={s.page}>
      <SectionTabs tabs={editor.tabs} value={editor.tab} onChange={editor.setTab} />

      {editor.tab === "params" ? <ParamsPanel editor={editor} /> : null}
      {editor.tab === "presets" ? <PresetsPanel editor={editor} /> : null}
      {editor.tab === "prompts" ? <PromptsPanel editor={editor} /> : null}
      {editor.tab === "lora" ? <LoraPanel editor={editor} /> : null}
      {editor.tab === "history" ? <HistoryPanel editor={editor} /> : null}
      {editor.tab === "results" ? <ResultsPanel editor={editor} /> : null}

      <LightboxPreview editor={editor} />
    </div>
  );
}

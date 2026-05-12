"use client";

import { SectionHeader, SectionTabs } from "../section-editor-components";
import { demoHref, rawSectionId } from "../design-demo-utils";
import s from "./section-editor-shell.section-editor.module.css";
import type { SectionEditorLoadedProps } from "./types";
import { HistoryPanel } from "./history-panel";
import { LightboxPreview } from "./lightbox-preview";
import { LoraPanel } from "./lora-panel";
import { ParamsPanel } from "./params-panel";
import { PresetsPanel } from "./presets-panel";
import { PromptsPanel } from "./prompts-panel";
import { ResultsPanel } from "./results-panel";
import { useSectionEditorState } from "./use-section-editor-state";

export function SectionEditorShell(props: SectionEditorLoadedProps) {
  const editor = useSectionEditorState(props);
  const { project, section, prevSection, nextSection } = editor;

  return (
    <div className={s.page}>
      <SectionHeader
        backHref={demoHref(`/projects/${project.id}`)}
        backLabel={project.title}
        prev={
          prevSection
            ? {
                name: prevSection.name,
                href: demoHref(
                  `/projects/${project.id}/sections/${rawSectionId(prevSection)}`,
                ),
              }
            : null
        }
        next={
          nextSection
            ? {
                name: nextSection.name,
                href: demoHref(
                  `/projects/${project.id}/sections/${rawSectionId(nextSection)}`,
                ),
              }
            : null
        }
        workflowDownloadHref={editor.downloadHref}
        initialName={section.name}
        saveStatus={editor.saveStatus}
        onSavingChange={editor.setSaveStatus}
        onRename={() => undefined}
        batchSize={editor.batchSize}
        onBatchSizeChange={editor.updateBatchSize}
        onRun={editor.flashSave}
      />

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

"use client";

import type { DemoData, DemoProject, DemoSection } from "./design-demo-data";
import { MissingSectionState } from "./section-editor/missing-section-state";
import { SectionEditorShell } from "./section-editor/section-editor-shell";

type SectionEditorPageProps = {
  data: DemoData;
  project: DemoProject | undefined;
  section: DemoSection | undefined;
};

export function SectionEditorPage({ data, project, section }: SectionEditorPageProps) {
  if (!project || !section) {
    return <MissingSectionState />;
  }

  return <SectionEditorShell data={data} project={project} section={section} />;
}

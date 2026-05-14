"use client";

import type { DemoData, DemoProject, DemoSection } from "../../../data";
import { MissingSectionState } from "./missing-section-state";
import { SectionEditorShell } from "./editor-shell";

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

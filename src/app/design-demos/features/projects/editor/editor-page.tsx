"use client";

import { useEffect } from "react";

import type { DemoData, DemoProject, DemoSection } from "../../../data";
import { MissingSectionState } from "./missing-section-state";
import { SectionEditorShell } from "./editor-shell";

const SECTION_SCROLL_KEY = "demo-project-sections-from";

type SectionEditorPageProps = {
  data: DemoData;
  project: DemoProject | undefined;
  section: DemoSection | undefined;
};

export function SectionEditorPage({ data, project, section }: SectionEditorPageProps) {
  useEffect(() => {
    if (section) {
      try { sessionStorage.setItem(SECTION_SCROLL_KEY, section.id); } catch {}
    }
  }, [section]);

  if (!project || !section) {
    return <MissingSectionState />;
  }

  return <SectionEditorShell data={data} project={project} section={section} />;
}

"use client";

import { useState } from "react";

import type { ProjectSectionDraftState } from "./project-page-utils";

export function useProjectSectionDraft(projectSectionStateKey: string | null) {
  const [sectionDraftsByKey, setSectionDraftsByKey] = useState<Record<string, ProjectSectionDraftState>>({});
  const visibleSectionDraft = projectSectionStateKey ? sectionDraftsByKey[projectSectionStateKey] ?? null : null;

  function saveSectionDraft(draft: ProjectSectionDraftState) {
    if (!projectSectionStateKey) return;
    setSectionDraftsByKey((current) => ({
      ...current,
      [projectSectionStateKey]: draft,
    }));
  }

  return {
    saveSectionDraft,
    visibleSectionDraft,
  };
}

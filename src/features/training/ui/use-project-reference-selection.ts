"use client";

import { useState } from "react";

import type { ReferenceCandidate } from "./project-page-utils";

type ProjectReferenceSelectionState = {
  previewReference: ReferenceCandidate | null;
  selectedReferenceIds: Set<string>;
  templateContextId: string;
};

export function useProjectReferenceSelection(templateContextId: string, fallbackPreviewReference: ReferenceCandidate | null) {
  const [projectReferenceSelectionState, setProjectReferenceSelectionState] = useState<ProjectReferenceSelectionState>(() => ({
    previewReference: fallbackPreviewReference,
    selectedReferenceIds: new Set<string>(),
    templateContextId,
  }));
  const projectReferenceSelection = projectReferenceSelectionState.templateContextId === templateContextId ? projectReferenceSelectionState : {
    previewReference: fallbackPreviewReference,
    selectedReferenceIds: new Set<string>(),
    templateContextId,
  };
  const activePreviewReference = projectReferenceSelection.previewReference ?? fallbackPreviewReference;
  const selectedReferenceIds = projectReferenceSelection.selectedReferenceIds;

  function setSelectedReferenceIds(updater: (current: Set<string>) => Set<string>) {
    setProjectReferenceSelectionState((current) => {
      const active = current.templateContextId === templateContextId ? current : projectReferenceSelection;
      return {
        ...active,
        selectedReferenceIds: updater(active.selectedReferenceIds),
        templateContextId,
      };
    });
  }

  function previewProjectReference(candidate: ReferenceCandidate) {
    setProjectReferenceSelectionState((current) => {
      const active = current.templateContextId === templateContextId ? current : projectReferenceSelection;
      return {
        ...active,
        previewReference: candidate,
        templateContextId,
      };
    });
  }

  function addProjectReference(candidate: ReferenceCandidate) {
    setSelectedReferenceIds((current) => new Set([...current, candidate.id]));
  }

  return {
    activePreviewReference,
    addProjectReference,
    previewProjectReference,
    selectedReferenceIds,
    setSelectedReferenceIds,
  };
}

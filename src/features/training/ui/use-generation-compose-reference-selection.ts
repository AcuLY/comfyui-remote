"use client";

import { useState } from "react";

import type { ReferenceCandidate } from "./project-page-utils";

type GenerationComposeReferenceSelectionState = {
  previewReference: ReferenceCandidate | null;
  projectId: string | null;
  sectionId: string | null;
  selectedReferenceIds: Set<string>;
};

export function useGenerationComposeReferenceSelection(
  projectId: string | null,
  sectionId: string | null,
  fallbackPreviewReference: ReferenceCandidate | null,
) {
  const [referenceSelectionState, setReferenceSelectionState] = useState<GenerationComposeReferenceSelectionState>(() => ({
    previewReference: fallbackPreviewReference,
    projectId: projectId,
    sectionId: sectionId,
    selectedReferenceIds: new Set<string>(),
  }));
  const referenceSelection = referenceSelectionState.projectId === projectId && referenceSelectionState.sectionId === sectionId ? referenceSelectionState : {
    previewReference: fallbackPreviewReference,
    projectId: projectId,
    sectionId: sectionId,
    selectedReferenceIds: new Set<string>(),
  };
  const activePreviewReference = referenceSelection.previewReference ?? fallbackPreviewReference;
  const selectedReferenceIds = referenceSelection.selectedReferenceIds;

  function setSelectedReferenceIds(updater: (current: Set<string>) => Set<string>) {
    setReferenceSelectionState((current) => {
      const active = current.projectId === projectId && current.sectionId === sectionId ? current : referenceSelection;
      return {
        ...active,
        projectId: projectId,
        sectionId: sectionId,
        selectedReferenceIds: updater(active.selectedReferenceIds),
      };
    });
  }

  function previewTaskReference(candidate: ReferenceCandidate) {
    setReferenceSelectionState((current) => {
      const active = current.projectId === projectId && current.sectionId === sectionId ? current : referenceSelection;
      return {
        ...active,
        previewReference: candidate,
        projectId: projectId,
        sectionId: sectionId,
      };
    });
  }

  function addTaskReference(candidate: ReferenceCandidate) {
    setSelectedReferenceIds((current) => new Set([...current, candidate.id]));
  }

  function removeTaskReference(candidate: ReferenceCandidate) {
    setSelectedReferenceIds((current) => {
      const nextSelectedReferenceIds = new Set(current);
      nextSelectedReferenceIds.delete(candidate.id);
      return nextSelectedReferenceIds;
    });
  }

  return {
    activePreviewReference,
    addTaskReference,
    previewTaskReference,
    removeTaskReference,
    selectedReferenceIds,
  };
}

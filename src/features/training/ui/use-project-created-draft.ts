"use client";

import { useState } from "react";

export type CreatedProjectDraft = {
  autoFreezeDataset: boolean;
  autoGenerateSamples: boolean;
  baseModel: string;
  captionStrategy: string;
  detailPrompt: string;
  enabledSectionCount: number;
  perSectionImageCount: string;
  selectedReferenceCount: number;
  selectedReferenceTitles: string[];
  sectionCount: number;
  templateTitle: string;
  title: string;
  trainingSteps: string;
  usagePrompt: string;
};

export function useProjectCreatedDraft(projectTemplateContextId: string) {
  const [createdProjectDraftState, setCreatedProjectDraftState] = useState<{
    draft: CreatedProjectDraft | null;
    templateContextId: string;
  }>(() => ({
    draft: null,
    templateContextId: projectTemplateContextId,
  }));
  const createdProjectDraft = createdProjectDraftState.templateContextId === projectTemplateContextId ? createdProjectDraftState.draft : null;

  function setCreatedProjectDraft(draft: CreatedProjectDraft) {
    setCreatedProjectDraftState({
      draft,
      templateContextId: projectTemplateContextId,
    });
  }

  return { createdProjectDraft, setCreatedProjectDraft };
}

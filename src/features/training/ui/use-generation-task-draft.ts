"use client";

import { useState } from "react";

export type GenerationTaskDraft = {
  finalInput: string;
  projectId: string;
  selectedReferenceTitles: string[];
  sectionId: string;
  sectionTitle: string;
  supplementalImageCount: number;
  supplementalImageTitles: string[];
  supplementalPrompt: string;
  taskType: string;
};

type GenerationTaskDraftTransportState = {
  projectId: string | null;
  sectionId: string | null;
  taskId: string | null;
};

export function useGenerationTaskDraft(projectId: string | null, sectionId: string | null) {
  const [generationTaskDraftTransportState, setGenerationTaskDraftTransportState] = useState<GenerationTaskDraftTransportState>(() => ({
    projectId,
    sectionId,
    taskId: null,
  }));
  const [generationTaskDraft, setGenerationTaskDraft] = useState<GenerationTaskDraft | null>(null);
  const draftTaskId = generationTaskDraftTransportState.projectId === projectId && generationTaskDraftTransportState.sectionId === sectionId
    ? generationTaskDraftTransportState.taskId
    : null;
  const visibleGenerationTaskDraft = generationTaskDraft?.projectId === projectId && generationTaskDraft.sectionId === sectionId ? generationTaskDraft : null;

  function rememberGenerationDraftTaskId(taskId: string | null) {
    setGenerationTaskDraftTransportState({
      projectId,
      sectionId,
      taskId,
    });
  }

  return {
    draftTaskId,
    rememberGenerationDraftTaskId,
    setGenerationTaskDraft,
    visibleGenerationTaskDraft,
  };
}

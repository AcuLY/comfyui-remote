"use client";

import { useState } from "react";

const DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT = "保持角色正面可训练，避免复杂遮挡和多人构图。";
const DEFAULT_GENERATION_TASK_TYPE = "训练集图片生成";

type GenerationComposeFormState = {
  projectId: string | null;
  sectionId: string | null;
  supplementalPrompt: string;
  taskType: string;
};

function defaultGenerationForm(projectId: string | null, sectionId: string | null): GenerationComposeFormState {
  return {
    projectId,
    sectionId,
    supplementalPrompt: DEFAULT_GENERATION_SUPPLEMENTAL_PROMPT,
    taskType: DEFAULT_GENERATION_TASK_TYPE,
  };
}

export function useGenerationComposeForm(projectId: string | null, sectionId: string | null) {
  const [generationFormState, setGenerationForm] = useState(() => defaultGenerationForm(projectId, sectionId));
  const generationForm = generationFormState.projectId === projectId && generationFormState.sectionId === sectionId
    ? generationFormState
    : defaultGenerationForm(projectId, sectionId);

  function handleUpdateGenerationForm(field: "supplementalPrompt" | "taskType", value: string) {
    setGenerationForm((current) => {
      const active = current.projectId === projectId && current.sectionId === sectionId ? current : generationForm;
      return {
        ...active,
        [field]: value,
        projectId,
        sectionId,
      };
    });
  }

  return {
    generationForm,
    handleUpdateGenerationForm,
  };
}

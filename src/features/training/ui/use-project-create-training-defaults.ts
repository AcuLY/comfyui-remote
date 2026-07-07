"use client";

import { useState } from "react";

type ProjectCreateTrainingDefaults = {
  autoFreezeDataset: boolean;
  autoGenerateSamples: boolean;
  templateContextId: string;
};

export function useProjectCreateTrainingDefaults(projectTemplateContextId: string) {
  const defaultTrainingDefaults: ProjectCreateTrainingDefaults = {
    autoFreezeDataset: true,
    autoGenerateSamples: true,
    templateContextId: projectTemplateContextId,
  };
  const [trainingDefaultsState, setTrainingDefaultsState] = useState(defaultTrainingDefaults);
  const trainingDefaults = trainingDefaultsState.templateContextId === projectTemplateContextId ? trainingDefaultsState : defaultTrainingDefaults;

  function setTrainingDefaults(updater: (current: ProjectCreateTrainingDefaults) => ProjectCreateTrainingDefaults) {
    setTrainingDefaultsState((current) => ({
      ...updater(current.templateContextId === projectTemplateContextId ? current : defaultTrainingDefaults),
      templateContextId: projectTemplateContextId,
    }));
  }

  return { setTrainingDefaults, trainingDefaults };
}

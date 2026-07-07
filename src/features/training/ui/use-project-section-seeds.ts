"use client";

import { useState } from "react";

import type { LoraTrainingTemplateSeedSection } from "./project-page-utils";

export function useProjectSectionSeeds(
  projectTemplateContextId: string,
  initialSectionSeeds: LoraTrainingTemplateSeedSection[],
) {
  const [sectionSeedState, setSectionSeedState] = useState(() => ({
    sections: initialSectionSeeds,
    templateContextId: projectTemplateContextId,
  }));
  const sectionSeeds = sectionSeedState.templateContextId === projectTemplateContextId ? sectionSeedState.sections : initialSectionSeeds;

  function setSectionSeeds(nextValue: LoraTrainingTemplateSeedSection[] | ((current: LoraTrainingTemplateSeedSection[]) => LoraTrainingTemplateSeedSection[])) {
    setSectionSeedState((current) => {
      const currentSections = current.templateContextId === projectTemplateContextId ? current.sections : initialSectionSeeds;
      const nextSections = typeof nextValue === "function" ? nextValue(currentSections) : nextValue;
      return {
        sections: nextSections,
        templateContextId: projectTemplateContextId,
      };
    });
  }

  return { sectionSeeds, setSectionSeeds };
}

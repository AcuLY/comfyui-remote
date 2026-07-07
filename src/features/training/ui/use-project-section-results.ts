"use client";

import { useState } from "react";

import type { LoraTrainingImageResult } from "@/features/training/types";

export function useProjectSectionResults(
  projectId: string | null,
  sectionId: string | null,
  initialResults: LoraTrainingImageResult[],
) {
  const [sectionResultsByProjectKey, setSectionResultsByProjectKey] = useState<Record<string, LoraTrainingImageResult[]>>(() => (
    projectId ? { [projectId]: initialResults } : {}
  ));
  const projectResults = projectId ? sectionResultsByProjectKey[projectId] ?? initialResults : initialResults;
  const sectionResults = sectionId ? projectResults.filter((result) => result.sectionId === sectionId) : [];

  function updateSectionResultReviewStatus(resultId: string, reviewStatus: LoraTrainingImageResult["reviewStatus"]) {
    if (!projectId) return;
    setSectionResultsByProjectKey((current) => ({
      ...current,
      [projectId]: (current[projectId] ?? initialResults).map((result) =>
        result.id === resultId ? { ...result, reviewStatus } : result,
      ),
    }));
  }

  return {
    sectionResults,
    updateSectionResultReviewStatus,
  };
}

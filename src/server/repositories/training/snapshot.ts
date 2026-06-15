import {
  getLegacyTrainingGenerationRun,
  getLegacyTrainingProjectOverview,
  listLegacyTrainingCandidateImages,
  listLegacyTrainingDatasetRevisions,
  listLegacyTrainingProjectSections,
  listLegacyTrainingProjects,
  listLegacyTrainingPromptCardVersions,
  listLegacyTrainingReferenceImages,
  listLegacyTrainingRuns,
} from "@/server/services/training/legacy-compat-service";

export const getTrainingGenerationRun = getLegacyTrainingGenerationRun;
export const getTrainingProjectOverview = getLegacyTrainingProjectOverview;
export const listTrainingCandidateImages = listLegacyTrainingCandidateImages;
export const listTrainingDatasetRevisions = listLegacyTrainingDatasetRevisions;
export const listTrainingProjectSections = listLegacyTrainingProjectSections;
export const listTrainingProductionProjects = listLegacyTrainingProjects;
export const listTrainingPromptCardVersions = listLegacyTrainingPromptCardVersions;
export const listTrainingReferenceImages = listLegacyTrainingReferenceImages;
export const listTrainingRuns = listLegacyTrainingRuns;

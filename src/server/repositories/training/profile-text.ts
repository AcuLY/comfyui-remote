import {
  createLegacyTrainingPromptCardVersion,
  getLegacyTrainingProject,
  listLegacyTrainingPromptCardVersions,
} from "@/server/services/training/legacy-compat-service";

export const createTrainingPromptCardVersion = createLegacyTrainingPromptCardVersion;
export const getTrainingProductionProject = getLegacyTrainingProject;
export const listTrainingPromptCardVersions = listLegacyTrainingPromptCardVersions;

import {
  getLegacyTrainingCandidateImage,
  getLegacyTrainingProject,
  listLegacyTrainingCandidateImages,
  updateLegacyTrainingImageCaption,
} from "@/server/services/training/legacy-compat-service";

export const getTrainingCandidateImage = getLegacyTrainingCandidateImage;
export const getTrainingProductionProject = getLegacyTrainingProject;
export const listTrainingCandidateImages = listLegacyTrainingCandidateImages;
export const updateTrainingCandidateImageCaption = updateLegacyTrainingImageCaption;

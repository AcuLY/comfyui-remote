import {
  createLegacyTrainingReferenceImage,
  findLegacyTrainingReferenceImageDuplicate,
  getLegacyTrainingCandidateImage,
  getLegacyTrainingProject,
  getLegacyTrainingReferenceImageFromRepository,
  listLegacyTrainingReferenceImages,
  listLegacyTrainingCandidateImages,
  TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE,
  updateLegacyTrainingImageCaption,
} from "@/server/services/training/legacy-compat-service";

export const createTrainingReferenceImage = createLegacyTrainingReferenceImage;
export const findTrainingReferenceImageDuplicate = findLegacyTrainingReferenceImageDuplicate;
export const getTrainingCandidateImage = getLegacyTrainingCandidateImage;
export const getTrainingProductionProject = getLegacyTrainingProject;
export const getTrainingReferenceImage = getLegacyTrainingReferenceImageFromRepository;
export const listTrainingCandidateImages = listLegacyTrainingCandidateImages;
export const listTrainingReferenceImages = listLegacyTrainingReferenceImages;
export { TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE };
export const updateTrainingCandidateImageCaption = updateLegacyTrainingImageCaption;

import type { LegacyTrainingProviderInputImage } from "@/server/services/training/legacy-compat-service";
import {
  createLegacyTrainingProjectArtifact,
  enqueueLegacyTrainingSectionGenerationRun,
  getExistingJob,
  getExistingSection,
  mapLegacyTrainingGenerationError,
  writeLegacyTrainingBufferArtifact,
} from "@/server/services/training/legacy-compat-service";

export type TrainingProviderInputImage = LegacyTrainingProviderInputImage;

export const createTrainingProjectArtifact = createLegacyTrainingProjectArtifact;
export const enqueueTrainingSectionGenerationRun = enqueueLegacyTrainingSectionGenerationRun;
export const getTrainingProductionProjectRecord = getExistingJob;
export const getTrainingProductionSectionRecord = getExistingSection;
export const mapTrainingGenerationError = mapLegacyTrainingGenerationError;
export const writeTrainingBufferArtifact = writeLegacyTrainingBufferArtifact;

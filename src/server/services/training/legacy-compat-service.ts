import {
  completeCharacterLoraTask,
  freezeCharacterLoraDataset,
  getCharacterLoraWorkerQueueStatus,
  heartbeatCharacterLoraTask,
  leaseNextCharacterLoraTask,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
  mapCharacterLoraPhase3Error,
  enqueueCharacterLoraSectionGenerationRun,
  failCharacterLoraTask,
  reviewCharacterLoraImages,
  updateCharacterLoraImageCaption,
} from "@/server/services/character-lora-training/phase3-service";
import {
  createCharacterLoraTrainingProject,
  archiveCharacterLoraTrainingJob,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingJobOverview,
  listCharacterLoraTrainingJobs,
  mapCharacterLoraTrainingJobError,
  restoreCharacterLoraTrainingJob,
  updateCharacterLoraTrainingJob,
} from "@/server/services/character-lora-training/job-service";
import {
  cancelCharacterLoraGenerationRun,
} from "@/server/services/character-lora-training/generation-run-service";
import {
  createCharacterLoraPromptCardVersion,
  listCharacterLoraPromptCardVersions,
  mapCharacterLoraPromptCardError,
} from "@/server/services/character-lora-training/prompt-card-service";
import {
  deleteCharacterLoraSourceImage,
  listCharacterLoraSourceImages,
  mapCharacterLoraSourceImageError,
  registerCharacterLoraSourceImageFromArtifact,
  updateCharacterLoraSourceImage,
  uploadCharacterLoraSourceImage,
} from "@/server/services/character-lora-training/source-image-service";
import {
  createCharacterLoraTrainingTemplate,
  getCharacterLoraTrainingTemplateSnapshot,
  listCharacterLoraJobSections,
  listCharacterLoraTrainingTemplates,
  mapCharacterLoraSectionTemplateError,
  updateCharacterLoraTrainingTemplate,
} from "@/server/services/character-lora-training/section-template-service";
import {
  cancelTrainingRun,
  enqueueCharacterLoraTrainingRun,
  listCharacterLoraTrainingRuns,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";
import {
  writeCharacterLoraBufferArtifact,
} from "@/server/services/character-lora-training/artifact-service";
import {
  CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE,
} from "@/lib/character-lora-source-images";
import {
  getExistingJob,
  getExistingSection,
} from "@/server/services/character-lora-training/phase3-internal";
import type {
  CharacterLoraProviderInputImage,
} from "@/server/character-lora-training/contracts";
import {
  createCharacterLoraJobArtifact,
  createCharacterLoraSourceImage,
  findCharacterLoraSourceImageDuplicate,
  getCharacterLoraCandidateImage,
  getCharacterLoraGenerationRun,
  getCharacterLoraJobSection,
  getCharacterLoraSourceImage as getCharacterLoraSourceImageFromRepository,
  getCharacterLoraTrainingJob as getCharacterLoraTrainingJobFromRepository,
  listCharacterLoraSourceImages as listCharacterLoraSourceImagesFromRepository,
} from "@/server/repositories/character-lora-training";
import {
  getCharacterLoraSourceImage as getCharacterLoraSourceImageFromSourceImageRepository,
  registerCharacterLoraSourceImageAsCandidate,
} from "@/server/repositories/character-lora-training/source-image-repository";
import {
  slugifyForRepository,
} from "@/server/repositories/character-lora-training/helpers";
import {
  upsertCharacterLoraTrainingTemplates,
} from "@/server/repositories/character-lora-training-repository";

export type { CharacterLoraProviderInputImage };

export {
  createCharacterLoraJobArtifact,
  createCharacterLoraPromptCardVersion,
  createCharacterLoraSourceImage,
  createCharacterLoraTrainingProject,
  createCharacterLoraTrainingTemplate,
  enqueueCharacterLoraSectionGenerationRun,
  findCharacterLoraSourceImageDuplicate,
  getCharacterLoraCandidateImage,
  getCharacterLoraGenerationRun,
  getCharacterLoraJobSection,
  getCharacterLoraSourceImageFromRepository as getCharacterLoraSourceImage,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingJobFromRepository,
  getCharacterLoraTrainingJobOverview,
  getCharacterLoraTrainingTemplateSnapshot,
  getCharacterLoraWorkerQueueStatus,
  getExistingJob,
  getExistingSection,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
  listCharacterLoraJobSections,
  listCharacterLoraPromptCardVersions,
  listCharacterLoraSourceImages,
  listCharacterLoraSourceImagesFromRepository,
  listCharacterLoraTrainingJobs,
  listCharacterLoraTrainingRuns,
  listCharacterLoraTrainingTemplates,
  mapCharacterLoraPhase3Error,
  mapCharacterLoraPromptCardError,
  mapCharacterLoraSectionTemplateError,
  mapCharacterLoraTrainingError,
  mapCharacterLoraTrainingJobError,
  slugifyForRepository,
  updateCharacterLoraImageCaption,
  updateCharacterLoraSourceImage,
  updateCharacterLoraTrainingTemplate,
  upsertCharacterLoraTrainingTemplates,
  uploadCharacterLoraSourceImage,
  writeCharacterLoraBufferArtifact,
};

export const mapLegacyTrainingProjectError = mapCharacterLoraTrainingJobError;
export const mapLegacyTrainingPromptCardError = mapCharacterLoraPromptCardError;
export const mapLegacyTrainingReferenceImageError = mapCharacterLoraSourceImageError;
export const mapLegacyTrainingGenerationError = mapCharacterLoraPhase3Error;
export const mapLegacyTrainingRunError = mapCharacterLoraTrainingError;

export const updateLegacyTrainingProject = updateCharacterLoraTrainingJob;
export const archiveLegacyTrainingProject = archiveCharacterLoraTrainingJob;
export const restoreLegacyTrainingProject = restoreCharacterLoraTrainingJob;
export const getLegacyTrainingProject = getCharacterLoraTrainingJob;
export const getLegacyTrainingProjectOverview = getCharacterLoraTrainingJobOverview;

export const createLegacyTrainingPromptCardVersion = createCharacterLoraPromptCardVersion;
export const listLegacyTrainingPromptCardVersions = listCharacterLoraPromptCardVersions;

export const listLegacyTrainingReferenceImages = listCharacterLoraSourceImages;
export const registerLegacyTrainingReferenceImageFromArtifact = registerCharacterLoraSourceImageFromArtifact;
export const uploadLegacyTrainingReferenceImage = uploadCharacterLoraSourceImage;
export const updateLegacyTrainingReferenceImage = updateCharacterLoraSourceImage;
export const deleteLegacyTrainingReferenceImage = deleteCharacterLoraSourceImage;
export const getLegacyTrainingReferenceImage = getCharacterLoraSourceImageFromSourceImageRepository;
export const getLegacyTrainingReferenceImageFromRepository = getCharacterLoraSourceImageFromRepository;
export const registerLegacyTrainingReferenceImageAsResult = registerCharacterLoraSourceImageAsCandidate;
export const createLegacyTrainingReferenceImage = createCharacterLoraSourceImage;
export const findLegacyTrainingReferenceImageDuplicate = findCharacterLoraSourceImageDuplicate;
export const TRAINING_UNDIFFERENTIATED_REFERENCE_ROLE = CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE;

export const freezeLegacyTrainingDataset = freezeCharacterLoraDataset;
export const enqueueLegacyTrainingSectionGenerationRun = enqueueCharacterLoraSectionGenerationRun;
export const reviewLegacyTrainingImages = reviewCharacterLoraImages;
export const getLegacyTrainingCandidateImage = getCharacterLoraCandidateImage;
export const listLegacyTrainingCandidateImages = listCharacterLoraCandidateImages;
export const updateLegacyTrainingImageCaption = updateCharacterLoraImageCaption;
export const cancelLegacyTrainingGenerationRun = cancelCharacterLoraGenerationRun;

export const getLegacyTrainingWorkerQueueStatus = getCharacterLoraWorkerQueueStatus;
export const leaseNextLegacyTrainingWorkerTask = leaseNextCharacterLoraTask;
export const heartbeatLegacyTrainingWorkerTask = heartbeatCharacterLoraTask;
export const completeLegacyTrainingWorkerTask = completeCharacterLoraTask;
export const failLegacyTrainingWorkerTask = failCharacterLoraTask;

export const enqueueLegacyTrainingRun = enqueueCharacterLoraTrainingRun;
export const cancelLegacyTrainingRun = cancelTrainingRun;

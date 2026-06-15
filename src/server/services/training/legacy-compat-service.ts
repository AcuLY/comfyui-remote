import {
  freezeCharacterLoraDataset,
  mapCharacterLoraPhase3Error,
  reviewCharacterLoraImages,
  updateCharacterLoraImageCaption,
  enqueueCharacterLoraSectionGenerationRun,
} from "@/server/services/character-lora-training/phase3-service";
import {
  archiveCharacterLoraTrainingJob,
  getCharacterLoraTrainingJob,
  getCharacterLoraTrainingJobOverview,
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
  cancelTrainingRun,
  enqueueCharacterLoraTrainingRun,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";
import {
  getCharacterLoraSourceImage,
  registerCharacterLoraSourceImageAsCandidate,
} from "@/server/repositories/character-lora-training/source-image-repository";
import {
  getCharacterLoraSourceImage as getCharacterLoraSourceImageFromRepository,
} from "@/server/repositories/character-lora-training";

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
export const getLegacyTrainingReferenceImage = getCharacterLoraSourceImage;
export const getLegacyTrainingReferenceImageFromRepository = getCharacterLoraSourceImageFromRepository;
export const registerLegacyTrainingReferenceImageAsResult = registerCharacterLoraSourceImageAsCandidate;

export const freezeLegacyTrainingDataset = freezeCharacterLoraDataset;
export const enqueueLegacyTrainingSectionGenerationRun = enqueueCharacterLoraSectionGenerationRun;
export const reviewLegacyTrainingImages = reviewCharacterLoraImages;
export const updateLegacyTrainingImageCaption = updateCharacterLoraImageCaption;
export const cancelLegacyTrainingGenerationRun = cancelCharacterLoraGenerationRun;

export const enqueueLegacyTrainingRun = enqueueCharacterLoraTrainingRun;
export const cancelLegacyTrainingRun = cancelTrainingRun;

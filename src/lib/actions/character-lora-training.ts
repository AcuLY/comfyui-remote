"use server";

import {
  createCharacterLoraTrainingJob as createJob,
  getCharacterLoraTrainingJob as getJob,
  listCharacterLoraTrainingJobs as listJobs,
  updateCharacterLoraTrainingJob as updateJob,
} from "@/server/services/character-lora-training/job-service";
import {
  listCharacterLoraSourceImages as listSourceImages,
  uploadCharacterLoraSourceImage as uploadSourceImage,
} from "@/server/services/character-lora-training/source-image-service";
import {
  createCharacterLoraPromptCardVersion as createPromptCardVersion,
  listCharacterLoraPromptCardVersions as listPromptCardVersions,
} from "@/server/services/character-lora-training/prompt-card-service";
import {
  instantiateCharacterLoraJobSections as instantiateJobSections,
  listCharacterLoraJobSections as listJobSections,
  listCharacterLoraSectionTemplates as listSectionTemplates,
} from "@/server/services/character-lora-training/section-template-service";
import {
  enqueueCharacterLoraCanonicalGenerationRun as enqueueCanonicalGenerationRun,
  mockCompleteCharacterLoraCanonicalGenerationRun as mockCompleteCanonicalGenerationRun,
  selectCharacterLoraCanonicalVersion as selectCanonicalVersion,
} from "@/server/services/character-lora-training/canonical-service";

export async function createCharacterLoraTrainingJob(input: unknown) {
  return createJob(input);
}

export async function updateCharacterLoraTrainingJob(jobId: string, input: unknown) {
  return updateJob(jobId, input);
}

export async function listCharacterLoraTrainingJobs(input?: unknown) {
  return listJobs(input ?? {});
}

export async function getCharacterLoraTrainingJob(jobId: string) {
  return getJob(jobId);
}

export async function listCharacterLoraSourceImages(jobId: string) {
  return listSourceImages(jobId);
}

export async function uploadCharacterLoraSourceImage(jobId: string, input: FormData) {
  return uploadSourceImage(jobId, input);
}

export async function listCharacterLoraPromptCardVersions(jobId: string) {
  return listPromptCardVersions(jobId);
}

export async function createCharacterLoraPromptCardVersion(jobId: string, input: unknown) {
  return createPromptCardVersion(jobId, input);
}

export async function listCharacterLoraSectionTemplates() {
  return listSectionTemplates();
}

export async function listCharacterLoraJobSections(jobId: string) {
  return listJobSections(jobId);
}

export async function instantiateCharacterLoraJobSections(jobId: string, input?: unknown) {
  return instantiateJobSections(jobId, input ?? {});
}

export async function enqueueCharacterLoraCanonicalGenerationRun(jobId: string, input?: unknown) {
  return enqueueCanonicalGenerationRun(jobId, input ?? {});
}

export async function mockCompleteCharacterLoraCanonicalGenerationRun(runId: string, input?: unknown) {
  return mockCompleteCanonicalGenerationRun(runId, input ?? {});
}

export async function selectCharacterLoraCanonicalVersion(jobId: string, versionId: string) {
  return selectCanonicalVersion(jobId, versionId);
}

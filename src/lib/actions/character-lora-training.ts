"use server";

import {
  createCharacterLoraTrainingJob as createJob,
  getCharacterLoraTrainingJob as getJob,
  listCharacterLoraTrainingJobs as listJobs,
  updateCharacterLoraTrainingJob as updateJob,
} from "@/server/services/character-lora-training/job-service";

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

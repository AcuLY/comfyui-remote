"use server";

import {
  archiveCharacterLoraTrainingJob as archiveJob,
  createCharacterLoraTrainingProject as createProject,
  createCharacterLoraTrainingJob as createJob,
  getCharacterLoraTrainingJob as getJob,
  getCharacterLoraTrainingJobOverview as getJobOverview,
  listCharacterLoraTrainingJobs as listJobs,
  updateCharacterLoraTrainingJob as updateJob,
} from "@/server/services/character-lora-training/job-service";
import {
  listCharacterLoraSourceImages as listSourceImages,
  registerCharacterLoraSourceImageAsCandidate as registerSourceImageAsCandidate,
  uploadCharacterLoraSourceImage as uploadSourceImage,
} from "@/server/services/character-lora-training/source-image-service";
import {
  createCharacterLoraPromptCardVersion as createPromptCardVersion,
  listCharacterLoraPromptCardVersions as listPromptCardVersions,
  promoteCharacterLoraSectionInstructionToPromptCardVersion as promoteSectionInstructionToPromptCardVersion,
} from "@/server/services/character-lora-training/prompt-card-service";
import {
  copyCharacterLoraSectionTemplate as copySectionTemplate,
  listCharacterLoraTrainingTemplates as listTrainingTemplates,
  instantiateCharacterLoraJobSections as instantiateJobSections,
  listCharacterLoraJobSections as listJobSections,
  listCharacterLoraSectionTemplates as listSectionTemplates,
  pauseCharacterLoraJobSection as pauseJobSection,
  resumeCharacterLoraJobSection as resumeJobSection,
  updateCharacterLoraJobSectionStatus as updateJobSectionStatus,
} from "@/server/services/character-lora-training/section-template-service";
import {
  enqueueCharacterLoraCanonicalGenerationRun as enqueueCanonicalGenerationRun,
  mockCompleteCharacterLoraCanonicalGenerationRun as mockCompleteCanonicalGenerationRun,
  registerManualCharacterLoraCanonicalVersion as registerManualCanonicalVersion,
  rejectCharacterLoraCanonicalVersion as rejectCanonicalVersion,
  selectCharacterLoraCanonicalVersion as selectCanonicalVersion,
} from "@/server/services/character-lora-training/canonical-service";
import {
  completeCharacterLoraTask as completeTask,
  enqueueCharacterLoraSectionGenerationRun as enqueueSectionGenerationRun,
  failCharacterLoraTask as failTask,
  freezeCharacterLoraDataset as freezeDataset,
  getCharacterLoraWorkerQueueStatus as getWorkerQueueStatus,
  heartbeatCharacterLoraTask as heartbeatTask,
  leaseNextCharacterLoraTask as leaseNextTask,
  listCharacterLoraCandidateImages as listCandidateImages,
  listCharacterLoraDatasetRevisions as listDatasetRevisions,
  reviewCharacterLoraImages as reviewImages,
  updateCharacterLoraImageCaption as updateImageCaption,
} from "@/server/services/character-lora-training/phase3-service";
import {
  cancelTrainingRun as cancelTrainingRunInService,
  enqueueCharacterLoraTrainingRun as enqueueTrainingRun,
  getCharacterLoraGpuTaskLock as getGpuTaskLock,
  listCharacterLoraTrainingRuns as listTrainingRuns,
} from "@/server/services/character-lora-training/training-service";
import {
  cleanupBenchmarkRunTemporaryResources as cleanupBenchmarkRunTemporaryResourcesInService,
  completeBenchmarkRun as completeBenchmarkRunInService,
  createPromotionDecision as createPromotionDecisionInService,
  ensureCharacterLoraBenchmarkTemplate as ensureBenchmarkTemplateInService,
  enqueueCharacterLoraBenchmarkRun as enqueueBenchmarkRun,
  getCharacterLoraBenchmarkTemplateStatus as getBenchmarkTemplateStatusInService,
  listCharacterLoraBenchmarkRuns as listBenchmarkRuns,
  listCharacterLoraBenchmarkRunsForTrainingRun as listBenchmarkRunsForTrainingRun,
  listCharacterLoraPromotionDecisions as listPromotionDecisions,
  mockCompleteBenchmarkRun as mockCompleteBenchmarkRunInService,
  promoteCharacterLoraPreset as promotePresetInService,
} from "@/server/services/character-lora-training/benchmark-promotion-service";
import {
  getCharacterLoraJobReport as getJobReport,
  persistCharacterLoraJobReport as persistJobReport,
} from "@/server/services/character-lora-training/report-service";

export async function createCharacterLoraTrainingJob(input: unknown) {
  return createJob(input);
}

export async function createCharacterLoraTrainingProject(input: unknown) {
  return createProject(input);
}

export async function updateCharacterLoraTrainingJob(jobId: string, input: unknown) {
  return updateJob(jobId, input);
}

export async function archiveCharacterLoraTrainingJob(jobId: string) {
  return archiveJob(jobId);
}

export async function listCharacterLoraTrainingJobs(input?: unknown) {
  return listJobs(input ?? {});
}

export async function getCharacterLoraTrainingJob(jobId: string) {
  return getJob(jobId);
}

export async function getCharacterLoraProjectOverview(jobId: string) {
  return getJobOverview(jobId);
}

export async function listCharacterLoraSourceImages(jobId: string) {
  return listSourceImages(jobId);
}

export async function uploadCharacterLoraSourceImage(jobId: string, input: FormData) {
  return uploadSourceImage(jobId, input);
}

export async function registerCharacterLoraSourceImageAsCandidate(jobId: string, input: unknown) {
  return registerSourceImageAsCandidate(jobId, input);
}

export async function listCharacterLoraPromptCardVersions(jobId: string) {
  return listPromptCardVersions(jobId);
}

export async function createCharacterLoraPromptCardVersion(jobId: string, input: unknown) {
  return createPromptCardVersion(jobId, input);
}

export async function promoteCharacterLoraSectionInstructionToPromptCardVersion(jobId: string, input: unknown) {
  return promoteSectionInstructionToPromptCardVersion(jobId, input);
}

export async function listCharacterLoraSectionTemplates() {
  return listSectionTemplates();
}

export async function listCharacterLoraTrainingTemplates() {
  return listTrainingTemplates();
}

export async function copyCharacterLoraSectionTemplate(input: unknown) {
  return copySectionTemplate(input);
}

export async function listCharacterLoraJobSections(jobId: string) {
  return listJobSections(jobId);
}

export async function instantiateCharacterLoraJobSections(jobId: string, input?: unknown) {
  return instantiateJobSections(jobId, input ?? {});
}

export async function updateCharacterLoraJobSectionStatus(sectionId: string, input: unknown) {
  return updateJobSectionStatus(sectionId, input);
}

export async function pauseCharacterLoraJobSection(sectionId: string) {
  return pauseJobSection(sectionId);
}

export async function resumeCharacterLoraJobSection(sectionId: string) {
  return resumeJobSection(sectionId);
}

export async function enqueueCharacterLoraCanonicalGenerationRun(jobId: string, input?: unknown) {
  return enqueueCanonicalGenerationRun(jobId, input ?? {});
}

export async function mockCompleteCharacterLoraCanonicalGenerationRun(runId: string, input?: unknown) {
  return mockCompleteCanonicalGenerationRun(runId, input ?? {});
}

export async function registerManualCharacterLoraCanonicalVersion(jobId: string, input: unknown) {
  return registerManualCanonicalVersion(jobId, input);
}

export async function rejectCharacterLoraCanonicalVersion(jobId: string, versionId: string) {
  return rejectCanonicalVersion(jobId, versionId);
}

export async function selectCharacterLoraCanonicalVersion(jobId: string, versionId: string) {
  return selectCanonicalVersion(jobId, versionId);
}

export async function enqueueCharacterLoraSectionGenerationRun(sectionId: string, input?: unknown) {
  return enqueueSectionGenerationRun(sectionId, input ?? {});
}

export async function listCharacterLoraCandidateImages(jobId: string, input?: unknown) {
  return listCandidateImages(jobId, input ?? {});
}

export async function reviewCharacterLoraImages(input: unknown) {
  return reviewImages(input);
}

export async function updateCharacterLoraImageCaption(imageId: string, input: unknown) {
  return updateImageCaption(imageId, input);
}

export async function freezeCharacterLoraDataset(jobId: string, input?: unknown) {
  return freezeDataset(jobId, input ?? {});
}

export async function listCharacterLoraDatasetRevisions(jobId: string) {
  return listDatasetRevisions(jobId);
}

export async function enqueueCharacterLoraTrainingRun(datasetRevisionId: string, input?: unknown) {
  return enqueueTrainingRun(datasetRevisionId, input ?? {});
}

export async function listCharacterLoraTrainingRuns(jobId: string) {
  return listTrainingRuns(jobId);
}

export async function cancelCharacterLoraTrainingRun(trainingRunId: string, input?: unknown) {
  return cancelTrainingRunInService(trainingRunId, input ?? {});
}

export async function getCharacterLoraGpuTaskLock() {
  return getGpuTaskLock();
}

export async function getCharacterLoraWorkerQueueStatus() {
  return getWorkerQueueStatus();
}

export async function getCharacterLoraBenchmarkTemplateStatus() {
  return getBenchmarkTemplateStatusInService();
}

export async function ensureCharacterLoraBenchmarkTemplate(input?: unknown) {
  return ensureBenchmarkTemplateInService(input ?? {});
}

export async function enqueueCharacterLoraBenchmarkRun(trainingRunId: string, input?: unknown) {
  return enqueueBenchmarkRun(trainingRunId, input ?? {});
}

export async function listCharacterLoraBenchmarkRuns(jobId: string) {
  return listBenchmarkRuns(jobId);
}

export async function listCharacterLoraBenchmarkRunsForTrainingRun(trainingRunId: string) {
  return listBenchmarkRunsForTrainingRun(trainingRunId);
}

export async function completeCharacterLoraBenchmarkRun(benchmarkRunId: string, input: unknown) {
  return completeBenchmarkRunInService(benchmarkRunId, input);
}

export async function mockCompleteCharacterLoraBenchmarkRun(benchmarkRunId: string, input?: unknown) {
  return mockCompleteBenchmarkRunInService(benchmarkRunId, input ?? {});
}

export async function cleanupCharacterLoraBenchmarkRunTemporaryResources(benchmarkRunId: string, input?: unknown) {
  return cleanupBenchmarkRunTemporaryResourcesInService(benchmarkRunId, input ?? {});
}

export async function createCharacterLoraPromotionDecision(benchmarkRunId: string, input: unknown) {
  return createPromotionDecisionInService(benchmarkRunId, input);
}

export async function listCharacterLoraPromotionDecisions(jobId: string) {
  return listPromotionDecisions(jobId);
}

export async function promoteCharacterLoraPreset(decisionId: string, input?: unknown) {
  return promotePresetInService(decisionId, input ?? {});
}

export async function getCharacterLoraJobReport(jobId: string) {
  return getJobReport(jobId);
}

export async function persistCharacterLoraJobReport(jobId: string) {
  return persistJobReport(jobId);
}

export async function leaseNextCharacterLoraTask(input: unknown) {
  return leaseNextTask(input);
}

export async function heartbeatCharacterLoraTask(taskId: string, input?: unknown) {
  return heartbeatTask(taskId, input ?? {});
}

export async function completeCharacterLoraTask(taskId: string, input: unknown) {
  return completeTask(taskId, input);
}

export async function failCharacterLoraTask(taskId: string, input: unknown) {
  return failTask(taskId, input);
}

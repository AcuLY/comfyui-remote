import type {
  getCharacterLoraGpuTaskLock,
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
  listCharacterLoraBenchmarkRuns,
  listCharacterLoraCandidateImages,
  listCharacterLoraDatasetRevisions,
  listCharacterLoraJobSections,
  listCharacterLoraPromptCardVersions,
  listCharacterLoraPromotionDecisions,
  listCharacterLoraSectionTemplates,
  listCharacterLoraSourceImages,
  listCharacterLoraTrainingJobs,
  listCharacterLoraTrainingRuns,
} from "@/lib/actions/character-lora-training";

export type CharacterLoraJobList = Awaited<ReturnType<typeof listCharacterLoraTrainingJobs>>;
export type CharacterLoraJobSummary = CharacterLoraJobList["jobs"][number];
export type CharacterLoraJob = Awaited<ReturnType<typeof getCharacterLoraTrainingJob>>;
export type CharacterLoraJobReport = Awaited<ReturnType<typeof getCharacterLoraJobReport>>;
export type CharacterLoraGpuLock = Awaited<ReturnType<typeof getCharacterLoraGpuTaskLock>>;
export type CharacterLoraSourceImage = Awaited<ReturnType<typeof listCharacterLoraSourceImages>>[number];
export type CharacterLoraPromptCard = Awaited<ReturnType<typeof listCharacterLoraPromptCardVersions>>[number];
export type CharacterLoraSectionTemplate = Awaited<ReturnType<typeof listCharacterLoraSectionTemplates>>[number];
export type CharacterLoraSection = Awaited<ReturnType<typeof listCharacterLoraJobSections>>[number];
export type CharacterLoraCandidateImage = Awaited<ReturnType<typeof listCharacterLoraCandidateImages>>[number];
export type CharacterLoraDatasetRevision = Awaited<ReturnType<typeof listCharacterLoraDatasetRevisions>>[number];
export type CharacterLoraTrainingRun = Awaited<ReturnType<typeof listCharacterLoraTrainingRuns>>[number];
export type CharacterLoraBenchmarkRun = Awaited<ReturnType<typeof listCharacterLoraBenchmarkRuns>>[number];
export type CharacterLoraPromotionDecision = Awaited<ReturnType<typeof listCharacterLoraPromotionDecisions>>[number];

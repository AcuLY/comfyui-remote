import { notFound } from "next/navigation";

import {
  getCharacterLoraBenchmarkTemplateStatus,
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
  listCharacterLoraTrainingRuns,
} from "@/lib/actions/character-lora-training";
import { JobWorkbenchClient } from "./job-workbench-client";

export const dynamic = "force-dynamic";

export default async function CharacterLoraTrainingJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getCharacterLoraTrainingJob(jobId).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("not found")) {
      return null;
    }
    throw error;
  });

  if (!job) {
    notFound();
  }

  const [
    sourceImages,
    promptCards,
    sectionTemplates,
    sections,
    candidateImages,
    datasetRevisions,
    trainingRuns,
    benchmarkRuns,
    benchmarkTemplateStatus,
    promotionDecisions,
    report,
    gpuLock,
  ] = await Promise.all([
    listCharacterLoraSourceImages(jobId),
    listCharacterLoraPromptCardVersions(jobId),
    listCharacterLoraSectionTemplates(),
    listCharacterLoraJobSections(jobId),
    listCharacterLoraCandidateImages(jobId, {}),
    listCharacterLoraDatasetRevisions(jobId),
    listCharacterLoraTrainingRuns(jobId),
    listCharacterLoraBenchmarkRuns(jobId),
    getCharacterLoraBenchmarkTemplateStatus(),
    listCharacterLoraPromotionDecisions(jobId),
    getCharacterLoraJobReport(jobId),
    getCharacterLoraGpuTaskLock(),
  ]);

  return (
    <JobWorkbenchClient
      job={job}
      sourceImages={sourceImages}
      promptCards={promptCards}
      sectionTemplates={sectionTemplates}
      sections={sections}
      candidateImages={candidateImages}
      datasetRevisions={datasetRevisions}
      trainingRuns={trainingRuns}
      benchmarkRuns={benchmarkRuns}
      benchmarkTemplateStatus={benchmarkTemplateStatus}
      promotionDecisions={promotionDecisions}
      report={report}
      gpuLock={gpuLock}
    />
  );
}

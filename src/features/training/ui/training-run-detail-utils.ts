import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingImageResult, LoraTrainingProject, LoraTrainingReviewStatus, LoraTrainingRun, LoraTrainingTaskKind } from "@/features/training/types";

export function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

export function findRun(data: TrainingAppData, kind: LoraTrainingTaskKind, runId: string | undefined) {
  if (!runId) return undefined;
  const training = buildLoraTrainingData(data);
  return training.runs.find((run) => run.kind === kind && run.id === runId);
}

export function trainingRunDetailTitle(run: LoraTrainingRun, project: LoraTrainingProject | undefined) {
  if (run.kind === "training") {
    const revision = project?.datasetRevisions.find((item) => item.id === run.datasetRevisionId);
    const datasetVersion = revision?.version ?? project?.datasetVersion ?? run.datasetRevisionId ?? "未记录";
    return `${run.projectTitle} / 数据集 ${datasetVersion}`;
  }

  return `${run.projectTitle} / ${run.title}`;
}

export function progressPercent(run: LoraTrainingRun) {
  return Math.round(Math.max(0, Math.min(100, run.progress ?? (run.status === "completed" ? 100 : 0))));
}

export function trainingConfigText(run: LoraTrainingRun) {
  if (!run.trainingConfig?.length) return run.finalInput ?? "未记录训练参数";
  return run.trainingConfig
    .map((row) => `${row.label}: ${row.value}${row.detail ? ` · ${row.detail}` : ""}`)
    .join("\n");
}

export function generationResultsForRun(
  run: LoraTrainingRun,
  project: LoraTrainingProject | undefined,
  resultReviewState: Record<string, LoraTrainingReviewStatus>,
) {
  if (run.kind !== "generation" || run.status !== "completed" || !project) return [];
  const outputResultIds = run.outputResultIds ?? [];
  if (!outputResultIds.length) return [];
  return outputResultIds
    .map((resultId) => project.resultPool.find((result) => result.id === resultId))
    .filter((result): result is LoraTrainingImageResult => Boolean(result))
    .map((result) => ({
      ...result,
      reviewStatus: resultReviewState[result.id] ?? result.reviewStatus,
    }));
}

export function trainingArtifactLabel(run: LoraTrainingRun) {
  if (run.finalLoraArtifactId) return run.artifactName ?? run.finalLoraArtifactId;
  if (run.status === "failed") return "未生成模型文件";
  return "尚未生成模型文件";
}

export function trainingPresetStatusLabel(run: LoraTrainingRun, canCreatePreset: boolean, presetCreatedAt: string | null) {
  if (canCreatePreset) return "可创建";
  if (presetCreatedAt) return "已创建";
  if (run.status === "failed") return "不可创建";
  return "等待模型文件";
}

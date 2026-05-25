export type DiagnosticReturnPoint =
  | "source"
  | "canonical"
  | "sections"
  | "dataset"
  | "caption"
  | "prompt"
  | "trainingConfig"
  | "weightSelection";

type DiagnosticRisk = "low" | "medium" | "high";

const DIAGNOSTIC_POINT_PRIORITY: Record<DiagnosticReturnPoint, number> = {
  source: 80,
  canonical: 70,
  sections: 60,
  dataset: 50,
  caption: 45,
  prompt: 40,
  trainingConfig: 30,
  weightSelection: 20,
};

export function buildDiagnosticSummary(input: {
  status: string;
  counts: Record<string, number>;
  sections: Array<{
    id?: string;
    key: string;
    name?: string;
    status?: string;
    keepCount: number;
    rejectCount: number;
    pendingCount: number;
    targetKeepCount: number;
  }>;
  candidateImages: Array<{
    id: string;
    sectionId?: string | null;
    relativePath?: string | null;
    review: { status: string; rejectReasons?: unknown; note?: string | null };
    caption: { draft: string | null };
  }>;
  datasetRevisions: Array<{
    id: string;
    status: string;
    itemCount: number;
    sourceCount?: number;
    syntheticCount?: number;
    captionAuditArtifactId?: string | null;
    trainDir?: string | null;
    items?: Array<{ captionText?: string | null; repeatCount?: number; sourceWeight?: number | null }>;
  }>;
  trainingRuns: Array<{
    id: string;
    status: string;
    finalSha256: string | null;
    finalSafetensorsArtifactId?: string | null;
    logArtifactId: string | null;
    metadataSummary?: unknown;
    currentStep?: number | null;
    targetSteps?: number | null;
    lossSnapshot?: unknown;
    checkpoints?: Array<{ id: string; step: number }>;
  }>;
  benchmarkRuns: Array<{
    id: string;
    status: string;
    reportArtifactId: string | null;
    recommendedWeight?: number | null;
    resultSummary: unknown;
    checkpointMatrix?: unknown;
    weightMatrix?: unknown;
    summary?: { testRunIds?: string[]; testImageIds?: string[] };
  }>;
  promotionDecisions: Array<{
    id: string;
    status: string;
    decisionReason: string | null;
    rejectedReturnPoint?: string | null;
    promotedPresetId: string | null;
    selectedCheckpoint?: string | null;
    defaultRecommendedWeight?: number | null;
    perVariantWeightOverrides?: unknown;
  }>;
  workerTasks: Array<{
    id: string;
    workerType: string;
    targetType: string;
    targetId: string;
    status: string;
    leaseOwner: string | null;
    heartbeatAt: string | null;
    errorSummary: string | null;
  }>;
}) {
  const reasons: string[] = [];
  const evidence: string[] = [];
  const actions: string[] = [];
  let recommendedReturnPoint: DiagnosticReturnPoint = "source";
  let strongestSeverity = 0;
  const recommend = (
    point: DiagnosticReturnPoint,
    severity: number,
    reason: string,
    action: string,
    evidenceLine?: string,
  ) => {
    if (
      severity > strongestSeverity ||
      (severity === strongestSeverity &&
        DIAGNOSTIC_POINT_PRIORITY[point] > DIAGNOSTIC_POINT_PRIORITY[recommendedReturnPoint])
    ) {
      recommendedReturnPoint = point;
      strongestSeverity = severity;
    }
    pushUnique(reasons, reason);
    pushUnique(actions, action);
    if (evidenceLine) pushUnique(evidence, evidenceLine);
  };
  const hasCompletedTraining = input.trainingRuns.some((run) => run.status === "done" && run.finalSha256);
  const hasCompletedBenchmark = input.benchmarkRuns.some((run) => run.status === "done");
  const hasPromotionDecision = input.promotionDecisions.some((decision) => decision.status === "approved" || decision.status === "promoted");
  const hasFullPromotionPath =
    input.counts.sourceImages > 0 &&
    input.counts.canonicalVersions > 0 &&
    input.counts.promptCardVersions > 0 &&
    input.counts.datasetRevisions > 0 &&
    hasCompletedTraining &&
    hasCompletedBenchmark &&
    hasPromotionDecision;

  if (hasFullPromotionPath) {
    recommend(
      "weightSelection",
      1,
      "The full source-to-promotion chain has at least one approved or promoted path.",
      "Keep this report with the promoted LoRA artifact for future rollback/diagnostics.",
    );
  } else if (input.counts.sourceImages === 0) {
    recommend(
      "source",
      5,
      "No source images are registered, so PRD diagnostic return points are not reachable yet.",
      "Upload source/reference images before generating canonical images, Prompt Card, dataset, or training runs.",
    );
  } else if (input.counts.canonicalVersions === 0) {
    recommend(
      "canonical",
      5,
      "No canonical version is available, so dataset/prompt/training diagnostics would be premature.",
      "Generate or manually register a canonical image, then rebuild the Prompt Card from that anchor.",
    );
  } else if (input.counts.promptCardVersions === 0) {
    recommend(
      "prompt",
      5,
      "No prompt card version is available.",
      "Create a Prompt Card tied to the selected canonical version before freezing captions or training config.",
    );
  } else if (input.counts.sections === 0 || input.sections.some((section) => section.keepCount < section.targetKeepCount)) {
    recommend(
      "sections",
      5,
      "Section coverage is incomplete, so the dataset cannot be diagnosed as a frozen training set yet.",
      "Generate/review section candidates until each section reaches its keep target, then freeze a new dataset revision.",
    );
  } else if (input.counts.datasetRevisions === 0) {
    recommend(
      "dataset",
      5,
      "No frozen dataset revision is available.",
      "Freeze a dataset revision from kept/captioned candidates before training.",
    );
  } else if (!hasCompletedTraining) {
    recommend(
      "trainingConfig",
      5,
      "No completed training run with finalSha256 is available.",
      "Complete training and verify config, log, final safetensors hash, and safetensors metadata.",
    );
  } else if (!hasCompletedBenchmark) {
    recommend(
      "weightSelection",
      3,
      "No completed benchmark run is available, so checkpoint/weight selection is not evidenced.",
      "Run the benchmark matrix and capture report/test project output before promotion.",
    );
  } else if (!hasPromotionDecision) {
    recommend(
      "weightSelection",
      3,
      "No approved/promoted promotion decision is available.",
      "Review benchmark evidence, select checkpoint/weight, and create a promotion decision.",
    );
  }

  const missingCaptions = input.candidateImages.filter((image) =>
    (image.review.status === "keep" || image.review.status === "included_in_training") && !image.caption.draft,
  );
  const rejectedImages = input.candidateImages.filter((image) => image.review.status === "reject");
  const rejectReasonCounts = buildRejectReasonCounts(rejectedImages);
  const sectionRejectEvidence = summarizeSections(input.sections);
  const latestDataset = getLast(input.datasetRevisions);
  const latestTrainingRun = getLast(input.trainingRuns);
  const latestRejectedDecision = [...input.promotionDecisions].reverse().find((decision) => decision.status === "rejected");
  const diagnosticText = [
    ...rejectedImages.flatMap((image) => extractRejectReasons(image.review.rejectReasons)),
    ...input.candidateImages.map((image) => image.review.note ?? ""),
    ...input.benchmarkRuns.flatMap((run) => collectBenchmarkSuggestions(run.resultSummary)),
    ...input.promotionDecisions.map((decision) => decision.decisionReason ?? ""),
  ].join("\n");
  const missingBenchmarkReports = input.benchmarkRuns.filter((run) => run.status === "done" && !run.reportArtifactId);

  evidence.push(`sourceImages=${input.counts.sourceImages}`);
  evidence.push(`canonicalVersions=${input.counts.canonicalVersions}`);
  evidence.push(`promptCardVersions=${input.counts.promptCardVersions}`);
  evidence.push(`sections=${input.counts.sections}`);
  evidence.push(`candidateImages=${input.counts.candidateImages}, keep=${input.counts.keptCandidateImages}, reject=${input.counts.rejectedCandidateImages}, pending=${input.counts.pendingCandidateImages}`);
  if (rejectReasonCounts.size > 0) {
    evidence.push(`rejectReasons=${formatReasonCounts(rejectReasonCounts)}`);
  }
  if (sectionRejectEvidence) {
    evidence.push(sectionRejectEvidence);
  }
  evidence.push(`datasetRevisions=${input.counts.datasetRevisions}, datasetItems=${input.counts.datasetItems}`);
  if (latestDataset) {
    const sourceCount = latestDataset.sourceCount ?? 0;
    const syntheticCount = latestDataset.syntheticCount ?? Math.max((latestDataset.itemCount ?? 0) - sourceCount, 0);
    const totalDatasetSources = sourceCount + syntheticCount;
    const sourceRatio = totalDatasetSources > 0 ? sourceCount / totalDatasetSources : 0;
    evidence.push(
      `latestDataset=${latestDataset.id}, status=${latestDataset.status}, source=${sourceCount}, synthetic=${syntheticCount}, sourceRatio=${sourceRatio.toFixed(2)}, captionAudit=${latestDataset.captionAuditArtifactId ?? "-"}`,
    );
  }
  evidence.push(`trainingRuns=${input.counts.trainingRuns}, completed=${input.counts.completedTrainingRuns}`);
  if (latestTrainingRun) {
    const keyCount = getJsonNumber(latestTrainingRun.metadataSummary, ["keyCount"]);
    evidence.push(
      [
        `latestTraining=${latestTrainingRun.id}`,
        `status=${latestTrainingRun.status}`,
        `step=${latestTrainingRun.currentStep ?? "-"}/${latestTrainingRun.targetSteps ?? "-"}`,
        `log=${latestTrainingRun.logArtifactId ?? "-"}`,
        `final=${latestTrainingRun.finalSha256 ?? "-"}`,
        `keyCount=${keyCount ?? "-"}`,
        `checkpoints=${latestTrainingRun.checkpoints?.length ?? 0}`,
      ].join(", "),
    );
  }
  evidence.push(`benchmarkRuns=${input.counts.benchmarkRuns}`);
  for (const run of input.benchmarkRuns) {
    const counts = getObject(run.resultSummary, "counts");
    const failed = getJsonNumber(counts, ["failed"]) ?? 0;
    const missing = getJsonNumber(counts, ["missing"]) ?? 0;
    const sectionCount = getArrayLength(run.resultSummary, "sections");
    const checkpointCount = getArrayLength(run.checkpointMatrix, null);
    const weightCount = getArrayLength(run.weightMatrix, null);
    evidence.push(
      `benchmark=${run.id}, status=${run.status}, recommendedWeight=${run.recommendedWeight ?? "-"}, checkpoints=${checkpointCount}, weights=${weightCount}, sections=${sectionCount}, failed=${failed}, missing=${missing}, report=${run.reportArtifactId ?? "-"}`,
    );
  }
  evidence.push(`promotionDecisions=${input.counts.promotionDecisions}`);
  evidence.push(`workerTasks=${input.counts.workerTasks ?? 0}`);

  const activeWorkerTasks = input.workerTasks.filter((task) => task.status === "queued" || task.status === "running");
  const failedWorkerTasks = input.workerTasks.filter((task) => task.status === "failed");
  if (activeWorkerTasks.length > 0) {
    evidence.push(
      `activeWorkerTasks=${activeWorkerTasks.map((task) => `${task.workerType}:${task.status}:${task.leaseOwner ?? "-"}`).join(", ")}`,
    );
  }
  if (failedWorkerTasks.length > 0) {
    recommend(
      "trainingConfig",
      3,
      `${failedWorkerTasks.length} worker task(s) failed.`,
      "Inspect failed worker task error summaries and rerun only after the underlying worker/config issue is fixed.",
      `failedWorkerTasks=${failedWorkerTasks.map((task) => `${task.workerType}:${task.targetId}:${task.errorSummary ?? "-"}`).join(" | ")}`,
    );
  }

  if (missingCaptions.length > 0) {
    recommend(
      "caption",
      4,
      `${missingCaptions.length} kept candidate image(s) have no caption draft.`,
      "Add captions to all kept candidates and freeze a new dataset revision before retraining.",
      `missingCaptionImages=${formatImageExamples(missingCaptions)}`,
    );
  }

  if (missingBenchmarkReports.length > 0) {
    recommend(
      "weightSelection",
      2,
      `${missingBenchmarkReports.length} completed benchmark run(s) have no report artifact.`,
      "Persist benchmark report artifacts for every completed benchmark so checkpoint/weight selection is auditable.",
    );
  }

  const identityRejects = countReasons(rejectReasonCounts, ["identity_wrong", "face_wrong", "hair_wrong", "bangs_wrong", "eye_wrong"]);
  if (identityRejects > 0 || hasDiagnosticKeyword(diagnosticText, ["identity", "face", "hair", "bangs", "eye", "顔", "脸", "不像", "发型", "刘海", "眼睛"])) {
    recommend(
      "dataset",
      identityRejects >= 2 ? 4 : 3,
      "Identity-related failures were reported for face, hair, bangs, or eyes.",
      "Check the canonical anchor, Prompt Card identity traits, and section coverage; regenerate weak identity sections or refreeze a cleaner dataset.",
      formatRejectedImageEvidence("identityRejects", rejectedImages, ["identity_wrong", "face_wrong", "hair_wrong", "bangs_wrong", "eye_wrong"]),
    );
  }

  const outfitRejects = countReasons(rejectReasonCounts, ["outfit_wrong", "shoe_wrong"]);
  if (outfitRejects > 0 || hasDiagnosticKeyword(diagnosticText, ["outfit", "clothes", "shoe", "sock", "accessory", "drift", "服装", "衣服", "鞋", "袜", "饰品", "漂移"])) {
    recommend(
      "caption",
      outfitRejects >= 2 ? 4 : 3,
      "Outfit, shoes, socks, accessory, or clothing drift issues were reported.",
      "Make Prompt Card outfit traits and captions explicitly describe clothing, shoes, socks, and accessories, then refreeze the dataset if the training captions changed.",
      formatRejectedImageEvidence("outfitRejects", rejectedImages, ["outfit_wrong", "shoe_wrong"]),
    );
  }

  const compositionRejects = countReasons(rejectReasonCounts, ["pose_wrong", "composition_wrong", "hands_wrong", "anatomy_wrong"]);
  if (compositionRejects > 0 || hasDiagnosticKeyword(diagnosticText, ["composition", "pose", "hands", "anatomy", "section", "构图", "姿势", "手", "肢体", "小节"])) {
    recommend(
      "prompt",
      compositionRejects >= 2 ? 3 : 2,
      "Composition, pose, hand, anatomy, or section prompt issues were reported.",
      "Adjust section/test prompts and workflow parameters first; do not treat a 7-section composition failure as proof that the LoRA itself failed.",
      formatRejectedImageEvidence("compositionRejects", rejectedImages, ["pose_wrong", "composition_wrong", "hands_wrong", "anatomy_wrong"]),
    );
  }

  const pollutionRejects = countReasons(rejectReasonCounts, ["style_wrong", "quality_low", "unsafe"]);
  if (pollutionRejects > 0 || hasDiagnosticKeyword(diagnosticText, ["artifact", "pollution", "background", "watermark", "style", "quality", "污染", "背景", "水印", "画风", "低质量"])) {
    recommend(
      "dataset",
      pollutionRejects >= 2 ? 4 : 3,
      "Style drift, background pollution, low quality, or artifact issues were reported.",
      "Remove polluted candidates, clean captions of background/generator noise, and lower the synthetic share before retraining.",
      formatRejectedImageEvidence("pollutionRejects", rejectedImages, ["style_wrong", "quality_low", "unsafe"]),
    );
  }

  if (latestDataset) {
    const sourceCount = latestDataset.sourceCount ?? 0;
    const syntheticCount = latestDataset.syntheticCount ?? Math.max((latestDataset.itemCount ?? 0) - sourceCount, 0);
    const totalDatasetSources = sourceCount + syntheticCount;
    const sourceRatio = totalDatasetSources > 0 ? sourceCount / totalDatasetSources : 0;
    const captionlessItems = (latestDataset.items ?? []).filter((item) => !item.captionText?.trim());
    if (captionlessItems.length > 0) {
      recommend(
        "caption",
        4,
        `${captionlessItems.length} item(s) in the latest dataset revision have empty caption text.`,
        "Regenerate caption sidecars and freeze a new dataset revision before training.",
      );
    }
    if (!latestDataset.captionAuditArtifactId) {
      recommend(
        "caption",
        2,
        "The latest dataset revision has no caption audit artifact.",
        "Generate/persist a caption audit so trigger order and key identity/outfit terms are reviewable.",
      );
    }
    if (sourceCount === 0 && syntheticCount > 0) {
      recommend(
        "dataset",
        4,
        "The latest dataset revision is entirely synthetic and has no source-anchor items.",
        "Add source/reference anchors or rebalance kept images before retraining, especially for face, hairstyle, eye, outfit, and accessory stability.",
      );
    } else if (sourceRatio > 0 && sourceRatio < 0.2 && syntheticCount >= 4) {
      recommend(
        "dataset",
        3,
        "The latest dataset revision has a low source-to-synthetic ratio.",
        "Increase source/high-quality anchor coverage or source weighting before retraining.",
      );
    }
  }

  if (latestTrainingRun) {
    const keyCount = getJsonNumber(latestTrainingRun.metadataSummary, ["keyCount"]);
    if (latestTrainingRun.status === "failed" || latestTrainingRun.status === "cancelled") {
      recommend(
        "trainingConfig",
        5,
        `Latest training run ended with status=${latestTrainingRun.status}.`,
        "Inspect the training log/config, fix failed launcher or parameter issues, and rerun training from the selected frozen dataset.",
      );
    }
    if (latestTrainingRun.status === "done" && !latestTrainingRun.logArtifactId) {
      recommend(
        "trainingConfig",
        2,
        "Latest completed training run has no log artifact.",
        "Persist the training log so loss/step evidence can support trainingConfig diagnostics.",
      );
    }
    if (latestTrainingRun.status === "done" && (keyCount === null || keyCount <= 0)) {
      recommend(
        "trainingConfig",
        4,
        "Latest completed training run has missing or invalid safetensors metadata key count.",
        "Verify the final safetensors header/metadata before benchmark or promotion.",
      );
    }
    if (
      latestTrainingRun.status === "done" &&
      latestTrainingRun.targetSteps &&
      latestTrainingRun.currentStep !== null &&
      latestTrainingRun.currentStep !== undefined &&
      latestTrainingRun.currentStep < latestTrainingRun.targetSteps
    ) {
      recommend(
        "trainingConfig",
        3,
        "Latest training run finished before reaching targetSteps.",
        "Review resolved training config, loss snapshot, and checkpoint schedule before rerunning.",
      );
    }
  }

  for (const run of input.benchmarkRuns) {
    const suggestions = collectBenchmarkSuggestions(run.resultSummary);
    if (suggestions.length > 0) {
      evidence.push(`benchmarkSuggestions(${run.id})=${suggestions.slice(0, 4).join(" | ")}`);
    }
    const counts = getObject(run.resultSummary, "counts");
    const failed = getJsonNumber(counts, ["failed"]) ?? 0;
    const missing = getJsonNumber(counts, ["missing"]) ?? 0;
    const sectionCount = getArrayLength(run.resultSummary, "sections");
    if (run.status === "done" && (failed > 0 || missing > 0)) {
      recommend(
        "prompt",
        3,
        `Benchmark ${run.id} has failed=${failed}, missing=${missing} section run(s).`,
        "Review test section prompts/workflow failures and rerun benchmark before changing dataset or training config.",
        formatBenchmarkImageEvidence(run),
      );
    }
    if (run.status === "done" && sectionCount > 0 && sectionCount < 7) {
      recommend(
        "prompt",
        3,
        `Benchmark ${run.id} covered ${sectionCount} section(s), fewer than the 7-section PRD review target.`,
        "Run the full character LoRA test template before approving promotion.",
      );
    }

    const weights = extractNumbers(run.weightMatrix);
    if (run.status === "done" && weights.length < 2) {
      recommend(
        "weightSelection",
        2,
        `Benchmark ${run.id} did not compare multiple LoRA weights.`,
        "Run a weight matrix such as 0.65/0.85/1.0 before choosing final preset weights.",
      );
    }
    if (run.recommendedWeight && weights.length > 0) {
      const minWeight = Math.min(...weights);
      const maxWeight = Math.max(...weights);
      if (run.recommendedWeight >= maxWeight && maxWeight >= 0.95) {
        recommend(
          "trainingConfig",
          3,
          `Benchmark ${run.id} selected the highest tested weight (${run.recommendedWeight}).`,
          "If low weights do not activate the character, inspect trigger/caption binding and training strength before retraining.",
        );
      } else if (run.recommendedWeight <= minWeight && minWeight <= 0.7) {
        recommend(
          "weightSelection",
          2,
          `Benchmark ${run.id} selected the lowest tested weight (${run.recommendedWeight}).`,
          "Prefer the lower final weight or an earlier checkpoint before increasing training strength.",
        );
      }
    }
  }

  if (hasDiagnosticKeyword(diagnosticText, ["high weight", "overfit", "collapse", "distort", "崩", "过拟合", "变形"])) {
    recommend(
      "weightSelection",
      4,
      "Diagnostics mention high-weight collapse, distortion, or overfitting.",
      "Try a lower final weight or earlier checkpoint first; only return to trainingConfig if all tested weights fail.",
    );
  }

  if (hasDiagnosticKeyword(diagnosticText, ["low weight", "not effective", "weak trigger", "underfit", "不生效", "弱", "欠拟合"])) {
    recommend(
      "trainingConfig",
      4,
      "Diagnostics mention low-weight ineffectiveness or weak trigger binding.",
      "Inspect captions, trigger placement, target steps, rank/alpha, and learning rates before retraining.",
    );
  }

  if (latestRejectedDecision) {
    const mappedPoint = mapRejectedReturnPoint(latestRejectedDecision.rejectedReturnPoint ?? input.status);
    recommend(
      mappedPoint,
      4,
      "Latest promotion decision was rejected.",
      "Use the rejected decision reason plus benchmark evidence to choose the next dataset/caption/prompt/trainingConfig/weightSelection rerun.",
      `promotionRejectedDecision=${latestRejectedDecision.id}, rejectedReturnPoint=${latestRejectedDecision.rejectedReturnPoint ?? "-"}, jobReturnStatus=${input.status}, mappedReturnPoint=${mappedPoint}, reason=${latestRejectedDecision.decisionReason ?? "-"}`,
    );
  }

  return {
    recommendedReturnPoint: recommendedReturnPoint as DiagnosticReturnPoint,
    reasons,
    evidence,
    actions,
    risk: severityToRisk(strongestSeverity),
    coverage: {
      sourceImages: input.counts.sourceImages,
      canonicalVersions: input.counts.canonicalVersions,
      promptCardVersions: input.counts.promptCardVersions,
      sections: input.counts.sections,
      candidateImages: input.counts.candidateImages,
      datasetRevisions: input.counts.datasetRevisions,
      datasetItems: input.counts.datasetItems,
      trainingRuns: input.counts.trainingRuns,
      benchmarkRuns: input.counts.benchmarkRuns,
      promotionDecisions: input.counts.promotionDecisions,
      workerTasks: input.counts.workerTasks ?? 0,
    },
  };
}

function pushUnique(items: string[], value: string) {
  const normalized = value.trim();
  if (normalized && !items.includes(normalized)) {
    items.push(normalized);
  }
}

function severityToRisk(severity: number): DiagnosticRisk {
  if (severity >= 4) return "high";
  if (severity >= 2) return "medium";
  return "low";
}

function getLast<T>(items: T[]): T | null {
  return items.length > 0 ? items[items.length - 1] : null;
}

function buildRejectReasonCounts(
  images: Array<{ review: { rejectReasons?: unknown } }>,
) {
  const counts = new Map<string, number>();
  for (const image of images) {
    for (const reason of extractRejectReasons(image.review.rejectReasons)) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return counts;
}

function extractRejectReasons(value: unknown): string[] {
  const found = new Set<string>();
  collectReasonStrings(value, found);
  return Array.from(found);
}

function collectReasonStrings(value: unknown, found: Set<string>) {
  if (!value) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) found.add(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReasonStrings(item, found);
    }
    return;
  }
  if (typeof value !== "object") return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue === true) {
      found.add(key);
      continue;
    }
    collectReasonStrings(nestedValue, found);
  }
}

function countReasons(counts: Map<string, number>, reasons: string[]) {
  return reasons.reduce((sum, reason) => sum + (counts.get(reason) ?? 0), 0);
}

function formatReasonCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(", ");
}

function summarizeSections(
  sections: Array<{
    key: string;
    name?: string;
    keepCount: number;
    rejectCount: number;
    pendingCount: number;
    targetKeepCount: number;
  }>,
) {
  if (sections.length === 0) return null;
  const underTarget = sections.filter((section) => section.keepCount < section.targetKeepCount);
  const highReject = sections.filter((section) => section.rejectCount > Math.max(section.keepCount, 0));
  const pending = sections.filter((section) => section.pendingCount > 0);
  return [
    `underTarget=${formatSectionExamples(underTarget)}`,
    `highReject=${formatSectionExamples(highReject)}`,
    `pending=${formatSectionExamples(pending)}`,
  ].join("; ");
}

function formatSectionExamples(
  sections: Array<{
    key: string;
    name?: string;
    keepCount: number;
    rejectCount: number;
    pendingCount: number;
    targetKeepCount: number;
  }>,
) {
  if (sections.length === 0) return "-";
  return sections
    .slice(0, 4)
    .map((section) =>
      `${section.key}(${section.keepCount}/${section.targetKeepCount} keep, reject=${section.rejectCount}, pending=${section.pendingCount})`,
    )
    .join(", ");
}

function formatRejectedImageEvidence(
  label: string,
  images: Array<{
    id: string;
    relativePath?: string | null;
    review: { rejectReasons?: unknown };
  }>,
  reasons: string[],
) {
  const reasonSet = new Set(reasons);
  const examples = images.filter((image) =>
    extractRejectReasons(image.review.rejectReasons).some((reason) => reasonSet.has(reason)),
  );
  return examples.length > 0 ? `${label}=${formatImageExamples(examples)}` : undefined;
}

function formatImageExamples(images: Array<{ id: string; relativePath?: string | null }>) {
  if (images.length === 0) return "-";
  return images
    .slice(0, 4)
    .map((image) => (image.relativePath ? `${image.id}:${image.relativePath}` : image.id))
    .join(", ");
}

function hasDiagnosticKeyword(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getObject(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const nested = (value as Record<string, unknown>)[key];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? nested : null;
}

function getJsonNumber(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const nested = record[key];
    if (typeof nested === "number" && Number.isFinite(nested)) return nested;
  }
  return null;
}

function getArrayLength(value: unknown, key: string | null) {
  const target = key === null
    ? value
    : value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)[key]
      : null;
  return Array.isArray(target) ? target.length : 0;
}

function extractNumbers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

function collectBenchmarkSuggestions(resultSummary: unknown) {
  return collectStrings(resultSummary, ["diagnosticSuggestion", "diagnosticSuggestions", "warning", "warnings"]);
}

function formatBenchmarkImageEvidence(run: {
  id: string;
  summary?: { testRunIds?: string[]; testImageIds?: string[] };
}) {
  const imageIds = run.summary?.testImageIds ?? [];
  const runIds = run.summary?.testRunIds ?? [];
  if (imageIds.length === 0 && runIds.length === 0) return undefined;
  return `benchmarkEvidence(${run.id})=images:${imageIds.slice(0, 5).join(",") || "-"}; runs:${runIds.slice(0, 5).join(",") || "-"}`;
}

function mapRejectedReturnPoint(status: string): DiagnosticReturnPoint {
  switch (status) {
    case "dataset":
    case "caption":
    case "prompt":
    case "trainingConfig":
    case "weightSelection":
      return status;
    case "dataset_ready":
    case "reviewing":
    case "section_generating":
      return "dataset";
    case "trained":
    case "training_queued":
    case "training_running":
      return "trainingConfig";
    case "benchmarking":
    case "benchmark_review":
    case "promotion_ready":
      return "weightSelection";
    case "prompt_pending":
      return "prompt";
    case "canonical_pending":
      return "canonical";
    case "draft":
      return "source";
    default:
      return "weightSelection";
  }
}

export function collectStrings(value: unknown, keys: string[]) {
  const found = new Set<string>();
  collectStringsFromValue(value, new Set(keys), found);
  return Array.from(found);
}

function collectStringsFromValue(value: unknown, keys: Set<string>, found: Set<string>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringsFromValue(item, keys, found);
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (keys.has(key)) {
      if (typeof nestedValue === "string") {
        found.add(nestedValue);
      } else if (Array.isArray(nestedValue)) {
        for (const item of nestedValue) {
          if (typeof item === "string") found.add(item);
        }
      }
    }

    collectStringsFromValue(nestedValue, keys, found);
  }
}

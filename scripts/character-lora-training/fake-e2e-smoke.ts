import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

type ServiceModules = {
  jobService: typeof import("../../src/server/services/character-lora-training/job-service");
  sourceImageService: typeof import("../../src/server/services/character-lora-training/source-image-service");
  canonicalService: typeof import("../../src/server/services/character-lora-training/canonical-service");
  promptCardService: typeof import("../../src/server/services/character-lora-training/prompt-card-service");
  sectionTemplateService: typeof import("../../src/server/services/character-lora-training/section-template-service");
  phase3Service: typeof import("../../src/server/services/character-lora-training/phase3-service");
  trainingService: typeof import("../../src/server/services/character-lora-training/training-service");
  benchmarkPromotionService: typeof import("../../src/server/services/character-lora-training/benchmark-promotion-service");
  reportService: typeof import("../../src/server/services/character-lora-training/report-service");
  artifactService: typeof import("../../src/server/services/character-lora-training/artifact-service");
  prismaModule: typeof import("../../src/lib/prisma");
};

type SmokeSummary = {
  tempRoot: string;
  databaseUrl: string;
  artifactRoot: string;
  job: {
    id: string;
    slug: string;
    status: string;
    phase: string | null;
  };
  source: {
    id: string;
    sha256: string;
    relativePath: string;
  };
  canonical: {
    id: string;
    version: number;
    status: string;
  };
  promptCard: {
    id: string;
    version: number;
    triggerToken: string;
  };
  sections: Array<{
    id: string;
    key: string;
    imageIds: string[];
  }>;
  caption: {
    imageId: string;
    captionDraft: string;
    triggerFirst: boolean;
  };
  dataset: {
    id: string;
    version: number;
    itemCount: number;
    trainDir: string;
  };
  training: {
    id: string;
    status: string;
    configPath: string;
    finalSha256: string;
    logPath: string;
  };
  benchmark: {
    id: string;
    status: string;
    reportArtifactId: string | null;
    resultSummary: unknown;
  };
  promotion: {
    decisionId: string;
    decisionStatus: string;
    presetId: string;
    variantCount: number;
    weights: number[];
  };
  report: {
    recommendedReturnPoint: string;
    risk: string;
    jsonArtifactPath: string;
    markdownArtifactPath: string;
    coverage: {
      sourceImages: number;
      canonicalVersions: number;
      promptCardVersions: number;
      candidateImages: number;
      datasetRevisions: number;
      datasetItems: number;
      trainingRuns: number;
      benchmarkRuns: number;
      promotionDecisions: number;
    };
  };
};

const HELP = `
Character LoRA Training fake E2E smoke

Usage:
  cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts
  cmd /c npx tsx scripts/character-lora-training/fake-e2e-smoke.ts --help

Behavior:
  - Creates a temp SQLite database and temp CHARACTER_LORA_ARTIFACT_ROOT.
  - Runs prisma db push against prisma/schema.sqlite.prisma.
  - Imports app services only after DB_PROVIDER/DATABASE_URL/artifact env setup.
  - Exercises source -> canonical -> prompt card -> sections -> review -> dataset
    -> training -> benchmark -> promotion on the isolated DB.

Options:
  --skip-prisma-push  Reuse the temp DB schema as-is. Intended only for debugging.
`.trim();

const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(HELP);
  process.exit(0);
}

main().catch(async (error) => {
  console.error("[character-lora fake-e2e-smoke] failed");
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "character-lora-fake-e2e-"));
  const dbPath = path.join(tempRoot, "smoke.db");
  const artifactRoot = path.join(tempRoot, "artifacts");
  const modelRoot = path.join(tempRoot, "models");
  const baseCheckpointPath = path.join(modelRoot, "checkpoints", "fake-base.safetensors");

  await mkdir(path.dirname(baseCheckpointPath), { recursive: true });
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(baseCheckpointPath, Buffer.from("fake base checkpoint for smoke test\n", "utf8"));

  const databaseUrl = toPrismaSqliteUrl(dbPath);
  process.env.DB_PROVIDER = "sqlite";
  process.env.DATABASE_URL = databaseUrl;
  process.env.CHARACTER_LORA_ARTIFACT_ROOT = artifactRoot;
  process.env.MODEL_BASE_DIR = modelRoot;

  if (!args.has("--skip-prisma-push")) {
    runPrismaDbPush(databaseUrl);
  }

  const services = await importServices();
  const baseCheckpointHash = sha256(Buffer.from("fake base checkpoint for smoke test\n", "utf8"));
  const triggerToken = "smoke_lora_chr";

  const job = await services.jobService.createCharacterLoraTrainingJob({
    characterName: "Smoke Character",
    triggerToken,
    trainingScope: {
      purpose: "phase6_fake_e2e_smoke",
      isolated: true,
      source: "scripts/character-lora-training/fake-e2e-smoke.ts",
    },
    baseCheckpointName: "fake-base.safetensors",
    baseCheckpointPath,
    baseCheckpointHash,
    baseFamily: "sdxl",
    phase: "draft",
    createdBy: "fake-e2e-smoke",
  });
  assert(job.status === "draft", "job should start as draft");

  const source = await services.sourceImageService.uploadCharacterLoraSourceImage(job.id, {
    file: new File([PLACEHOLDER_PNG], "source.png", { type: "image/png" }),
    role: "source",
    sortOrder: 0,
    provenance: {
      smoke: true,
      original: "generated 1x1 png",
    },
  });
  assertHexSha(source.sha256, "source sha256");

  const canonicalRun = await services.canonicalService.enqueueCharacterLoraCanonicalGenerationRun(job.id, {
    provider: "mock-local",
    sourceImageIds: [source.id],
    renderedPrompt: `${triggerToken}, canonical identity reference`,
  });
  const canonicalCompleted = await services.canonicalService.mockCompleteCharacterLoraCanonicalGenerationRun(
    canonicalRun.id,
    { sourceImageId: source.id },
  );
  const canonicalVersion = canonicalCompleted.canonicalVersion;
  const selectedCanonical = await services.canonicalService.selectCharacterLoraCanonicalVersion(
    job.id,
    canonicalVersion.id,
  );
  assert(selectedCanonical.job.currentCanonicalVersionId === canonicalVersion.id, "canonical should be selected");

  const promptCard = await services.promptCardService.createCharacterLoraPromptCardVersion(job.id, {
    canonicalVersionId: canonicalVersion.id,
    triggerToken,
    identityTraits: {
      hair: "short dark hair",
      eyes: "blue eyes",
      silhouette: "simple smoke-test silhouette",
    },
    outfitTraits: {
      top: "white jacket",
      shoes: "black boots",
    },
    negativeTraits: {
      avoid: ["wrong identity", "logo", "text"],
    },
    finalPromptDraft: `${triggerToken}, Smoke Character, white jacket, black boots, clean reference`,
    changeReason: "fake e2e smoke prompt card",
  });
  assert(promptCard.version >= 1, "prompt card version should be created");

  const instantiated = await services.sectionTemplateService.instantiateCharacterLoraJobSections(job.id, {
    templateKeys: ["front_fullbody", "portrait"],
  });
  assert(instantiated.sections.length === 2, "expected two instantiated sections");

  const sectionsWithImages: SmokeSummary["sections"] = [];
  for (const section of instantiated.sections) {
    const sectionRun = await services.phase3Service.enqueueCharacterLoraSectionGenerationRun(section.id, {
      provider: "mock-local",
      renderedPrompt: `${triggerToken}, ${section.name}, fake section candidate`,
    });
    const leasedTask = await services.phase3Service.leaseNextCharacterLoraTask({
      workerType: "image_generation",
      leaseOwner: `fake-image-worker-${section.key}`,
      leaseDurationSeconds: 300,
    });
    assert(leasedTask, `image task should be leased for section ${section.key}`);
    assert(leasedTask.targetId === sectionRun.id, `leased image task should target section run ${sectionRun.id}`);

    const payload = readTaskPayload(leasedTask.payload);
    assert(payload.taskType === "image_generation", "leased image task payload should be image_generation");
    const outputDir = payload.request.outputDir;
    const imagePath = `${outputDir}/candidate-001.png`;
    const metadataPath = `${outputDir}/candidate-001.metadata.json`;
    const responseSummaryPath = `${outputDir}/response-summary.json`;
    const imageBytes = Buffer.concat([
      PLACEHOLDER_PNG,
      Buffer.from(`\n${section.key}:${sectionRun.id}\n`, "utf8"),
    ]);
    await writeJobArtifact(services.artifactService, job.artifactRoot, imagePath, imageBytes);
    await writeJobArtifact(
      services.artifactService,
      job.artifactRoot,
      metadataPath,
      Buffer.from(JSON.stringify({ sectionId: section.id, sectionKey: section.key }, null, 2), "utf8"),
    );

    await services.phase3Service.completeCharacterLoraTask(leasedTask.id, {
      leaseOwner: leasedTask.leaseOwner,
      output: {
        images: [
          {
            relativePath: imagePath,
            sha256: sha256(imageBytes),
            width: 1,
            height: 1,
            metadataPath,
          },
        ],
        requestRedactedPath: payload.request.outputDir + "/request.redacted.json",
        responseSummaryPath,
        elapsedMs: 1,
      },
    });

    const sectionImages = await services.phase3Service.listCharacterLoraCandidateImages(job.id, {
      sectionId: section.id,
      generationRunId: sectionRun.id,
    });
    assert(sectionImages.length === 1, `expected one candidate image for section ${section.key}`);
    sectionsWithImages.push({
      id: section.id,
      key: section.key,
      imageIds: sectionImages.map((image) => image.id),
    });
  }

  const allImages = await services.phase3Service.listCharacterLoraCandidateImages(job.id);
  assert(allImages.length === 2, "expected two candidate images before review");
  await services.phase3Service.reviewCharacterLoraImages({
    images: allImages.map((image) => ({
      imageId: image.id,
      reviewStatus: "keep",
      reviewNote: "fake smoke keep",
    })),
  });
  const captioned = await services.phase3Service.updateCharacterLoraImageCaption(allImages[0].id, {
    captionDraft: "portrait smoke test, clean face",
  });
  assert(captioned.captionDraft?.startsWith(`${triggerToken},`), "caption should be normalized trigger-first");

  const frozen = await services.phase3Service.freezeCharacterLoraDataset(job.id, {
    force: true,
    repeatCount: 1,
    sourceWeight: 1,
  });
  assert(frozen.revision.itemCount === allImages.length, "dataset item count should match kept images");

  const trainingEnqueued = await services.trainingService.enqueueCharacterLoraTrainingRun(frozen.revision.id, {
    launcher: "sd-scripts",
    queuePolicy: "reject_when_busy",
    configProfile: "conservative",
    overrides: {
      ordinary: {
        targetSteps: 4,
        saveInterval: 2,
        resolution: 512,
      },
      advanced: {
        seed: 1234,
      },
      expert: {
        fakeE2eSmoke: true,
      },
    },
    lease: {
      leaseOwner: "fake-training-worker",
      leaseDurationSeconds: 300,
    },
  });
  const trainingTask = await services.phase3Service.leaseNextCharacterLoraTask({
    workerType: "training",
    leaseOwner: "fake-training-worker",
    leaseDurationSeconds: 300,
  });
  assert(trainingTask, "training task should be leased");
  assert(trainingTask.targetId === trainingEnqueued.trainingRun.id, "leased training task should target training run");
  await services.phase3Service.heartbeatCharacterLoraTask(trainingTask.id, {
    leaseOwner: "fake-training-worker",
    progressJson: {
      step: 2,
      targetSteps: 4,
      loss: 0.123,
      currentCheckpoint: `${trainingEnqueued.trainingRun.outputDir}/checkpoint-step-0002.safetensors`,
    },
  });

  const trainingPayload = readTaskPayload(trainingTask.payload);
  assert(trainingPayload.taskType === "training", "leased training task payload should be training");
  const finalPath = `${trainingPayload.outputDir}/smoke-final.safetensors`;
  const checkpointPath = `${trainingPayload.outputDir}/checkpoint-step-0004.safetensors`;
  const logPath = `${trainingPayload.outputDir}/train.log`;
  const finalBytes = Buffer.from(`fake safetensors ${trainingPayload.trainingRunId}\n`, "utf8");
  const checkpointBytes = Buffer.from(`fake checkpoint ${trainingPayload.trainingRunId}\n`, "utf8");
  const logBytes = Buffer.from("fake training worker completed\nloss=0.001\n", "utf8");
  await writeJobArtifact(services.artifactService, job.artifactRoot, finalPath, finalBytes);
  await writeJobArtifact(services.artifactService, job.artifactRoot, checkpointPath, checkpointBytes);
  await writeJobArtifact(services.artifactService, job.artifactRoot, logPath, logBytes);
  const finalSha256 = sha256(finalBytes);

  const trainingCompleted = await services.phase3Service.completeCharacterLoraTask(trainingTask.id, {
    leaseOwner: "fake-training-worker",
    output: {
      finalSafetensorsArtifact: {
        kind: "safetensors",
        relativePath: finalPath,
        sha256: finalSha256,
      },
      finalSha256,
      hashes: {
        final: finalSha256,
      },
      metadataSummary: {
        keyCount: 2,
        summary: {
          fakeE2eSmoke: true,
          triggerToken,
        },
      },
      checkpoints: [
        {
          step: 4,
          artifact: {
            kind: "safetensors",
            relativePath: checkpointPath,
            sha256: sha256(checkpointBytes),
          },
          metrics: {
            loss: 0.001,
          },
        },
      ],
      trainingLogArtifact: {
        kind: "training_log",
        relativePath: logPath,
        sha256: sha256(logBytes),
      },
      elapsedMs: 1,
    },
  });
  assert("trainingRun" in trainingCompleted, "training completion should return a trainingRun");
  const completedTrainingRun = trainingCompleted.trainingRun;
  assert(completedTrainingRun, "training completion should include refreshed training run");
  assert(completedTrainingRun.status === "done", "training run should be done");
  assert(completedTrainingRun.finalSha256 === finalSha256, "training final sha256 should be stored");

  const benchmarkCreated = await services.benchmarkPromotionService.enqueueCharacterLoraBenchmarkRun(
    completedTrainingRun.id,
    {
      checkpointMatrix: ["fake-base.safetensors"],
      weightMatrix: [0.72],
      registerLoraAsset: true,
      copyToCharacterDir: false,
      loraAssetName: "Smoke Character LoRA",
      dryRun: true,
      skipQueue: true,
    },
  );
  const benchmarkRun = "completedBenchmarkRun" in benchmarkCreated
    ? benchmarkCreated.completedBenchmarkRun
    : benchmarkCreated.benchmarkRun;
  assert(benchmarkRun.status === "done", "benchmark should be mock-completed when dryRun/skipQueue is true");
  assert(benchmarkRun.loraAssetId, "benchmark should register a LoRA asset");

  const decision = await services.benchmarkPromotionService.createPromotionDecision(benchmarkRun.id, {
    status: "approved",
    selectedLoraAssetId: benchmarkRun.loraAssetId,
    selectedCheckpoint: "fake-base.safetensors",
    defaultRecommendedWeight: 0.72,
    perVariantWeightOverrides: {
      portrait: 0.65,
      naked: 0.6,
    },
    variantPromptDrafts: {
      default: `${triggerToken}, Smoke Character, default promoted prompt`,
    },
    decisionReason: "phase6 fake e2e approved on isolated sqlite database",
  });
  assert(decision.status === "approved", "promotion decision should be approved");

  const promoted = await services.benchmarkPromotionService.promoteCharacterLoraPreset(decision.id, {
    dryRun: false,
    overwriteExisting: false,
  });
  assert("decision" in promoted, "promotion should return a persisted decision");
  assert(promoted.decision.status === "promoted", "promotion decision should be promoted");
  assert(promoted.presetId, "promotion should create a preset");

  const variants = await services.prismaModule.prisma.presetVariant.findMany({
    where: { presetId: promoted.presetId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, slug: true, lora1: true, lora2: true },
  });
  assert(variants.length === 7, `expected 7 promoted preset variants, got ${variants.length}`);
  const weights = variants.map((variant) => {
    const entries = Array.isArray(variant.lora1) ? variant.lora1 : [];
    const first = entries[0];
    assert(first && typeof first === "object" && "weight" in first, `variant ${variant.slug} should have lora1 weight`);
    return Number((first as { weight: unknown }).weight);
  });
  assert(weights.every((weight) => Number.isFinite(weight) && weight > 0), "variant weights should be positive");

  const persistedReport = await services.reportService.persistCharacterLoraJobReport(job.id);
  const report = persistedReport.report;
  assert(report.sourceImages.length >= 1, "report should include source images");
  assert(report.canonicalVersions.some((version) => version.id === canonicalVersion.id), "report should include canonical version");
  assert(report.promptCardVersions.some((version) => version.id === promptCard.id), "report should include prompt card version");
  assert(
    report.candidateImages.some((image) => image.id === captioned.id && Boolean(image.caption.draft)),
    "report should include candidate caption",
  );
  assert(report.datasetRevisions.some((revision) => revision.id === frozen.revision.id && revision.items.length === allImages.length), "report should include dataset revision/items");
  assert(
    report.trainingRuns.some((run) => run.id === completedTrainingRun.id && run.finalSha256 === finalSha256),
    "report should include training finalSha",
  );
  assert(report.benchmarkRuns.some((run) => run.id === benchmarkRun.id), "report should include benchmark run");
  assert(report.promotionDecisions.some((item) => item.id === promoted.decision.id), "report should include promotion decision");
  assert(persistedReport.artifacts.json?.relativePath.endsWith(".json"), "report JSON artifact should be persisted");
  assert(persistedReport.artifacts.markdown?.relativePath.endsWith(".md"), "report markdown artifact should be persisted");

  const finalJob = await services.jobService.getCharacterLoraTrainingJob(job.id);
  const configArtifact = await services.prismaModule.prisma.characterLoraArtifact.findUnique({
    where: { id: completedTrainingRun.configArtifactId },
    select: { relativePath: true },
  });
  assert(configArtifact, "training config artifact should exist");

  const summary: SmokeSummary = {
    tempRoot,
    databaseUrl,
    artifactRoot,
    job: {
      id: finalJob.id,
      slug: finalJob.slug,
      status: finalJob.status,
      phase: finalJob.phase,
    },
    source: {
      id: source.id,
      sha256: source.sha256,
      relativePath: source.relativePath,
    },
    canonical: {
      id: canonicalVersion.id,
      version: canonicalVersion.version,
      status: selectedCanonical.canonicalVersion.status,
    },
    promptCard: {
      id: promptCard.id,
      version: promptCard.version,
      triggerToken: promptCard.triggerToken,
    },
    sections: sectionsWithImages,
    caption: {
      imageId: captioned.id,
      captionDraft: captioned.captionDraft ?? "",
      triggerFirst: captioned.captionDraft?.split(",")[0]?.trim() === triggerToken,
    },
    dataset: {
      id: frozen.revision.id,
      version: frozen.revision.version,
      itemCount: frozen.revision.itemCount,
      trainDir: frozen.revision.trainDir,
    },
    training: {
      id: completedTrainingRun.id,
      status: completedTrainingRun.status,
      configPath: configArtifact.relativePath,
      finalSha256,
      logPath,
    },
    benchmark: {
      id: benchmarkRun.id,
      status: benchmarkRun.status,
      reportArtifactId: benchmarkRun.reportArtifactId,
      resultSummary: benchmarkRun.resultSummary,
    },
    promotion: {
      decisionId: promoted.decision.id,
      decisionStatus: promoted.decision.status,
      presetId: promoted.presetId,
      variantCount: variants.length,
      weights,
    },
    report: {
      recommendedReturnPoint: report.diagnosticSummary.recommendedReturnPoint,
      risk: report.diagnosticSummary.risk,
      jsonArtifactPath: persistedReport.artifacts.json?.relativePath ?? "",
      markdownArtifactPath: persistedReport.artifacts.markdown?.relativePath ?? "",
      coverage: report.diagnosticSummary.coverage,
    },
  };

  assert(summary.job.status === "promoted", `final job status should be promoted, got ${summary.job.status}`);
  assert(summary.job.phase === "promotion", `final job phase should be promotion, got ${summary.job.phase}`);
  assert(summary.caption.triggerFirst, "caption trigger-first assertion should be true");
  assertHexSha(summary.training.finalSha256, "final training sha256");
  assert(summary.report.coverage.sourceImages >= 1, "report summary should cover source");
  assert(summary.report.coverage.canonicalVersions >= 1, "report summary should cover canonical");
  assert(summary.report.coverage.promptCardVersions >= 1, "report summary should cover prompt");
  assert(summary.report.coverage.candidateImages >= allImages.length, "report summary should cover candidates");
  assert(summary.report.coverage.datasetItems >= allImages.length, "report summary should cover dataset items");
  assert(summary.report.coverage.trainingRuns >= 1, "report summary should cover training");
  assert(summary.report.coverage.benchmarkRuns >= 1, "report summary should cover benchmark");
  assert(summary.report.coverage.promotionDecisions >= 1, "report summary should cover promotion");

  console.log("Character LoRA fake E2E smoke passed.");
  console.log(JSON.stringify(summary, null, 2));

  await services.prismaModule.prisma.$disconnect();
}

async function importServices(): Promise<ServiceModules> {
  const [
    jobService,
    sourceImageService,
    canonicalService,
    promptCardService,
    sectionTemplateService,
    phase3Service,
    trainingService,
    benchmarkPromotionService,
    reportService,
    artifactService,
    prismaModule,
  ] = await Promise.all([
    import("../../src/server/services/character-lora-training/job-service"),
    import("../../src/server/services/character-lora-training/source-image-service"),
    import("../../src/server/services/character-lora-training/canonical-service"),
    import("../../src/server/services/character-lora-training/prompt-card-service"),
    import("../../src/server/services/character-lora-training/section-template-service"),
    import("../../src/server/services/character-lora-training/phase3-service"),
    import("../../src/server/services/character-lora-training/training-service"),
    import("../../src/server/services/character-lora-training/benchmark-promotion-service"),
    import("../../src/server/services/character-lora-training/report-service"),
    import("../../src/server/services/character-lora-training/artifact-service"),
    import("../../src/lib/prisma"),
  ]);

  return {
    jobService,
    sourceImageService,
    canonicalService,
    promptCardService,
    sectionTemplateService,
    phase3Service,
    trainingService,
    benchmarkPromotionService,
    reportService,
    artifactService,
    prismaModule,
  };
}

function runPrismaDbPush(databaseUrl: string) {
  execFileSync(
    "cmd",
    ["/c", "npx", "prisma", "db", "push", "--schema", "prisma/schema.sqlite.prisma"],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: {
        ...process.env,
        DB_PROVIDER: "sqlite",
        DATABASE_URL: databaseUrl,
      },
    },
  );
}

function toPrismaSqliteUrl(dbPath: string) {
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

async function writeJobArtifact(
  artifactService: ServiceModules["artifactService"],
  jobRoot: string,
  relativePath: string,
  bytes: Buffer,
) {
  await artifactService.writeCharacterLoraBufferArtifact(jobRoot, relativePath, bytes);
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertHexSha(value: string | null | undefined, label: string): asserts value is string {
  assert(Boolean(value && /^[a-f0-9]{64}$/i.test(value)), `${label} should be a sha256 hex string`);
}

function readTaskPayload(payload: unknown) {
  assert(payload && typeof payload === "object", "worker task payload should be an object");
  return payload as
    | {
        taskType: "image_generation";
        request: {
          outputDir: string;
        };
      }
    | {
        taskType: "training";
        trainingRunId: string;
        outputDir: string;
      };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

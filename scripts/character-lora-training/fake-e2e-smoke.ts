import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
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

type BenchmarkEnqueueResult = Awaited<ReturnType<ServiceModules["benchmarkPromotionService"]["enqueueCharacterLoraBenchmarkRun"]>>;

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
  sourceCandidate: {
    id: string;
    generationRunId: string;
    reviewStatus: string;
    origin: string;
    repeatCount: number;
    sourceWeight: number;
  };
  canonical: {
    id: string;
    version: number;
    status: string;
    manualVersionId: string;
    manualVersion: number;
  };
  promptCard: {
    id: string;
    version: number;
    triggerToken: string;
    promotedFromSectionInstruction: boolean;
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
    sourceCount: number;
    syntheticCount: number;
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
  const smokeTrainingScope = createSmokeTrainingScope();

  await assertRejects(
    () => services.jobService.createCharacterLoraTrainingJob({
      characterName: "Invalid Mixed Scope",
      triggerToken: "invalid_mixed_scope",
      trainingScope: {
        purpose: "character_identity",
        primaryOutfitOrForm: "white jacket and black boots",
        mixingPolicy: {
          allowMixedCharacters: true,
          allowMultipleOfficialOutfits: false,
        },
      },
      baseCheckpointName: "fake-base.safetensors",
      baseCheckpointPath,
      baseCheckpointHash,
      baseFamily: "sdxl",
      phase: "draft",
      createdBy: "fake-e2e-smoke",
    }),
    "job creation should reject mixed-character training without advancedExperiment and reason",
  );

  await assertRejects(
    () => services.jobService.createCharacterLoraTrainingJob({
      characterName: "Invalid Derived Scope",
      triggerToken: "invalid_derived_scope_no_advanced",
      trainingScope: {
        purpose: "character_identity",
        primaryOutfitOrForm: "white jacket and black boots",
        advancedExperiment: false,
        mixingPolicy: {
          allowMixedCharacters: false,
          allowMultipleOfficialOutfits: false,
          note: "single identity only",
        },
        derivedStates: [{
          state: "nude",
          includeInTraining: true,
          captionTag: "nude_state",
          ratioLimit: 0.05,
          riskNote: "would overfit a benchmark-only derived state",
        }],
      },
      baseCheckpointName: "fake-base.safetensors",
      baseCheckpointPath,
      baseCheckpointHash,
      baseFamily: "sdxl",
      phase: "draft",
      createdBy: "fake-e2e-smoke",
    }),
    "job creation should reject derived-state training without advancedExperiment",
  );

  await assertRejects(
    () => services.jobService.createCharacterLoraTrainingJob({
      characterName: "Invalid Derived Scope",
      triggerToken: "invalid_derived_scope",
      trainingScope: {
        purpose: "character_identity",
        primaryOutfitOrForm: "white jacket and black boots",
        advancedExperiment: true,
        mixingPolicy: {
          allowMixedCharacters: false,
          allowMultipleOfficialOutfits: false,
          note: "single identity only",
        },
        derivedStates: [{
          state: "nude",
          includeInTraining: true,
          captionTag: "nude_state",
          ratioLimit: 0.05,
        }],
      },
      baseCheckpointName: "fake-base.safetensors",
      baseCheckpointPath,
      baseCheckpointHash,
      baseFamily: "sdxl",
      phase: "draft",
      createdBy: "fake-e2e-smoke",
    }),
    "job creation should reject derived-state training without riskNote",
  );

  await assertRejects(
    () => services.jobService.createCharacterLoraTrainingJob({
      characterName: "Invalid Derived Scope",
      triggerToken: "invalid_derived_scope_explicit_false",
      trainingScope: {
        purpose: "character_identity",
        primaryOutfitOrForm: "white jacket and black boots",
        advancedExperiment: true,
        mixingPolicy: {
          allowMixedCharacters: false,
          allowMultipleOfficialOutfits: false,
          note: "single identity only",
        },
        derivedStates: [{
          state: "nude",
          includeInTraining: true,
          advancedExperiment: false,
          captionTag: "nude_state",
          ratioLimit: 0.05,
          riskNote: "would overfit a benchmark-only derived state",
        }],
      },
      baseCheckpointName: "fake-base.safetensors",
      baseCheckpointPath,
      baseCheckpointHash,
      baseFamily: "sdxl",
      phase: "draft",
      createdBy: "fake-e2e-smoke",
    }),
    "job creation should reject derived-state training with explicit advancedExperiment=false",
  );

  const job = await services.jobService.createCharacterLoraTrainingJob({
    characterName: "Smoke Character",
    triggerToken,
    trainingScope: smokeTrainingScope,
    baseCheckpointName: "fake-base.safetensors",
    baseCheckpointPath,
    baseCheckpointHash,
    baseFamily: "sdxl",
    phase: "draft",
    createdBy: "fake-e2e-smoke",
  });
  assert(job.status === "draft", "job should start as draft");
  assertTrainingScopeNormalized(job.trainingScope, "created job");
  const initialJobArtifact = readJsonRecord(await readJobJsonArtifact(job.artifactRoot, "job.json"));
  assertTrainingScopeNormalized(initialJobArtifact.trainingScope, "initial job artifact");

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

  const registeredSourceCandidate = await services.sourceImageService.registerCharacterLoraSourceImageAsCandidate(job.id, {
    sourceImageId: source.id,
  });
  assert(registeredSourceCandidate.created, "source candidate should be created on first registration");
  assert(
    registeredSourceCandidate.candidate.reviewStatus === "pending",
    "source candidate should default to pending for human review gate",
  );
  assert(
    registeredSourceCandidate.candidate.artifactId === source.artifactId,
    "source candidate should point at the source image artifact",
  );
  assert(
    registeredSourceCandidate.generationRun?.kind === "source_candidate",
    "source candidate registration should create a source_candidate run",
  );
  const registeredAgain = await services.sourceImageService.registerCharacterLoraSourceImageAsCandidate(job.id, {
    sourceImageId: source.id,
  });
  assert(!registeredAgain.created, "source candidate registration should be idempotent");
  assert(registeredAgain.candidate.id === registeredSourceCandidate.candidate.id, "idempotent registration should reuse candidate");

  const manualCanonicalSource = await services.sourceImageService.uploadCharacterLoraSourceImage(job.id, {
    file: new File([Buffer.concat([PLACEHOLDER_PNG, Buffer.from("manual-canonical")])], "manual-canonical.png", { type: "image/png" }),
    role: "manual_canonical",
    sortOrder: 1,
    provenance: {
      smoke: true,
      original: "manual canonical upload",
    },
  });
  const localReferenceSource = await services.sourceImageService.uploadCharacterLoraSourceImage(job.id, {
    file: new File([Buffer.concat([PLACEHOLDER_PNG, Buffer.from("local-reference")])], "local-reference.png", { type: "image/png" }),
    role: "local_reference",
    sortOrder: 2,
    provenance: {
      smoke: true,
      original: "local reference upload",
    },
  });
  assertHexSha(localReferenceSource.sha256, "local reference sha256");
  const rerunReferenceSource = await services.sourceImageService.uploadCharacterLoraSourceImage(job.id, {
    file: new File([Buffer.concat([PLACEHOLDER_PNG, Buffer.from("rerun-reference")])], "rerun-reference.png", { type: "image/png" }),
    role: "rerun_reference",
    sortOrder: 3,
    provenance: {
      smoke: true,
      original: "rerun reference upload",
    },
  });
  assertHexSha(rerunReferenceSource.sha256, "rerun reference sha256");

  const canonicalRun = await services.canonicalService.enqueueCharacterLoraCanonicalGenerationRun(job.id, {
    provider: "mock-local",
    sourceImageIds: [source.id],
    renderedPrompt: `${triggerToken}, canonical identity reference`,
  });
  const canonicalRequest = readJsonRecord(readJsonRecord(await readJobJsonArtifact(job.artifactRoot, `generation-runs/${canonicalRun.id}/request.redacted.json`)).request);
  assertHostInstructionIsToolOnly(canonicalRequest.hostInstruction, "canonical request artifact");
  assertPromptIncludes(canonicalRequest.visualPrompt, "canonical request artifact", ["single character", "plain white or neutral background", "front-facing full-body", "preserve identity", "outfit", "shoes", "accessories", "no text", "logo", "watermark", "props"]);
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

  const manualCanonicalVersion = await services.canonicalService.registerManualCharacterLoraCanonicalVersion(job.id, {
    sourceImageId: manualCanonicalSource.id,
    notes: "fake e2e manual canonical registration",
  });
  assert(manualCanonicalVersion.sourceRunId === null, "manual canonical should not have a source run");
  assert(manualCanonicalVersion.version === canonicalVersion.version + 1, "manual canonical should create the next version");
  const afterManualRegister = await services.jobService.getCharacterLoraTrainingJob(job.id);
  assert(
    afterManualRegister.currentCanonicalVersionId === canonicalVersion.id,
    "manual canonical registration should not auto-select the new version",
  );
  const selectedManualCanonical = await services.canonicalService.selectCharacterLoraCanonicalVersion(
    job.id,
    manualCanonicalVersion.id,
  );
  assert(
    selectedManualCanonical.job.currentCanonicalVersionId === manualCanonicalVersion.id,
    "manual canonical should be selectable as current canonical",
  );

  const promptCard = await services.promptCardService.createCharacterLoraPromptCardVersion(job.id, {
    canonicalVersionId: manualCanonicalVersion.id,
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

  const promotedPromptCard = await services.promptCardService.promoteCharacterLoraSectionInstructionToPromptCardVersion(job.id, {
    sectionUserInstruction: "keep the left bangs longer in future section generations",
  });
  assert(promotedPromptCard.version === promptCard.version + 1, "promoted prompt card should create a new version");
  assert(
    promotedPromptCard.finalPromptDraft.includes("keep the left bangs longer"),
    "promoted prompt card should include the section instruction",
  );

  const instantiated = await services.sectionTemplateService.instantiateCharacterLoraJobSections(job.id, {
    templateKeys: ["front_fullbody", "portrait"],
  });
  assert(instantiated.sections.length === 2, "expected two instantiated sections");
  await assertRejects(
    () => services.phase3Service.enqueueCharacterLoraSectionGenerationRun(instantiated.sections[0].id, {
      provider: "mock-local",
      renderedPrompt: `${triggerToken}, ${instantiated.sections[0].name}, invalid explicit input image`,
      inputImages: [{
        artifactId: source.artifactId,
        sourceImageId: source.id,
        role: "source",
        relativePath: source.relativePath,
        sha256: "0".repeat(64),
      }],
    }),
    "section generation should reject explicit inputImages with a wrong sha256",
  );

  const sectionsWithImages: SmokeSummary["sections"] = [];
  for (const section of instantiated.sections) {
    const sectionUserInstruction = `Smoke instruction for ${section.key}: keep the section target clear without changing identity.`;
    const sectionRun = await services.phase3Service.enqueueCharacterLoraSectionGenerationRun(section.id, {
      provider: "mock-local",
      userInstruction: sectionUserInstruction,
    });
    assertSectionInputImageProvenance(readJsonArray(sectionRun.inputImages).map(readJsonRecord), {
      source,
      manualCanonicalSource,
      localReferenceSource,
      rerunReferenceSource,
    }, `section ${section.key} generation run`);
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
    assertSectionPromptLayering(payload.request, `section ${section.key} task payload`, section.key, section.name, promotedPromptCard.finalPromptDraft, sectionUserInstruction);
    assertSectionInputImageProvenance(readJsonArray(payload.request.inputImages).map(readJsonRecord), {
      source,
      manualCanonicalSource,
      localReferenceSource,
      rerunReferenceSource,
    }, `section ${section.key} task payload`);
    const requestArtifact = readJsonRecord(await readJobJsonArtifact(job.artifactRoot, `${outputDir}/request.redacted.json`));
    const redactedRequest = readJsonRecord(requestArtifact.request);
    assertSectionPromptLayering(redactedRequest, `section ${section.key} redacted request artifact`, section.key, section.name, promotedPromptCard.finalPromptDraft, sectionUserInstruction);
    assertSectionInputImageProvenance(readJsonArray(redactedRequest.inputImages).map(readJsonRecord), {
      source,
      manualCanonicalSource,
      localReferenceSource,
      rerunReferenceSource,
    }, `section ${section.key} redacted request artifact`);
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
  const sourceCandidateImage = allImages.find((image) => image.id === registeredSourceCandidate.candidate.id);
  assert(sourceCandidateImage, "registered source candidate should appear in candidate image list");
  assert(sourceCandidateImage.reviewStatus === "pending", "source candidate should remain pending before manual review");
  assert(allImages.length === 3, "expected one source candidate plus two generated candidate images before review");
  await assertRejects(
    () => services.phase3Service.reviewCharacterLoraImages({
      images: [{
        imageId: sourceCandidateImage.id,
        reviewStatus: "reject",
      }],
    }),
    "reject review should require at least one reject reason",
  );
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

  await assertRejects(
    () => services.phase3Service.freezeCharacterLoraDataset(job.id, {
      force: true,
      repeatCount: 1,
    }),
    "force dataset freeze should require a forceReason",
  );
  const frozen = await services.phase3Service.freezeCharacterLoraDataset(job.id, {
    force: true,
    forceReason: "fake smoke intentionally freezes below template targetKeepCount",
    repeatCount: 1,
    sourceWeight: 1.5,
  });
  const frozenRevision = getDatasetFreezeRevision(frozen, "sync dataset freeze");
  assert(frozenRevision.itemCount === allImages.length, "dataset item count should match kept images");
  assert(frozenRevision.sourceCount >= 1, "dataset should include registered source candidates as source");
  assert(frozenRevision.syntheticCount >= 1, "dataset should still include generated candidates as synthetic");

  const selectedManifestArtifact = await services.prismaModule.prisma.characterLoraArtifact.findUnique({
    where: { id: frozenRevision.selectedManifestArtifactId },
    select: { relativePath: true },
  });
  const metadataJsonlArtifact = await services.prismaModule.prisma.characterLoraArtifact.findUnique({
    where: { id: frozenRevision.metadataJsonlArtifactId },
    select: { relativePath: true },
  });
  assert(selectedManifestArtifact, "selected manifest artifact should exist");
  assert(metadataJsonlArtifact, "metadata jsonl artifact should exist");
  const selectedManifest = readJsonRecord(await readJobJsonArtifact(job.artifactRoot, selectedManifestArtifact.relativePath));
  const forceOverride = readJsonRecord(selectedManifest.forceOverride);
  assert(forceOverride.enabled === true, "selected manifest should record force override");
  assert(typeof forceOverride.reason === "string" && forceOverride.reason.length > 0, "force override should include a reason");
  const manifestItems = readJsonArray(selectedManifest.items);
  const sourceManifestItem = readJsonRecord(
    manifestItems.find((item) => readJsonRecord(item).candidateImageId === registeredSourceCandidate.candidate.id),
  );
  assert(sourceManifestItem.origin === "source", "manifest should mark registered source candidate as source");
  assert(sourceManifestItem.sourceWeight === 1.5, "manifest should apply sourceWeight to source item");
  assert(sourceManifestItem.repeatCount === 2, "sourceWeight should increase source repeat count");
  const syntheticManifestItems = manifestItems
    .map((item) => readJsonRecord(item))
    .filter((item) => item.origin === "synthetic");
  assert(syntheticManifestItems.length >= 1, "manifest should keep synthetic generated candidates");
  assert(
    syntheticManifestItems.every((item) => item.sourceWeight === null && item.repeatCount === 1),
    "synthetic items should not receive sourceWeight",
  );
  const metadataRows = (await readJobTextArtifact(job.artifactRoot, metadataJsonlArtifact.relativePath))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => readJsonRecord(JSON.parse(line)));
  const sourceMetadataItem = metadataRows.find((item) => item.candidateImageId === registeredSourceCandidate.candidate.id);
  assert(sourceMetadataItem?.origin === "source", "metadata.jsonl should mark registered source candidate as source");
  assert(sourceMetadataItem.sourceWeight === 1.5, "metadata.jsonl should persist sourceWeight for source item");

  const revisedIncludedCaption = await services.phase3Service.updateCharacterLoraImageCaption(
    registeredSourceCandidate.candidate.id,
    { captionDraft: "revised source anchor caption after first freeze" },
  );
  assert(
    revisedIncludedCaption.captionDraft?.startsWith(`${triggerToken},`),
    "included source candidate caption should remain editable for a new revision",
  );
  const reReviewedIncluded = await services.phase3Service.reviewCharacterLoraImages({
    images: [{
      imageId: registeredSourceCandidate.candidate.id,
      reviewStatus: "keep",
      reviewNote: "reuse source anchor in a new revision",
    }],
  });
  assert(
    reReviewedIncluded.some((image) => image.id === registeredSourceCandidate.candidate.id && image.reviewStatus === "keep"),
    "included training candidate should be reviewable again for future revisions",
  );
  const refrozen = await services.phase3Service.freezeCharacterLoraDataset(job.id, {
    force: true,
    forceReason: "fake smoke rework revision with one source anchor",
    repeatCount: 1,
    sourceWeight: 1,
  });
  const refrozenRevision = getDatasetFreezeRevision(refrozen, "sync re-freeze");
  assert(refrozenRevision.version === frozenRevision.version + 1, "re-reviewing included images should allow a new dataset revision");
  assert(refrozenRevision.itemCount === 1, "refrozen revision should include the re-kept source candidate only");
  assert(refrozenRevision.sourceCount === 1, "refrozen revision should preserve source provenance");

  await services.phase3Service.reviewCharacterLoraImages({
    images: [{
      imageId: registeredSourceCandidate.candidate.id,
      reviewStatus: "keep",
      reviewNote: "queue source anchor in a dataset freeze task",
    }],
  });
  const queuedFreeze = await services.phase3Service.freezeCharacterLoraDataset(job.id, {
    queue: true,
    force: true,
    forceReason: "fake smoke queued freeze with source anchor snapshot",
    repeatCount: 1,
    sourceWeight: 1,
  });
  assert("queued" in queuedFreeze && queuedFreeze.queued === true, "queued dataset freeze should report queued=true");
  assert(typeof queuedFreeze.taskId === "string" && queuedFreeze.taskId.length > 0, "queued dataset freeze should return task id");
  assert(
    queuedFreeze.datasetRevisionId && queuedFreeze.datasetRevisionId !== refrozenRevision.id,
    "queued dataset freeze should reserve a new datasetRevisionId without creating a placeholder revision",
  );
  assert(
    queuedFreeze.version === refrozenRevision.version + 1,
    "queued dataset freeze should snapshot the next dataset revision version",
  );

  const datasetFreezeTask = await services.phase3Service.leaseNextCharacterLoraTask({
    workerType: "dataset_freeze",
    leaseOwner: "fake-dataset-freeze-worker",
    leaseDurationSeconds: 300,
  });
  assert(datasetFreezeTask, "dataset_freeze task should be leased");
  assert(
    datasetFreezeTask.targetId === queuedFreeze.datasetRevisionId,
    "dataset_freeze task targetId should be the reserved dataset revision id",
  );
  const datasetFreezePayload = readTaskPayload(datasetFreezeTask.payload);
  assert(datasetFreezePayload.taskType === "dataset_freeze", "leased dataset freeze task payload should be dataset_freeze");
  assert(
    datasetFreezePayload.datasetRevisionId === queuedFreeze.datasetRevisionId,
    "dataset freeze payload should snapshot datasetRevisionId",
  );
  assert(datasetFreezePayload.version === queuedFreeze.version, "dataset freeze payload should snapshot version");
  assert(
    datasetFreezePayload.keepImageIds.includes(registeredSourceCandidate.candidate.id),
    "dataset freeze payload should snapshot keepImageIds at enqueue time",
  );
  const revisionBeforeQueuedComplete = await services.prismaModule.prisma.characterLoraDatasetRevision.findUnique({
    where: { id: queuedFreeze.datasetRevisionId },
    select: { id: true },
  });
  assert(!revisionBeforeQueuedComplete, "queued dataset freeze should not create a placeholder dataset revision");

  await services.phase3Service.reviewCharacterLoraImages({
    images: [{
      imageId: registeredSourceCandidate.candidate.id,
      reviewStatus: "reject",
      rejectReasons: ["other"],
      reviewNote: "mutated after queued freeze to verify payload snapshot",
    }],
  });
  const queuedCompleted = await services.phase3Service.completeCharacterLoraTask(datasetFreezeTask.id, {
    leaseOwner: "fake-dataset-freeze-worker",
  });
  assert("revision" in queuedCompleted, "dataset_freeze complete should return a dataset revision");
  assert(queuedCompleted.revision.id === queuedFreeze.datasetRevisionId, "queued complete should create the reserved dataset revision");
  assert(queuedCompleted.revision.status === "frozen", "queued completed revision should be frozen");
  assert(queuedCompleted.revision.version === queuedFreeze.version, "queued completed revision should keep payload version");
  assert(queuedCompleted.revision.itemCount === datasetFreezePayload.keepImageIds.length, "queued completed revision should use snapshot keepImageIds");
  assert(queuedCompleted.revision.sourceCount === 1, "queued completed revision should preserve source provenance");

  const queuedManifestArtifact = await services.prismaModule.prisma.characterLoraArtifact.findUnique({
    where: { id: queuedCompleted.revision.selectedManifestArtifactId },
    select: { relativePath: true },
  });
  const queuedCaptionAuditArtifact = await services.prismaModule.prisma.characterLoraArtifact.findUnique({
    where: { id: queuedCompleted.revision.captionAuditArtifactId ?? "" },
    select: { relativePath: true },
  });
  assert(queuedManifestArtifact, "queued selected manifest artifact should exist");
  assert(queuedCaptionAuditArtifact, "queued caption audit artifact should exist");
  const queuedManifest = readJsonRecord(await readJobJsonArtifact(job.artifactRoot, queuedManifestArtifact.relativePath));
  const queuedManifestItems = readJsonArray(queuedManifest.items).map(readJsonRecord);
  assert(
    queuedManifestItems.some((item) => item.candidateImageId === registeredSourceCandidate.candidate.id),
    "queued manifest should include the snapshotted source candidate even after review mutation",
  );
  const queuedCaptionAudit = readJsonRecord(await readJobJsonArtifact(job.artifactRoot, queuedCaptionAuditArtifact.relativePath));
  assert(readJsonArray(queuedCaptionAudit.items).length === queuedCompleted.revision.itemCount, "queued caption audit should cover all items");
  await assertRejects(
    () => services.phase3Service.completeCharacterLoraTask(datasetFreezeTask.id, {
      leaseOwner: "fake-dataset-freeze-worker",
    }),
    "dataset_freeze complete should reject repeated completion after task is done",
  );

  const trainingEnqueued = await services.trainingService.enqueueCharacterLoraTrainingRun(frozenRevision.id, {
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
    postTrainingBenchmark: {
      enabled: true,
      checkpointMatrix: ["fake-base.safetensors"],
      weightMatrix: [0.65, 0.85, 1],
      registerLoraAsset: true,
      copyToCharacterDir: true,
      loraAssetName: "Smoke Character LoRA",
      dryRun: true,
      skipQueue: true,
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
  const finalBytes = createFakeSafetensors({
    trainingRunId: trainingPayload.trainingRunId,
    role: "final",
  });
  const checkpointBytes = createFakeSafetensors({
    trainingRunId: trainingPayload.trainingRunId,
    role: "checkpoint",
  });
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
        keyCount: 1,
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

  assert("postTrainingBenchmark" in trainingCompleted, "training completion should include auto benchmark result");
  const benchmarkCreated = (trainingCompleted as { postTrainingBenchmark?: BenchmarkEnqueueResult | null }).postTrainingBenchmark;
  assert(benchmarkCreated, "auto benchmark should be created after training completion");
  const benchmarkRun = "completedBenchmarkRun" in benchmarkCreated
    ? benchmarkCreated.completedBenchmarkRun
    : benchmarkCreated.benchmarkRun;
  assert(benchmarkRun.status === "done", "auto benchmark should be mock-completed when dryRun/skipQueue is true");
  assert(benchmarkRun.loraAssetId, "benchmark should register a LoRA asset");
  const benchmarkWeights = Array.isArray(benchmarkRun.weightMatrix) ? benchmarkRun.weightMatrix.map(Number) : [];
  const benchmarkCheckpoints = Array.isArray(benchmarkRun.checkpointMatrix)
    ? benchmarkRun.checkpointMatrix.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  assert(
    benchmarkWeights.join(",") === "0.65,0.85,1",
    `auto benchmark should use default benchmark weights, got ${benchmarkWeights.join(",")}`,
  );
  const benchmarkAsset = await services.prismaModule.prisma.loraAsset.findUnique({
    where: { id: benchmarkRun.loraAssetId },
    select: { relativePath: true },
  });
  assert(benchmarkAsset?.relativePath.startsWith("character/"), "benchmark LoRA should copy into the character LoRA dir by default");
  assert(benchmarkRun.testProjectId, "benchmark should create a test project");
  const benchmarkSections = await services.prismaModule.prisma.projectSection.findMany({
    where: { projectId: benchmarkRun.testProjectId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      name: true,
      checkpointName: true,
      loraConfig: true,
      extraParams: true,
      promptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { label: true, positive: true },
      },
    },
  });
  if (!benchmarkRun.templateId) {
    const expectedFallbackSections = ["默认", "内裤", "内裤+脱鞋", "半脱", "半脱+上半身", "半脱+脱鞋", "裸"];
    assert(
      benchmarkSections.length >= expectedFallbackSections.length,
      `fallback benchmark should create at least ${expectedFallbackSections.length} sections, got ${benchmarkSections.length}`,
    );
    for (const name of expectedFallbackSections) {
      assert(benchmarkSections.some((section) => section.name === name), `fallback benchmark should include section ${name}`);
    }
  }
  const expectedMatrixSectionCount = (!benchmarkRun.templateId ? 7 : countBenchmarkBaseSections(benchmarkSections))
    * benchmarkCheckpoints.length
    * benchmarkWeights.length;
  assert(
    benchmarkSections.length === expectedMatrixSectionCount,
    `benchmark matrix should create ${expectedMatrixSectionCount} sections, got ${benchmarkSections.length}`,
  );
  const observedWeights = new Set(benchmarkSections.map((section) => readBenchmarkSectionWeight(section)).filter((value): value is number => value !== null));
  for (const weight of benchmarkWeights) {
    assert(observedWeights.has(weight), `benchmark project should include weight ${weight}`);
  }
  for (const checkpoint of benchmarkCheckpoints) {
    assert(benchmarkSections.some((section) => section.checkpointName === checkpoint), `benchmark project should include checkpoint ${checkpoint}`);
  }
  const matrixResultSummary = readBenchmarkMatrixResultSummary(benchmarkRun.resultSummary);
  assert(
    matrixResultSummary?.expectedSectionCount === expectedMatrixSectionCount,
    `benchmark result summary should record expectedSectionCount ${expectedMatrixSectionCount}`,
  );
  assert(
    matrixResultSummary?.baseSectionCount === (!benchmarkRun.templateId ? 7 : countBenchmarkBaseSections(benchmarkSections)),
    "benchmark result summary should record baseSectionCount",
  );
  assert(
    benchmarkSections.every((section) => section.promptBlocks.some((block) => block.label && block.positive)),
    "benchmark sections should record prompt blocks",
  );
  const autoBenchmarkRuns = await services.benchmarkPromotionService.listCharacterLoraBenchmarkRunsForTrainingRun(completedTrainingRun.id);
  assert(
    autoBenchmarkRuns.some((run) => run.id === benchmarkRun.id && run.status === "done"),
    "auto benchmark should be persisted for the completed training run",
  );
  const autoBenchmarkLocks = await listActiveBenchmarkGpuLocks(services, benchmarkRun.id);
  assert(autoBenchmarkLocks.length === 0, "dryRun/skipQueue benchmark should not create an active GPU lock");

  const blockedApproval = await assertRejectsWithStatus(
    () => services.benchmarkPromotionService.createPromotionDecision(benchmarkRun.id, {
      status: "approved",
      selectedLoraAssetId: benchmarkRun.loraAssetId,
      selectedCheckpoint: "fake-base.safetensors",
      defaultRecommendedWeight: 0.65,
      variantPromptDrafts: {},
      decisionReason: "dryRun/skipQueue benchmark must not be approved",
    }),
    409,
    "dryRun/skipQueue benchmark should not create an approved promotion decision",
  );
  assert(
    readJsonArray(readJsonRecord(readErrorDetails(blockedApproval)).blockers).length > 0,
    "blocked approval should expose promotion evidence blockers",
  );

  const rejectedDecision = await services.benchmarkPromotionService.createPromotionDecision(benchmarkRun.id, {
    status: "rejected",
    selectedLoraAssetId: benchmarkRun.loraAssetId,
    defaultRecommendedWeight: 0.65,
    variantPromptDrafts: {},
    decisionReason: "dryRun/skipQueue benchmark rejected for diagnostics",
    returnPoint: "benchmark_review",
  });
  assert(rejectedDecision.status === "rejected", "dryRun/skipQueue benchmark should still allow rejected decision");

  const approvalCheckpointMatrix = ["fake-base.safetensors"];
  const approvalWeightMatrix = [0.65];
  const approvalBenchmarkCreated = await services.benchmarkPromotionService.enqueueCharacterLoraBenchmarkRun(completedTrainingRun.id, {
    checkpointMatrix: approvalCheckpointMatrix,
    weightMatrix: approvalWeightMatrix,
    registerLoraAsset: true,
    copyToCharacterDir: true,
    loraAssetName: "Smoke Character LoRA Approval Evidence",
    dryRun: false,
    skipQueue: false,
    queuePolicy: "queue_when_busy",
  });
  assert(!("completedBenchmarkRun" in approvalBenchmarkCreated), "approval benchmark should not be dry-run completed");
  const approvalBenchmarkRun = approvalBenchmarkCreated.benchmarkRun;
  assert(approvalBenchmarkRun.loraAssetId, "approval benchmark should register a LoRA asset");
  assert(approvalBenchmarkRun.testProjectId, "approval benchmark should create a test project");
  const approvalBenchmarkLocks = await listActiveBenchmarkGpuLocks(services, approvalBenchmarkRun.id);
  assert(approvalBenchmarkLocks.length === 1, "approval benchmark should create one active GPU lock");
  const approvalBenchmarkLock = approvalBenchmarkLocks[0];
  assert(approvalBenchmarkLock, "approval benchmark active GPU lock should be readable");
  assert(approvalBenchmarkLock.taskType === "benchmark", "approval benchmark GPU lock should use taskType=benchmark");
  assert(approvalBenchmarkLock.ownerType === "character_lora_benchmark_run", "approval benchmark GPU lock should use benchmark owner type");
  const approvalLockMetadata = readJsonRecord(approvalBenchmarkLock.metadata);
  assert(approvalLockMetadata.jobId === job.id, "benchmark GPU lock metadata should include jobId");
  assert(approvalLockMetadata.trainingRunId === completedTrainingRun.id, "benchmark GPU lock metadata should include trainingRunId");
  assert(approvalLockMetadata.benchmarkRunId === approvalBenchmarkRun.id, "benchmark GPU lock metadata should include benchmarkRunId");
  assert(approvalLockMetadata.workerType === "benchmark", "benchmark GPU lock metadata should include workerType");
  assert(approvalLockMetadata.queuePolicy === "queue_when_busy", "benchmark GPU lock metadata should include queuePolicy");
  assert(
    readJsonArray(approvalLockMetadata.checkpointMatrix).join(",") === approvalCheckpointMatrix.join(","),
    "benchmark GPU lock metadata should include checkpoint matrix",
  );
  assert(
    readJsonArray(approvalLockMetadata.weightMatrix).map(Number).join(",") === approvalWeightMatrix.join(","),
    "benchmark GPU lock metadata should include weight matrix",
  );
  const blockedBenchmarkEnqueue = await assertRejectsWithStatus(
    () => services.benchmarkPromotionService.enqueueCharacterLoraBenchmarkRun(completedTrainingRun.id, {
      checkpointMatrix: ["fake-base.safetensors"],
      weightMatrix: [0.65],
      registerLoraAsset: false,
      copyToCharacterDir: false,
      dryRun: true,
      skipQueue: true,
      queuePolicy: "reject_when_busy",
    }),
    409,
    "reject_when_busy benchmark should reject while a benchmark GPU lock is active",
  );
  const blockedBenchmarkDetails = readJsonRecord(readErrorDetails(blockedBenchmarkEnqueue));
  assert(
    readJsonArray(blockedBenchmarkDetails.gpuTaskLocks).some((lock) => readJsonRecord(lock).ownerId === approvalBenchmarkRun.id),
    "reject_when_busy benchmark error details should include active benchmark GPU lock",
  );
  const approvalBenchmarkSections = await services.prismaModule.prisma.projectSection.findMany({
    where: { projectId: approvalBenchmarkRun.testProjectId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      checkpointName: true,
      loraConfig: true,
      extraParams: true,
    },
  });
  const approvalBaseSectionCount = countBenchmarkBaseSections(approvalBenchmarkSections);
  const approvalExpectedSectionCount = approvalBaseSectionCount * approvalCheckpointMatrix.length * approvalWeightMatrix.length;
  assert(approvalBaseSectionCount >= 7, "approval benchmark should have at least 7 base sections");
  assert(
    approvalBenchmarkSections.length === approvalExpectedSectionCount,
    `approval benchmark matrix should create ${approvalExpectedSectionCount} sections, got ${approvalBenchmarkSections.length}`,
  );
  const approvalCompletedAt = new Date().toISOString();
  const approvalRunIds = approvalBenchmarkSections.map((section, index) => `smoke-approved-${index + 1}-${section.id}`);
  const approvalSectionSummaries = approvalBenchmarkSections.map((section, index) => {
    const runId = approvalRunIds[index] ?? `smoke-approved-${index + 1}-${section.id}`;
    const benchmarkMatrix = readJsonRecord(readJsonRecord(section.extraParams).characterLoraBenchmark);
    return {
      sectionId: section.id,
      sectionName: section.name,
      sortOrder: section.sortOrder,
      originalSectionName: typeof benchmarkMatrix.originalSectionName === "string" ? benchmarkMatrix.originalSectionName : section.name,
      checkpointName: section.checkpointName,
      loraWeight: readBenchmarkSectionWeight(section),
      benchmarkMatrix,
      latestRunId: runId,
      latestRun: {
        id: runId,
        status: "done",
        runIndex: 1,
        totalCount: 1,
        pendingCount: 0,
        keptCount: 1,
        trashedCount: 0,
        errorMessage: null,
        createdAt: approvalCompletedAt,
        startedAt: approvalCompletedAt,
        finishedAt: approvalCompletedAt,
        outputDir: `smoke/benchmark/${section.id}`,
      },
    };
  });
  const approvalCompletedBenchmarkRun = await services.benchmarkPromotionService.completeBenchmarkRun(approvalBenchmarkRun.id, {
    recommendedWeight: 0.65,
    resultSummary: {
      benchmarkRunId: approvalBenchmarkRun.id,
      trainingRunId: completedTrainingRun.id,
      testProjectId: approvalBenchmarkRun.testProjectId,
      runIds: approvalRunIds,
      submittedRuns: approvalRunIds.map((runId) => ({ runId })),
      sections: approvalSectionSummaries,
      matrixExpansion: {
        expectedSectionCount: approvalExpectedSectionCount,
        actualSectionCount: approvalBenchmarkSections.length,
        baseSectionCount: approvalBaseSectionCount,
        checkpointMatrix: approvalCheckpointMatrix,
        weightMatrix: approvalWeightMatrix,
        sections: approvalSectionSummaries,
      },
      checkpointMatrix: approvalCheckpointMatrix,
      weightMatrix: approvalWeightMatrix,
      recommendedWeight: 0.65,
      finalSafetensorsArtifact: {
        relativePath: finalPath,
        sha256: finalSha256,
      },
      projectStatus: "done",
      completedAt: approvalCompletedAt,
      elapsedMs: 1,
      skipWait: false,
      counts: {
        totalRuns: approvalRunIds.length,
        done: approvalRunIds.length,
        failed: 0,
        queued: 0,
        running: 0,
        missing: 0,
      },
    },
    diagnosticSuggestions: [],
  });
  assert(approvalCompletedBenchmarkRun.status === "done", "approval benchmark should be completed with real evidence shape");
  const releasedApprovalBenchmarkLocks = await listReleasedBenchmarkGpuLocks(services, approvalBenchmarkRun.id);
  assert(releasedApprovalBenchmarkLocks.length === 1, "benchmark complete should release the active GPU lock");
  assert(
    (await listActiveBenchmarkGpuLocks(services, approvalBenchmarkRun.id)).length === 0,
    "benchmark complete should leave no active GPU lock",
  );

  const decision = await services.benchmarkPromotionService.createPromotionDecision(approvalCompletedBenchmarkRun.id, {
    status: "approved",
    selectedLoraAssetId: approvalCompletedBenchmarkRun.loraAssetId,
    selectedCheckpoint: "fake-base.safetensors",
    defaultRecommendedWeight: 0.65,
    perVariantWeightOverrides: {
      portrait: 0.65,
      naked: 0.6,
    },
    variantPromptDrafts: {
      default: `${triggerToken}, Smoke Character, default promoted prompt`,
    },
    decisionReason: "phase6 fake e2e approved with completed benchmark evidence shape",
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
  assert(report.datasetRevisions.some((revision) => revision.id === frozenRevision.id && revision.items.length === allImages.length), "report should include dataset revision/items");
  assert(
    report.trainingRuns.some((run) => run.id === completedTrainingRun.id && run.finalSha256 === finalSha256),
    "report should include training finalSha",
  );
  assert(report.benchmarkRuns.some((run) => run.id === benchmarkRun.id), "report should include dryRun benchmark run");
  assert(report.benchmarkRuns.some((run) => run.id === approvalCompletedBenchmarkRun.id), "report should include approved benchmark run");
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
    sourceCandidate: {
      id: registeredSourceCandidate.candidate.id,
      generationRunId: registeredSourceCandidate.candidate.generationRunId,
      reviewStatus: sourceCandidateImage.reviewStatus,
      origin: String(sourceManifestItem.origin),
      repeatCount: Number(sourceManifestItem.repeatCount),
      sourceWeight: Number(sourceManifestItem.sourceWeight),
    },
    canonical: {
      id: selectedManualCanonical.canonicalVersion.id,
      version: selectedManualCanonical.canonicalVersion.version,
      status: selectedManualCanonical.canonicalVersion.status,
      manualVersionId: manualCanonicalVersion.id,
      manualVersion: manualCanonicalVersion.version,
    },
    promptCard: {
      id: promotedPromptCard.id,
      version: promotedPromptCard.version,
      triggerToken: promotedPromptCard.triggerToken,
      promotedFromSectionInstruction: true,
    },
    sections: sectionsWithImages,
    caption: {
      imageId: captioned.id,
      captionDraft: captioned.captionDraft ?? "",
      triggerFirst: captioned.captionDraft?.split(",")[0]?.trim() === triggerToken,
    },
    dataset: {
      id: frozenRevision.id,
      version: frozenRevision.version,
      itemCount: frozenRevision.itemCount,
      sourceCount: frozenRevision.sourceCount,
      syntheticCount: frozenRevision.syntheticCount,
      trainDir: frozenRevision.trainDir,
    },
    training: {
      id: completedTrainingRun.id,
      status: completedTrainingRun.status,
      configPath: configArtifact.relativePath,
      finalSha256,
      logPath,
    },
    benchmark: {
      id: approvalCompletedBenchmarkRun.id,
      status: approvalCompletedBenchmarkRun.status,
      reportArtifactId: approvalCompletedBenchmarkRun.reportArtifactId,
      resultSummary: approvalCompletedBenchmarkRun.resultSummary,
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
  assert(summary.sourceCandidate.origin === "source", "summary source candidate origin should be source");
  assert(summary.dataset.sourceCount >= 1, "summary dataset should count source candidates");
  assert(summary.dataset.syntheticCount >= 1, "summary dataset should count generated candidates");
  assert(summary.caption.triggerFirst, "caption trigger-first assertion should be true");
  assertHexSha(summary.training.finalSha256, "final training sha256");
  assert(summary.report.coverage.sourceImages >= 1, "report summary should cover source");
  assert(summary.report.coverage.canonicalVersions >= 2, "report summary should cover generated and manual canonical");
  assert(summary.report.coverage.promptCardVersions >= 2, "report summary should cover promoted prompt card version");
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

function createFakeSafetensors(input: { trainingRunId: string; role: "final" | "checkpoint" }) {
  const tensorData = Buffer.alloc(4);
  const header = Buffer.from(JSON.stringify({
    __metadata__: {
      format: "pt",
      fakeE2eSmoke: "true",
      role: input.role,
      trainingRunId: input.trainingRunId,
    },
    [`fake.${input.role}.weight`]: {
      dtype: "F32",
      shape: [1],
      data_offsets: [0, tensorData.byteLength],
    },
  }), "utf8");
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64LE(BigInt(header.byteLength), 0);
  return Buffer.concat([prefix, header, tensorData]);
}

function createSmokeTrainingScope() {
  return {
    purpose: "character_identity",
    primaryOutfitOrForm: "white jacket, black boots, default smoke-test form",
    scopeNote: "Fake smoke scope: single identity, one primary outfit/form, no mixed characters or derived-state training.",
    advancedExperiment: false,
    mixingPolicy: {
      allowMixedCharacters: false,
      allowMultipleOfficialOutfits: false,
      note: "Default smoke run keeps character identity isolated and avoids multiple official outfits.",
    },
    derivedStates: [
      { state: "underwear", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "underwear_shoes", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "semi_undressed", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "semi_undressed_upper_body", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "semi_undressed_shoes", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "nude", includeInTraining: false, note: "benchmark/promotion variant only" },
      { state: "default_outfit", includeInTraining: false, note: "primaryOutfitOrForm controls training" },
    ],
  };
}

function assertTrainingScopeNormalized(value: unknown, label: string) {
  const scope = readJsonRecord(value);
  assert(scope.purpose === "character_identity", `${label} trainingScope should normalize purpose`);
  assert(
    scope.primaryOutfitOrForm === "white jacket, black boots, default smoke-test form",
    `${label} trainingScope should persist primaryOutfitOrForm`,
  );
  const mixingPolicy = readJsonRecord(scope.mixingPolicy);
  assert(mixingPolicy.allowMixedCharacters === false, `${label} trainingScope should prohibit mixed characters`);
  assert(
    mixingPolicy.allowMultipleOfficialOutfits === false,
    `${label} trainingScope should prohibit multiple official outfits`,
  );
  const derivedStates = readJsonArray(scope.derivedStates).map(readJsonRecord);
  assert(derivedStates.length === 7, `${label} trainingScope should express seven derived states`);
  assert(
    derivedStates.every((state) => state.includeInTraining === false),
    `${label} trainingScope should exclude derived states by default`,
  );
  assert(
    derivedStates.some((state) => state.state === "underwear") &&
      derivedStates.some((state) => state.state === "semi_undressed") &&
      derivedStates.some((state) => state.state === "nude"),
    `${label} trainingScope should list underwear, semi_undressed and nude states`,
  );
}

function assertHexSha(value: string | null | undefined, label: string): asserts value is string {
  assert(Boolean(value && /^[a-f0-9]{64}$/i.test(value)), `${label} should be a sha256 hex string`);
}

function assertHostInstructionIsToolOnly(value: unknown, label: string) {
  const hostInstruction = assertStringValue(value, `${label} hostInstruction`);
  const forbidden = /white\s+background|plain\s+white|full[-\s]?body|front[-\s]?facing|\boutfit\b|\bshoes?\b|\baccessor(?:y|ies)\b/i;
  assert(!forbidden.test(hostInstruction), `${label} hostInstruction should not contain visual keywords`);
}

function assertSectionPromptLayering(
  request: unknown,
  label: string,
  sectionKey: string,
  sectionName: string,
  promptCardDraft: string,
  userInstruction: string,
) {
  const requestRecord = readJsonRecord(request);
  assertHostInstructionIsToolOnly(requestRecord.hostInstruction, label);
  assert(
    requestRecord.renderedPrompt === requestRecord.visualPrompt,
    `${label} should fall back renderedPrompt to visualPrompt`,
  );
  assertPromptIncludes(requestRecord.renderedPrompt, label, [
    "Global rules:",
    `Prompt card final draft: ${promptCardDraft}`,
    `Section target: ${sectionName}`,
    `section key: ${sectionKey}`,
    `User instruction: ${userInstruction}`,
    "Reference image notes:",
    "canonical",
    "source",
    "setting",
    "local_reference",
    "previous_candidate",
    "Output constraints:",
  ]);
  const expectedTemplatePrompt =
    sectionKey === "front_fullbody"
      ? "full body, standing, front view"
      : sectionKey === "portrait"
        ? "close portrait, shoulders up"
        : null;
  if (expectedTemplatePrompt) {
    assertPromptIncludes(requestRecord.renderedPrompt, label, ["Section template:", expectedTemplatePrompt]);
  }
  assertPromptIncludes(requestRecord.negativePrompt, `${label} negative`, [
    "wrong identity",
    "inconsistent face",
    "inconsistent outfit",
  ]);
}

function assertPromptIncludes(value: unknown, label: string, expectedParts: string[]) {
  const normalizedPrompt = assertStringValue(value, `${label} prompt`).toLowerCase();
  for (const expectedPart of expectedParts) {
    assert(
      normalizedPrompt.includes(expectedPart.toLowerCase()),
      `${label} prompt should include ${expectedPart}`,
    );
  }
}

function assertStringValue(value: unknown, label: string): string {
  assert(typeof value === "string" && value.length > 0, `${label} should be a non-empty string`);
  return value;
}

async function assertRejects(action: () => Promise<unknown>, message: string) {
  let rejected = false;

  try {
    await action();
  } catch {
    rejected = true;
  }

  assert(rejected, message);
}

async function assertRejectsWithStatus(action: () => Promise<unknown>, expectedStatus: number, message: string) {
  let caught: unknown = null;

  try {
    await action();
  } catch (error) {
    caught = error;
  }

  assert(caught, message);
  assert(readErrorStatus(caught) === expectedStatus, `${message}: expected status ${expectedStatus}`);
  return caught;
}

function readErrorStatus(error: unknown) {
  return error && typeof error === "object" && "status" in error
    ? (error as { status?: unknown }).status
    : null;
}

function readErrorDetails(error: unknown) {
  return error && typeof error === "object" && "details" in error
    ? (error as { details?: unknown }).details
    : null;
}

function getDatasetFreezeRevision(
  result: Awaited<ReturnType<ServiceModules["phase3Service"]["freezeCharacterLoraDataset"]>>,
  label: string,
) {
  const revision = "revision" in result ? result.revision : null;
  assert(revision, `${label} should return a dataset revision`);
  return revision;
}

function readTaskPayload(payload: unknown) {
  assert(payload && typeof payload === "object", "worker task payload should be an object");
  return payload as
    | {
        taskType: "image_generation";
        request: Record<string, unknown> & {
          outputDir: string;
          inputImages: unknown;
        };
      }
    | {
        taskType: "training";
        trainingRunId: string;
        outputDir: string;
      }
    | {
        taskType: "dataset_freeze";
        datasetRevisionId: string;
        version: number;
        keepImageIds: string[];
        captionStrategy: string;
        repeatCount: number;
        sourceWeight?: number;
      };
}

type SmokeSourceImageRef = {
  id: string;
  relativePath: string;
  sha256: string;
};

function assertSectionInputImageProvenance(
  inputImages: Array<Record<string, unknown>>,
  refs: {
    source: SmokeSourceImageRef;
    manualCanonicalSource: SmokeSourceImageRef;
    localReferenceSource: SmokeSourceImageRef;
    rerunReferenceSource: SmokeSourceImageRef;
  },
  label: string,
) {
  assert(
    inputImages.some(
      (inputImage) =>
        inputImage.role === "canonical" &&
        typeof inputImage.artifactId === "string" &&
        typeof inputImage.relativePath === "string" &&
        typeof inputImage.sha256 === "string",
    ),
    `${label} should include a canonical input image`,
  );
  assertInputImageRef(inputImages, refs.source, "source", label);
  assertInputImageRef(inputImages, refs.manualCanonicalSource, "source", label);
  assertInputImageRef(inputImages, refs.localReferenceSource, "local_reference", label);
  assertInputImageRef(inputImages, refs.rerunReferenceSource, "previous_candidate", label);
}

function assertInputImageRef(
  inputImages: Array<Record<string, unknown>>,
  expected: SmokeSourceImageRef,
  expectedRole: string,
  label: string,
) {
  const inputImage = inputImages.find((candidate) => candidate.sourceImageId === expected.id);
  assert(inputImage, `${label} should retain sourceImageId ${expected.id}`);
  assert(inputImage.role === expectedRole, `${label} should map ${expected.id} to role ${expectedRole}`);
  assert(inputImage.relativePath === expected.relativePath, `${label} should retain relativePath for ${expected.id}`);
  assert(inputImage.sha256 === expected.sha256, `${label} should retain sha256 for ${expected.id}`);
  assert(typeof inputImage.artifactId === "string", `${label} should retain artifactId for ${expected.id}`);
}

async function listActiveBenchmarkGpuLocks(services: ServiceModules, benchmarkRunId: string) {
  return services.prismaModule.prisma.gpuTaskLock.findMany({
    where: {
      taskType: "benchmark",
      ownerType: "character_lora_benchmark_run",
      ownerId: benchmarkRunId,
      status: "active",
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  });
}

async function listReleasedBenchmarkGpuLocks(services: ServiceModules, benchmarkRunId: string) {
  return services.prismaModule.prisma.gpuTaskLock.findMany({
    where: {
      taskType: "benchmark",
      ownerType: "character_lora_benchmark_run",
      ownerId: benchmarkRunId,
      status: "released",
    },
    orderBy: [{ releasedAt: "asc" }, { id: "asc" }],
  });
}

function readBenchmarkSectionWeight(section: { loraConfig: unknown; extraParams: unknown }) {
  const metadataWeight = readJsonRecord(readJsonRecord(section.extraParams).characterLoraBenchmark).weight;
  if (typeof metadataWeight === "number" && metadataWeight > 0) {
    return roundBenchmarkWeight(metadataWeight);
  }

  const config = readJsonRecord(section.loraConfig);
  for (const key of ["lora1", "lora2"] as const) {
    const entries = config[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const weight = readJsonRecord(entry).weight;
      if (typeof weight === "number" && weight > 0) {
        return roundBenchmarkWeight(weight);
      }
    }
  }
  return null;
}

function countBenchmarkBaseSections(sections: Array<{ name: string | null; extraParams: unknown }>) {
  const keys = new Set<string>();
  for (const section of sections) {
    const metadata = readJsonRecord(readJsonRecord(section.extraParams).characterLoraBenchmark);
    const baseSectionIndex = metadata.baseSectionIndex;
    if (typeof baseSectionIndex === "number") {
      keys.add(`index:${baseSectionIndex}`);
      continue;
    }
    const originalSectionName = metadata.originalSectionName;
    keys.add(`name:${typeof originalSectionName === "string" ? originalSectionName : section.name ?? "unnamed"}`);
  }
  return keys.size;
}

function readBenchmarkMatrixResultSummary(value: unknown) {
  const summary = readJsonRecord(value);
  const expansion = readJsonRecord(summary.matrixExpansion);
  const expectedSectionCount = typeof summary.expectedSectionCount === "number"
    ? summary.expectedSectionCount
    : typeof expansion.expectedSectionCount === "number"
      ? expansion.expectedSectionCount
      : null;
  const baseSectionCount = typeof summary.baseSectionCount === "number"
    ? summary.baseSectionCount
    : typeof expansion.baseSectionCount === "number"
      ? expansion.baseSectionCount
      : null;

  return expectedSectionCount === null && baseSectionCount === null
    ? null
    : { expectedSectionCount, baseSectionCount };
}

async function readJobJsonArtifact(artifactRoot: string, relativePath: string) {
  return JSON.parse(await readJobTextArtifact(artifactRoot, relativePath));
}

async function readJobTextArtifact(artifactRoot: string, relativePath: string) {
  return readFile(path.join(artifactRoot, relativePath), "utf8");
}

function readJsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roundBenchmarkWeight(value: number) {
  return Math.round(value * 1000) / 1000;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

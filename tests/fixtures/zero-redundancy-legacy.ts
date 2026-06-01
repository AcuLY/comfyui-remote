export const zeroRedundancyLegacyFixture = {
  projects: [
    {
      id: "project-with-bindings",
      presetBindings: JSON.stringify([
        { categoryId: "cat-character", presetId: "preset-hero", variantId: "variant-default" },
      ]),
    },
    { id: "project-empty-bindings", presetBindings: null },
    { id: "project-bad-bindings", presetBindings: "{\"categoryId\":" },
  ],
  projectSections: [
    {
      id: "section-with-legacy-fields",
      positivePrompt: "legacy section positive prompt",
      negativePrompt: "",
      loraConfig: JSON.stringify({ lora1: [{ name: "char.safetensors", strength: 0.8 }], lora2: [] }),
    },
    {
      id: "section-with-negative",
      positivePrompt: "   ",
      negativePrompt: "low quality",
      loraConfig: null,
    },
    {
      id: "section-bad-lora",
      positivePrompt: null,
      negativePrompt: null,
      loraConfig: "[{\"name\":\"broken\"",
    },
  ],
  promptBlocks: [
    { id: "block-preset-1", type: "preset", sourceId: "preset-hero" },
    { id: "block-preset-2", type: "preset", sourceId: "preset-sidekick" },
    { id: "block-custom-1", type: "custom", sourceId: null },
    { id: "block-unknown", type: "legacy", sourceId: null },
  ],
  projectTemplates: [
    {
      id: "template-with-bindings",
      presetBindings: JSON.stringify([{ categoryId: "cat-style", presetId: "preset-cinematic" }]),
    },
    { id: "template-empty-bindings", presetBindings: null },
  ],
  projectTemplateSections: [
    {
      id: "template-section-with-legacy-fields",
      promptBlocks: JSON.stringify([{ label: "base", positive: "template prompt", sortOrder: 1 }]),
      loraConfig: JSON.stringify({ lora1: [{ name: "style.safetensors", strength: 0.5 }], lora2: [] }),
    },
    {
      id: "template-section-bad-prompt-blocks",
      promptBlocks: "[{\"label\":\"broken\"",
      loraConfig: null,
    },
  ],
  presetVariants: [
    {
      id: "variant-linked",
      linkedVariants: JSON.stringify([{ presetId: "preset-style", variantId: "variant-night" }]),
    },
    { id: "variant-unlinked", linkedVariants: null },
    { id: "variant-bad-linked", linkedVariants: "[{\"presetId\":\"broken\"" },
  ],
  presetCategories: [
    {
      id: "category-group",
      type: "group",
      slotTemplate: JSON.stringify([{ categoryId: "cat-character", label: "Character" }]),
    },
    { id: "category-normal", type: "preset", slotTemplate: null },
  ],
  runs: [
    {
      id: "run-complete",
      resolvedConfigSnapshot: JSON.stringify({ sectionId: "section-with-legacy-fields" }),
      submittedPrompt: JSON.stringify({ nodes: [] }),
    },
    {
      id: "run-bad-submitted-prompt",
      resolvedConfigSnapshot: JSON.stringify({ sectionId: "section-with-negative" }),
      submittedPrompt: "{\"nodes\":",
    },
  ],
  auditLogs: [
    { id: "audit-good", payload: JSON.stringify({ action: "update" }) },
    { id: "audit-bad", payload: "{\"action\":" },
  ],
  presetChangeLogs: [
    { id: "preset-change", before: JSON.stringify({ prompt: "old" }), after: JSON.stringify({ prompt: "new" }) },
  ],
  presetGroupChangeLogs: [
    { id: "group-change", before: null, after: JSON.stringify({ members: ["preset-hero"] }) },
  ],
  sectionChangeLogs: [
    { id: "section-change", before: JSON.stringify({ loraConfig: null }), after: JSON.stringify({ loraConfig: {} }) },
  ],
  characterLoraTrainingTemplates: [
    {
      id: "template-default",
      canonicalDefaults: JSON.stringify({ view: "front" }),
      promptCardDefaults: JSON.stringify({ tone: "neutral" }),
      trainingDefaults: JSON.stringify({ steps: 1000 }),
      benchmarkDefaults: JSON.stringify({ weights: [0.6, 0.8] }),
      promotionDefaults: JSON.stringify({ threshold: 0.9 }),
    },
  ],
  characterLoraTrainingJobs: [
    {
      id: "job-with-snapshots",
      trainingScope: JSON.stringify({ source: "curated" }),
      trainingTemplateSnapshot: JSON.stringify({ key: "default" }),
    },
  ],
  characterLoraSourceImages: [
    { id: "source-image", provenance: JSON.stringify({ uploadedBy: "tester" }) },
  ],
  characterLoraPromptCardVersions: [
    {
      id: "prompt-card",
      identityTraits: JSON.stringify(["short hair"]),
      outfitTraits: JSON.stringify(["jacket"]),
      negativeTraits: JSON.stringify(["blur"]),
    },
  ],
  characterLoraGenerationRuns: [
    {
      id: "generation-run",
      toolParams: JSON.stringify({ steps: 30 }),
      inputImages: JSON.stringify(["source-image"]),
      responseSummary: JSON.stringify({ accepted: true }),
    },
  ],
  characterLoraCandidateImages: [
    { id: "candidate-image", rejectReasons: JSON.stringify(["duplicate"]) },
  ],
  characterLoraDatasetRevisions: [
    {
      id: "dataset-revision",
      selectedManifestArtifactId: "artifact-manifest",
      metadataJsonlArtifactId: "artifact-metadata",
      captionAuditArtifactId: "artifact-caption-audit",
      frozenAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  characterLoraTrainingRuns: [
    {
      id: "training-run",
      resolvedConfig: JSON.stringify({ batchSize: 1 }),
      metadataSummary: JSON.stringify({ loss: 0.1 }),
      lossSnapshot: JSON.stringify({ step: 10, loss: 0.2 }),
    },
  ],
  characterLoraTrainingCheckpoints: [
    { id: "checkpoint", metrics: JSON.stringify({ step: 100 }) },
  ],
  characterLoraBenchmarkRuns: [
    {
      id: "benchmark-run",
      checkpointMatrix: JSON.stringify(["checkpoint"]),
      weightMatrix: JSON.stringify([0.6, 0.8]),
      resultSummary: JSON.stringify({ winner: 0.8 }),
      cleanupSummary: JSON.stringify({ removed: true }),
    },
  ],
  characterLoraPromotionDecisions: [
    {
      id: "promotion",
      perVariantWeightOverrides: JSON.stringify({ variantDefault: 0.7 }),
      variantPromptDrafts: JSON.stringify([{ variantId: "variant-default", prompt: "draft" }]),
    },
  ],
  characterLoraArtifacts: [
    { id: "artifact", metadata: JSON.stringify({ sha256: "abc123" }) },
  ],
  characterLoraWorkerTasks: [
    {
      id: "worker-task",
      payload: JSON.stringify({ targetId: "training-run" }),
      progressJson: JSON.stringify({ percent: 50 }),
    },
  ],
} as const;

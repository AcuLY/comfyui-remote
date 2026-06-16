export const TRAINING_IMAGE_GENERATION_PROVIDER_POLICY = {
  provider: "codex_gpt_image2",
  model: "gpt-image-2",
  tool: "image_generation",
  appliesToTaskTypes: ["trainingset_generation", "reference_image_generation"],
  outputKind: "image",
  usesComfyUiWorkflow: false,
  usesComfyUiQueue: false,
  paramsJsonDefaults: {
    background: "opaque",
    hostModel: "gpt-5.5",
    quality: "high",
    size: "1024x1536",
  },
} as const;

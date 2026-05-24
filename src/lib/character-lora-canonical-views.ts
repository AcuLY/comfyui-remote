export type CanonicalViewKey = "front" | "back" | "left" | "right";
export type CanonicalImageProvider = "mock-local" | "openai-codex";
export type CanonicalProviderInputImage = {
  artifactId: string;
  sourceImageId?: string;
  role: "canonical" | "source" | "setting" | "local_reference" | "previous_candidate";
  relativePath: string;
  sha256: string;
};
export type CanonicalProviderToolParams = {
  size: string;
  quality: string;
  outputFormat: "png";
  background: "opaque" | "transparent";
  partialImages?: number;
};

export type CanonicalViewSpec = {
  key: CanonicalViewKey;
  label: string;
  promptPhrase: string;
  promptNoun: string;
  finalPromptViewName: string;
  compositionInstruction: string;
};

export const CANONICAL_VIEW_SPECS = [
  {
    key: "front",
    label: "正面",
    promptPhrase: "front view only",
    promptNoun: "front-view",
    finalPromptViewName: "front view",
    compositionInstruction: "Show the full body from head to toe, standing upright in a neutral symmetrical pose, facing directly forward. Arms should rest naturally at the sides or be slightly relaxed outward so the outfit is clearly visible.",
  },
  {
    key: "back",
    label: "背面",
    promptPhrase: "back view only",
    promptNoun: "back-view",
    finalPromptViewName: "back view",
    compositionInstruction: "Show the full body from head to toe, standing upright in a neutral symmetrical pose, facing directly away from the camera. Keep the outfit silhouette and hair readable from the back.",
  },
  {
    key: "left",
    label: "左侧",
    promptPhrase: "left side view only",
    promptNoun: "left-side-view",
    finalPromptViewName: "left side view",
    compositionInstruction: "Show the full body from head to toe, standing upright in a neutral pose, turned into a clean left side profile. Keep arms slightly relaxed so the side silhouette and outfit layers are readable.",
  },
  {
    key: "right",
    label: "右侧",
    promptPhrase: "right side view only",
    promptNoun: "right-side-view",
    finalPromptViewName: "right side view",
    compositionInstruction: "Show the full body from head to toe, standing upright in a neutral pose, turned into a clean right side profile. Keep arms slightly relaxed so the side silhouette and outfit layers are readable.",
  },
] as const satisfies readonly CanonicalViewSpec[];

export function getCanonicalViewSpec(key: string | null | undefined) {
  return CANONICAL_VIEW_SPECS.find((view) => view.key === key) ?? null;
}

export function getCanonicalViewLabel(key: string | null | undefined) {
  return getCanonicalViewSpec(key)?.label ?? "未标注角度";
}

export type CanonicalViewGenerationPayload = {
  canonicalView: CanonicalViewKey;
  canonicalViewLabel: string;
  provider?: CanonicalImageProvider;
  hostModel?: string;
  imageModel?: "gpt-image-2";
  hostInstruction?: string;
  visualPrompt: string;
  renderedPrompt?: string;
  negativePrompt?: string | null;
  toolParams?: CanonicalProviderToolParams;
  inputImages?: CanonicalProviderInputImage[];
  sourceImageIds?: string[];
};

export function buildCanonicalViewGenerationPayloads(input: {
  characterName: string;
  triggerToken: string;
  provider?: CanonicalImageProvider;
  hostModel?: string;
  imageModel?: "gpt-image-2";
  hostInstruction?: string;
  visualPrompt?: string | null;
  renderedPrompt?: string;
  negativePrompt?: string | null;
  toolParams?: CanonicalProviderToolParams;
  inputImages?: CanonicalProviderInputImage[];
  sourceImageIds?: string[];
  characterDescription?: string | null;
  finalPromptDraft?: string | null;
}): CanonicalViewGenerationPayload[] {
  return CANONICAL_VIEW_SPECS.map((view) => ({
    canonicalView: view.key,
    canonicalViewLabel: view.label,
    provider: input.provider,
    hostModel: input.hostModel,
    imageModel: input.imageModel,
    hostInstruction: input.hostInstruction,
    visualPrompt: buildCanonicalViewVisualPrompt({
      characterName: input.characterName,
      triggerToken: input.triggerToken,
      view,
      operatorPrompt: input.visualPrompt ?? undefined,
      characterDescription: input.characterDescription,
      finalPromptDraft: input.finalPromptDraft,
    }),
    renderedPrompt: input.renderedPrompt,
    negativePrompt: input.negativePrompt,
    toolParams: input.toolParams,
    inputImages: input.inputImages,
    sourceImageIds: input.sourceImageIds,
  }));
}

export function buildCanonicalViewVisualPrompt(input: {
  characterName: string;
  triggerToken: string;
  view: CanonicalViewSpec;
  operatorPrompt?: string | null;
  characterDescription?: string | null;
  finalPromptDraft?: string | null;
}) {
  const characterDetails = input.characterDescription?.trim()
    ? input.characterDescription.trim()
    : "First derive a detailed character description from Image A/source reference images: stable identity, face, hair, eyes, outfit construction, colors, accessories, footwear/legwear, distinctive asymmetric details, and the overall anime/fantasy illustration style. Use only visible details; do not invent lore.";
  const finalPromptDraft = input.finalPromptDraft?.trim();

  return [
    `Create a clean single-character full-body turnaround reference image based on Image A for ${input.characterName}.`,
    "Image A/source images are the character identity and outfit reference.",
    `Show the same character in a full-body ${input.view.promptPhrase}, standing in a neutral upright pose, with the entire body visible from head to toe.`,
    input.view.compositionInstruction,
    "Use a simple pure white background with no scenery and no logo. Make the image clean, centered, polished, and suitable as a character reference sheet.",
    `Preserve these character details: ${characterDetails}`,
    finalPromptDraft ? `Use this finished comma-separated positive prompt tag list as additional identity guidance: ${finalPromptDraft}` : null,
    "Convert any seated, floating, action, cropped, prop-heavy, or background-heavy source pose into a clear standing model-sheet style reference pose while keeping the same outfit, hair, face, colors, and recognizable design elements.",
    `Treat trigger token "${input.triggerToken}" as metadata only; do not render text in the image.`,
    "Remove all non-character elements from the source image: no props, no extra characters, no decorative background, no text, no logo, no watermark.",
    "Do not change the character into a different person. Do not simplify the outfit too much. Do not add new accessories. Do not crop the feet, hair, hands, or outfit.",
    "Do not create a multi-view sheet, contact sheet, collage, turnaround chart, side-by-side panels, labels, text, logo, watermark, extra props, extra characters, or background clutter.",
    `Do not create any other angle. Generate only a single ${input.view.promptNoun} full-body character reference on a white background.`,
    input.operatorPrompt?.trim() ? `Operator notes: ${input.operatorPrompt.trim()}` : null,
  ].filter((line): line is string => Boolean(line)).join(" ");
}

export function buildCanonicalRerunPrompt(input: {
  userInstruction: string;
  canonicalView?: string | null;
}) {
  const view = getCanonicalViewSpec(input.canonicalView);
  const viewInstruction = view
    ? [
        `Keep the regenerated image as ${view.promptPhrase}; do not rotate it into another angle.`,
        view.compositionInstruction,
      ].join(" ")
    : "Keep the regenerated image as the same single-view full-body composition as the provided canonical reference; do not rotate it into another angle.";

  return [
    "Regenerate a single-character canonical/reference image by using the provided canonical image as the primary visual reference.",
    "Preserve the character identity, face, hair, outfit, shoes, accessories, and overall silhouette unless the user explicitly asks to change them.",
    viewInstruction,
    "Keep a plain white or neutral background, clean lighting, full-body composition, no text, logo, watermark, extra characters, or background clutter.",
    `User requested adjustment: ${input.userInstruction}`,
  ].join(" ");
}

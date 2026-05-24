import { CANONICAL_VIEW_SPECS } from "./character-lora-canonical-views";

export class PromptCardDraftParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptCardDraftParseError";
  }
}

export type PromptCardDraftFields = {
  characterDescription: string;
  identityTraits: string;
  outfitTraits: string;
  negativeTraits: string;
  finalPromptDraft: string;
};

export function buildPromptCardDraftPrompt(input: {
  characterName: string;
  triggerToken: string;
  sourceImageCount: number;
  canonicalImageCount: number;
  operatorNotes?: string | null;
}) {
  return [
    "You will extract a draft character LoRA prompt card from the attached reference images, with reviewed fields for the human to edit.",
    "Do not save or mutate anything; this is a reviewed draft for a human to edit before persistence.",
    `Character name: ${input.characterName}`,
    `Trigger token: ${input.triggerToken}`,
    `Reference image counts: ${input.sourceImageCount} source image(s), ${input.canonicalImageCount} canonical view image(s).`,
    input.canonicalImageCount >= 4
      ? "The canonical references are intended to cover front, back, left, and right views; reconcile them into one coherent character identity/outfit card."
      : "If canonical views are incomplete, infer conservatively from the available images and mark uncertainties in negativeTraits or concise notes.",
    input.operatorNotes?.trim() ? `Operator notes: ${input.operatorNotes.trim()}` : null,
    "First generate a detailed prose characterDescription from the original/source reference images: identity, face, hair, eyes, outfit construction, colors, accessories, legwear/footwear, asymmetric details, and overall anime/fantasy style. Use only visible stable details; do not invent lore.",
    "Then extract a finished LoRA positive prompt as comma-separated final positive prompt tags. It should be concise but complete, like: trigger_token, hair color/style, eye color, outfit pieces, accessories, colors, legwear/footwear, distinctive motifs.",
    "Return only one compact JSON object with these fields:",
    '{"characterDescription":"detailed visible character identity and outfit description in prose","identityTraits":["stable identity, face, hair, eyes, body-shape traits"],"outfitTraits":{"mainOutfit":["clothing, footwear, accessories, colors, distinctive details"]},"negativeTraits":["identity/outfit mistakes to avoid"],"finalPromptDraft":"trigger_token, concise comma-separated final positive prompt"}',
    "Rules: include the trigger token at the start of finalPromptDraft; finalPromptDraft must be a comma-separated tag list, not prose; be specific about visible stable traits; avoid uncertain lore; do not include private file paths; do not include markdown fences.",
  ].filter((line): line is string => Boolean(line)).join("\n");
}

export function parsePromptCardDraftResponse(text: string): PromptCardDraftFields {
  const record = parseJsonObjectFromResponse(text);
  const finalPromptDraft = stringFromUnknown(record.finalPromptDraft ?? record.final_prompt_draft).trim();
  const characterDescription = stringFromUnknown(
    record.characterDescription ?? record.character_description ?? record.description,
  ).trim();

  if (!finalPromptDraft) {
    throw new PromptCardDraftParseError("Prompt card draft response is missing finalPromptDraft");
  }

  return {
    characterDescription,
    identityTraits: editableIdentityTraits(record.identityTraits ?? record.identity_traits, characterDescription),
    outfitTraits: editableJsonish(record.outfitTraits ?? record.outfit_traits),
    negativeTraits: editableJsonish(record.negativeTraits ?? record.negative_traits ?? []),
    finalPromptDraft,
  };
}

function parseJsonObjectFromResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const direct = tryParseJsonObject(trimmed);
  if (direct) return direct;

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const fenced = tryParseJsonObject(fencedMatch[1].trim());
    if (fenced) return fenced;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = tryParseJsonObject(trimmed.slice(start, end + 1));
    if (sliced) return sliced;
  }

  throw new PromptCardDraftParseError("Prompt card draft response did not contain a JSON object");
}

function tryParseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function editableIdentityTraits(value: unknown, characterDescription: string) {
  if (!characterDescription) return editableJsonish(value);

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify({ characterDescription, ...value as Record<string, unknown> }, null, 2);
  }

  return JSON.stringify({ characterDescription, traits: value ?? [] }, null, 2);
}

function editableJsonish(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value, null, 2);
}

function stringFromUnknown(value: unknown) {
  return typeof value === "string" ? value : "";
}

export type PromptCardDraftCanonicalVersionChoice = {
  id: string;
  version: number;
  status?: string | null;
  canonicalView?: string | null;
  createdAt?: Date | string | number | null;
};

export function selectLatestCanonicalVersionsByView<T extends PromptCardDraftCanonicalVersionChoice>(versions: readonly T[]) {
  const eligibleVersions = versions.filter((version) => version.status !== "rejected");
  const selected: T[] = [];
  const selectedIds = new Set<string>();

  for (const view of CANONICAL_VIEW_SPECS) {
    const latestForView = eligibleVersions
      .filter((version) => version.canonicalView === view.key)
      .sort(compareCanonicalVersionChoiceDesc)[0];

    if (latestForView) {
      selected.push(latestForView);
      selectedIds.add(latestForView.id);
    }
  }

  if (selected.length >= CANONICAL_VIEW_SPECS.length) {
    return selected;
  }

  const fallbackVersions = eligibleVersions
    .filter((version) => !selectedIds.has(version.id))
    .sort(compareCanonicalVersionChoiceDesc)
    .slice(0, CANONICAL_VIEW_SPECS.length - selected.length);

  return [...selected, ...fallbackVersions];
}

function compareCanonicalVersionChoiceDesc(a: PromptCardDraftCanonicalVersionChoice, b: PromptCardDraftCanonicalVersionChoice) {
  if (a.version !== b.version) {
    return b.version - a.version;
  }

  return timestampFromUnknown(b.createdAt) - timestampFromUnknown(a.createdAt);
}

function timestampFromUnknown(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim()) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  return 0;
}

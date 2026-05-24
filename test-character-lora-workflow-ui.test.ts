import { readFileSync } from "node:fs";
import { test } from "node:test";
import { strict as assert } from "node:assert";

import { normalizeSourceImageUploadRole } from "./src/lib/character-lora-source-images";
import {
  CANONICAL_VIEW_SPECS,
  buildCanonicalRerunPrompt,
  buildCanonicalViewGenerationPayload,
  buildCanonicalViewGenerationPayloads,
  buildCanonicalViewVisualPrompt,
  groupCanonicalVersionsByView,
  normalizeCanonicalViewKey,
} from "./src/lib/character-lora-canonical-views";
import {
  PromptCardDraftParseError,
  buildPromptCardDraftPrompt,
  parsePromptCardDraftResponse,
  selectLatestCanonicalVersionsByView,
} from "./src/lib/character-lora-prompt-card-draft";

test("source image uploads are normalized to one undifferentiated source role", () => {
  assert.equal(normalizeSourceImageUploadRole(undefined), "source");
  assert.equal(normalizeSourceImageUploadRole("setting"), "source");
  assert.equal(normalizeSourceImageUploadRole("manual_canonical"), "source");
  assert.equal(normalizeSourceImageUploadRole("rerun_reference"), "source");
});

test("canonical generation expands one request into front back left right view payloads", () => {
  assert.deepEqual(CANONICAL_VIEW_SPECS.map((view) => view.key), ["front", "back", "left", "right"]);

  const payloads = buildCanonicalViewGenerationPayloads({
    characterName: "Nakano Miku",
    triggerToken: "miku_lora",
    sourceImageIds: ["src-1", "src-2"],
    provider: "openai-codex",
    negativePrompt: "watermark",
    visualPrompt: "keep the cardigan and headphones",
    characterDescription: "same anime girl with brown hair, green eyes, blue cardigan, and black headphones",
    finalPromptDraft: "miku_lora, brown hair, green eyes, blue cardigan, black headphones",
  });

  assert.equal(payloads.length, 4);
  assert.deepEqual(payloads.map((payload) => payload.canonicalView), ["front", "back", "left", "right"]);
  assert.deepEqual(payloads.map((payload) => payload.canonicalViewLabel), ["正面", "背面", "左侧", "右侧"]);
  assert.deepEqual(payloads.map((payload) => payload.sourceImageIds), [
    ["src-1", "src-2"],
    ["src-1", "src-2"],
    ["src-1", "src-2"],
    ["src-1", "src-2"],
  ]);
  assert.ok(payloads.every((payload) => payload.provider === "openai-codex"));
  assert.ok(payloads.every((payload) => payload.negativePrompt === "watermark"));
  assert.match(payloads[0].visualPrompt, /front view only/i);
  assert.match(payloads[1].visualPrompt, /back view only/i);
  assert.match(payloads[2].visualPrompt, /left side view only/i);
  assert.match(payloads[3].visualPrompt, /right side view only/i);
  assert.ok(payloads.every((payload) => payload.visualPrompt.includes("Preserve these character details:")));
  assert.ok(payloads.every((payload) => payload.visualPrompt.includes("same anime girl with brown hair")));
  assert.ok(payloads.every((payload) => payload.visualPrompt.includes("miku_lora, brown hair")));
  assert.ok(payloads.every((payload) => payload.visualPrompt.includes("keep the cardigan and headphones")));
});

test("single canonical view generation payload targets only the requested view", () => {
  const payload = buildCanonicalViewGenerationPayload({
    characterName: "Nakano Miku",
    triggerToken: "miku_lora",
    canonicalView: "left",
    sourceImageIds: ["source-a"],
    canonicalVersionIds: ["canonical-back-v2"],
    characterDescription: "brown hair, green eyes, blue cardigan",
  });

  assert.equal(payload.canonicalView, "left");
  assert.equal(payload.canonicalViewLabel, "左侧");
  assert.deepEqual(payload.sourceImageIds, ["source-a"]);
  assert.deepEqual(payload.canonicalVersionIds, ["canonical-back-v2"]);
  assert.match(payload.visualPrompt, /left side view only/i);
  assert.doesNotMatch(payload.visualPrompt, /front view only/i);
});

test("canonical grouping renders fixed view buckets and treats legacy unlabeled versions as front", () => {
  const grouped = groupCanonicalVersionsByView([
    { id: "front-v1", version: 1, canonicalView: "front" },
    { id: "legacy-v2", version: 2, canonicalView: null },
    { id: "back-v1", version: 1, canonicalView: "back" },
    { id: "unknown-v3", version: 3, canonicalView: "diagonal" },
  ]);

  assert.deepEqual(Object.keys(grouped), ["front", "back", "left", "right"]);
  assert.deepEqual(grouped.front.map((version) => version.id), ["front-v1", "legacy-v2", "unknown-v3"]);
  assert.deepEqual(grouped.back.map((version) => version.id), ["back-v1"]);
  assert.deepEqual(grouped.left, []);
  assert.deepEqual(grouped.right, []);
  assert.equal(normalizeCanonicalViewKey(null), "front");
  assert.equal(normalizeCanonicalViewKey("diagonal"), "front");
});

test("canonical view prompt is single-view and forbids turnarounds/contact sheets", () => {
  const prompt = buildCanonicalViewVisualPrompt({
    characterName: "Luca",
    triggerToken: "luca_char",
    view: CANONICAL_VIEW_SPECS[0],
  });

  assert.match(prompt, /First derive a detailed character description from Image A/i);
  assert.match(prompt, /Create a clean single-character full-body turnaround reference image based on Image A/i);
  assert.match(prompt, /front view only/i);
  assert.match(prompt, /Preserve these character details/i);
  assert.match(prompt, /Do not create a multi-view sheet/i);
  assert.match(prompt, /Generate only a single front-view full-body character reference/i);
});

test("canonical rerun prompt preserves the persisted canonical view instead of forcing front view", () => {
  const prompt = buildCanonicalRerunPrompt({
    canonicalView: "back",
    userInstruction: "make the bow larger",
  });

  assert.match(prompt, /back view only/i);
  assert.doesNotMatch(prompt, /front-facing/i);
  assert.match(prompt, /make the bow larger/i);
});

test("canonical view is a persisted backend field on generation runs and canonical versions", () => {
  for (const schemaPath of ["prisma/schema.sqlite.prisma", "prisma/schema.prisma"]) {
    const schema = readFileSync(schemaPath, "utf8");
    assert.match(schema, /model CharacterLoraCanonicalVersion[\s\S]*canonicalView\s+String\?/);
    assert.match(schema, /model CharacterLoraGenerationRun[\s\S]*canonicalView\s+String\?/);
  }
});

test("persona reference UI exposes per-view generation, canonical reference checkboxes, and uploadable rerun references", () => {
  const page = readFileSync("src/app/character-lora-training/[jobId]/persona-reference/page.tsx", "utf8");

  assert.match(page, /CANONICAL_VIEW_SPECS\.map/);
  assert.match(page, /submitLabel=\{`生成\$\{view\.label\}`\}/);
  assert.match(page, /name="canonicalVersionIds"/);
  assert.match(page, /name="referenceFiles"/);
  assert.match(page, /type="file"/);
});

test("prompt card draft prompt requests reviewed JSON fields without saving", () => {
  const prompt = buildPromptCardDraftPrompt({
    characterName: "Nakano Miku",
    triggerToken: "miku_lora",
    sourceImageCount: 3,
    canonicalImageCount: 4,
    operatorNotes: "keep headphones and cardigan",
  });

  assert.match(prompt, /extract a draft character LoRA prompt card/i);
  assert.match(prompt, /miku_lora/);
  assert.match(prompt, /4 canonical view image/i);
  assert.match(prompt, /Do not save or mutate anything/i);
  assert.match(prompt, /characterDescription/);
  assert.match(prompt, /comma-separated final positive prompt/i);
  assert.match(prompt, /identityTraits/);
  assert.match(prompt, /outfitTraits/);
  assert.match(prompt, /finalPromptDraft/);
});

test("prompt card draft parser extracts compact editable fields from model JSON", () => {
  const draft = parsePromptCardDraftResponse(`Here is the JSON:\n{
    "characterDescription": "A consistent anime girl with brown hair, green eyes, blue cardigan, and black loafers.",
    "identityTraits": ["brown hair", "green eyes"],
    "outfitTraits": {"top":"blue cardigan", "shoes":"black loafers"},
    "negativeTraits": ["wrong eye color", "missing headphones"],
    "finalPromptDraft": "miku_lora, brown hair, green eyes, blue cardigan, black loafers"
  }`);

  assert.equal(draft.characterDescription, "A consistent anime girl with brown hair, green eyes, blue cardigan, and black loafers.");
  assert.deepEqual(JSON.parse(draft.identityTraits), {
    characterDescription: "A consistent anime girl with brown hair, green eyes, blue cardigan, and black loafers.",
    traits: ["brown hair", "green eyes"],
  });
  assert.deepEqual(JSON.parse(draft.outfitTraits), { top: "blue cardigan", shoes: "black loafers" });
  assert.deepEqual(JSON.parse(draft.negativeTraits), ["wrong eye color", "missing headphones"]);
  assert.equal(draft.finalPromptDraft, "miku_lora, brown hair, green eyes, blue cardigan, black loafers");
});

test("prompt card draft parser reports invalid model output as a parse error", () => {
  assert.throws(
    () => parsePromptCardDraftResponse("not json"),
    PromptCardDraftParseError,
  );
});

test("prompt card draft canonical selection picks the latest non-rejected version per canonical view", () => {
  const versions = [
    { id: "front-old", version: 1, status: "candidate", canonicalView: "front" },
    { id: "front-new", version: 5, status: "candidate", canonicalView: "front" },
    { id: "back-rejected", version: 6, status: "rejected", canonicalView: "back" },
    { id: "back-good", version: 3, status: "candidate", canonicalView: "back" },
    { id: "left-good", version: 4, status: "selected", canonicalView: "left" },
    { id: "right-good", version: 2, status: "candidate", canonicalView: "right" },
    { id: "legacy-unlabeled", version: 7, status: "candidate", canonicalView: null },
  ];

  assert.deepEqual(selectLatestCanonicalVersionsByView(versions).map((version) => version.id), [
    "legacy-unlabeled",
    "back-good",
    "left-good",
    "right-good",
  ]);
});

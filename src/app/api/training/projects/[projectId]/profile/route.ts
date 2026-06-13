import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingJobOverview,
  mapCharacterLoraTrainingJobError,
  getCharacterLoraTrainingJob,
} from "@/server/services/character-lora-training/job-service";
import {
  createCharacterLoraPromptCardVersion,
  listCharacterLoraPromptCardVersions,
  mapCharacterLoraPromptCardError,
} from "@/server/services/character-lora-training/prompt-card-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const [overview, promptCardVersions] = await Promise.all([
      getCharacterLoraTrainingJobOverview(projectId),
      listCharacterLoraPromptCardVersions(projectId),
    ]);
    const latestPromptCard = promptCardVersions.at(-1) ?? null;

    return ok({
      projectId,
      triggerToken: overview.job.triggerToken,
      characterName: overview.job.characterName,
      loraUsagePrompt: latestPromptCard?.finalPromptDraft ?? null,
      characterDetailPrompt: latestPromptCard
        ? JSON.stringify(
            {
              identityTraits: latestPromptCard.identityTraits,
              outfitTraits: latestPromptCard.outfitTraits,
              negativeTraits: latestPromptCard.negativeTraits,
            },
            null,
            2,
          )
        : null,
      promptCardVersionId: latestPromptCard?.id ?? null,
      sourceImageCount: overview.sourceImages.count,
      canonicalVersionId: overview.personaReference.currentCanonicalVersionId,
    });
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object") {
    return fail("Profile update body must be an object", 400);
  }

  const payload = body as Record<string, unknown>;
  const loraUsagePrompt = typeof payload.loraUsagePrompt === "string" ? payload.loraUsagePrompt.trim() : "";
  const characterDetailPrompt = typeof payload.characterDetailPrompt === "string" ? payload.characterDetailPrompt.trim() : "";

  if (!loraUsagePrompt && !characterDetailPrompt) {
    return fail("At least one profile field is required", 400, {
      supportedFields: ["loraUsagePrompt", "characterDetailPrompt"],
    });
  }

  try {
    const { projectId } = await params;
    const [job, promptCardVersions] = await Promise.all([
      getCharacterLoraTrainingJob(projectId),
      listCharacterLoraPromptCardVersions(projectId),
    ]);
    const currentPromptCard = promptCardVersions.find((version) => version.id === job.currentPromptCardVersionId) ?? promptCardVersions.at(-1) ?? null;

    let detailPayload: {
      identityTraits?: Record<string, unknown>;
      outfitTraits?: Record<string, unknown>;
      negativeTraits?: unknown[] | null;
    } = {};

    if (characterDetailPrompt) {
      try {
        const parsed = JSON.parse(characterDetailPrompt);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return fail("characterDetailPrompt must be a JSON object string", 400);
        }
        detailPayload = parsed as typeof detailPayload;
      } catch {
        return fail("characterDetailPrompt must be a JSON object string", 400);
      }
    }

    const data = await createCharacterLoraPromptCardVersion(projectId, {
      canonicalVersionId: currentPromptCard?.canonicalVersionId ?? job.currentCanonicalVersionId ?? null,
      triggerToken: job.triggerToken,
      identityTraits: detailPayload.identityTraits ?? currentPromptCard?.identityTraits ?? {},
      outfitTraits: detailPayload.outfitTraits ?? currentPromptCard?.outfitTraits ?? {},
      negativeTraits: detailPayload.negativeTraits ?? currentPromptCard?.negativeTraits ?? null,
      finalPromptDraft: loraUsagePrompt || currentPromptCard?.finalPromptDraft || job.triggerToken,
      changeReason: "Updated via training profile API",
    });

    return ok(data);
  } catch (error) {
    const promptCardMapped = mapCharacterLoraPromptCardError(error);
    if (promptCardMapped.status !== 500 || promptCardMapped.message !== "Unexpected character LoRA prompt card error") {
      return fail(promptCardMapped.message, promptCardMapped.status, promptCardMapped.details);
    }

    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import {
  getManagedTrainingProjectProfile,
  updateManagedTrainingProjectProfile,
} from "@/server/services/training/project-service";
import {
  createLegacyTrainingPromptCardVersion,
  getLegacyTrainingProject,
  getLegacyTrainingProjectOverview,
  listLegacyTrainingPromptCardVersions,
  mapLegacyTrainingProjectError,
  mapLegacyTrainingPromptCardError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const managedProfile = await getManagedTrainingProjectProfile(projectId);
    if (managedProfile) {
      return ok(managedProfile);
    }
    const [overview, promptCardVersions] = await Promise.all([
      getLegacyTrainingProjectOverview(projectId),
      listLegacyTrainingPromptCardVersions(projectId),
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
    const mapped = mapLegacyTrainingProjectError(error);
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
  const profileSummary = typeof payload.profileSummary === "string" ? payload.profileSummary.trim() : "";

  if (!loraUsagePrompt && !characterDetailPrompt && !profileSummary) {
    return fail("At least one profile field is required", 400, {
      supportedFields: ["loraUsagePrompt", "characterDetailPrompt", "profileSummary"],
    });
  }

  try {
    const { projectId } = await params;
    const managedProfile = await getManagedTrainingProjectProfile(projectId);
    if (managedProfile) {
      const data = await updateManagedTrainingProjectProfile(projectId, {
        loraUsagePrompt,
        characterDetailPrompt,
        profileSummary,
      });
      if (!data) {
        return fail("Training project profile not found", 404, { projectId });
      }
      return ok(data);
    }

    const [job, promptCardVersions] = await Promise.all([
      getLegacyTrainingProject(projectId),
      listLegacyTrainingPromptCardVersions(projectId),
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

    const data = await createLegacyTrainingPromptCardVersion(projectId, {
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
    const promptCardMapped = mapLegacyTrainingPromptCardError(error);
    if (promptCardMapped.status !== 500 || promptCardMapped.message !== "Unexpected character LoRA prompt card error") {
      return fail(promptCardMapped.message, promptCardMapped.status, promptCardMapped.details);
    }

    const mapped = mapLegacyTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingJobOverview,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";
import { listCharacterLoraPromptCardVersions } from "@/server/services/character-lora-training/prompt-card-service";

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

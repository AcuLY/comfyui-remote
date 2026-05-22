import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraCandidateImages,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

type JobImagesRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(request: Request, context: JobImagesRouteContext) {
  const { jobId } = await context.params;
  const searchParams = new URL(request.url).searchParams;

  try {
    const data = await listCharacterLoraCandidateImages(jobId, {
      sectionId: searchParams.get("sectionId") ?? undefined,
      generationRunId: searchParams.get("generationRunId") ?? undefined,
      reviewStatus: searchParams.get("reviewStatus") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

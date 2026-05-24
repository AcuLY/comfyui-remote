import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraCandidateImages,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

type DatasetPreviewRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: DatasetPreviewRouteContext) {
  const { jobId } = await context.params;

  try {
    const images = await listCharacterLoraCandidateImages(jobId, {});
    const keepImages = images.filter((image) => image.reviewStatus === "keep" || image.reviewStatus === "included_in_training");
    return ok({
      itemCount: keepImages.length,
      missingCaptionCount: keepImages.filter((image) => !image.captionDraft?.trim()).length,
      images: keepImages.map((image) => ({
        id: image.id,
        sectionId: image.sectionId,
        artifactId: image.artifactId,
        relativePath: image.relativePath,
        reviewStatus: image.reviewStatus,
        captionDraft: image.captionDraft,
        includedDatasetRevisionId: image.includedDatasetRevisionId,
      })),
    });
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraCanonicalError,
  rejectCharacterLoraCanonicalVersion,
} from "@/server/services/character-lora-training/canonical-service";

export const dynamic = "force-dynamic";

type RejectCanonicalRouteContext = {
  params: Promise<{ jobId: string; versionId: string }>;
};

export async function POST(_request: Request, context: RejectCanonicalRouteContext) {
  const { jobId, versionId } = await context.params;

  try {
    const data = await rejectCharacterLoraCanonicalVersion(jobId, versionId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraCanonicalError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

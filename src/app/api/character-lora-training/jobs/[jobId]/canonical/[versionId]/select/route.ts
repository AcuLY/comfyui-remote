import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraCanonicalError,
  selectCharacterLoraCanonicalVersion,
} from "@/server/services/character-lora-training/canonical-service";

export const dynamic = "force-dynamic";

type SelectCanonicalRouteContext = {
  params: Promise<{ jobId: string; versionId: string }>;
};

export async function POST(_request: Request, context: SelectCanonicalRouteContext) {
  const { jobId, versionId } = await context.params;

  try {
    const data = await selectCharacterLoraCanonicalVersion(jobId, versionId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraCanonicalError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

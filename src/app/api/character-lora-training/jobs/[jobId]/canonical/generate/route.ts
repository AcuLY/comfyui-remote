import { fail, ok } from "@/lib/api-response";
import {
  enqueueCharacterLoraCanonicalViewGenerationRuns,
  mapCharacterLoraCanonicalError,
} from "@/server/services/character-lora-training/canonical-service";

export const dynamic = "force-dynamic";

type GenerateCanonicalRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: GenerateCanonicalRouteContext) {
  const { jobId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await enqueueCharacterLoraCanonicalViewGenerationRuns(jobId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraCanonicalError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

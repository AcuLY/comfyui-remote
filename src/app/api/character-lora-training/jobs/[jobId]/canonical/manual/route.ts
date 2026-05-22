import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraCanonicalError,
  registerManualCharacterLoraCanonicalVersion,
} from "@/server/services/character-lora-training/canonical-service";

export const dynamic = "force-dynamic";

type ManualCanonicalRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: ManualCanonicalRouteContext) {
  const { jobId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await registerManualCharacterLoraCanonicalVersion(jobId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraCanonicalError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

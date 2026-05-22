import { fail, ok } from "@/lib/api-response";
import {
  instantiateCharacterLoraJobSections,
  mapCharacterLoraSectionTemplateError,
} from "@/server/services/character-lora-training/section-template-service";

type InstantiateSectionsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: InstantiateSectionsRouteContext) {
  const { jobId } = await context.params;
  let body: unknown;

  try {
    body = await readOptionalJsonBody(request);
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await instantiateCharacterLoraJobSections(jobId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

async function readOptionalJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

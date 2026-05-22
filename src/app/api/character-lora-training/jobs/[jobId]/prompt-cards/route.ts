import { fail, ok } from "@/lib/api-response";
import {
  createCharacterLoraPromptCardVersion,
  listCharacterLoraPromptCardVersions,
  mapCharacterLoraPromptCardError,
} from "@/server/services/character-lora-training/prompt-card-service";

type PromptCardsRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: PromptCardsRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await listCharacterLoraPromptCardVersions(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPromptCardError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: PromptCardsRouteContext) {
  const { jobId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await createCharacterLoraPromptCardVersion(jobId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraPromptCardError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

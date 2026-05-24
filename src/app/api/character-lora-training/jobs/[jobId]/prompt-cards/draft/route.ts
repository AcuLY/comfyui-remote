import { fail, ok } from "@/lib/api-response";
import {
  generateCharacterLoraPromptCardDraft,
  mapCharacterLoraPromptCardError,
} from "@/server/services/character-lora-training/prompt-card-service";

type PromptCardDraftRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, context: PromptCardDraftRouteContext) {
  const { jobId } = await context.params;
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await generateCharacterLoraPromptCardDraft(jobId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPromptCardError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraPhase3Error,
  reviewCharacterLoraImages,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleReview(request);
}

export async function PATCH(request: Request) {
  return handleReview(request);
}

async function handleReview(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await reviewCharacterLoraImages(body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

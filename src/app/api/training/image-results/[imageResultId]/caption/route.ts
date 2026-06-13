import { fail, ok } from "@/lib/api-response";
import {
  mapCharacterLoraPhase3Error,
  updateCharacterLoraImageCaption,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { imageResultId } = await params;
    const data = await updateCharacterLoraImageCaption(imageResultId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

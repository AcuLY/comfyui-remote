import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraTrainingTemplates,
  mapCharacterLoraSectionTemplateError,
} from "@/server/services/character-lora-training/section-template-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listCharacterLoraTrainingTemplates();
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

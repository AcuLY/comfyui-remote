import { fail, ok } from "@/lib/api-response";
import {
  listCharacterLoraSectionTemplates,
  mapCharacterLoraSectionTemplateError,
} from "@/server/services/character-lora-training/section-template-service";

export async function GET() {
  try {
    const data = await listCharacterLoraSectionTemplates();
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

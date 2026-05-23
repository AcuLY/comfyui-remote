import { fail, ok } from "@/lib/api-response";
import {
  copyCharacterLoraSectionTemplate,
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

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await copyCharacterLoraSectionTemplate(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

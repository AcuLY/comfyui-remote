import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingTemplateSnapshot,
  mapCharacterLoraSectionTemplateError,
  updateCharacterLoraTrainingTemplate,
} from "@/server/services/character-lora-training/section-template-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const data = await getCharacterLoraTrainingTemplateSnapshot({ id: templateId });
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { templateId } = await params;
    const data = await updateCharacterLoraTrainingTemplate(templateId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraSectionTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

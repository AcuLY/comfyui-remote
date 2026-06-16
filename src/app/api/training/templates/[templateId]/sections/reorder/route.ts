import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingTemplateError,
  reorderTrainingTemplateSections,
} from "@/server/services/training/template-service";

export const dynamic = "force-dynamic";

export async function POST(
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
    const data = await reorderTrainingTemplateSections(templateId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

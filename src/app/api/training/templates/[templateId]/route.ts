import { fail, ok } from "@/lib/api-response";
import {
  deleteManagedTrainingTemplate,
  getManagedTrainingTemplate,
  mapTrainingTemplateError,
  updateManagedTrainingTemplate,
} from "@/server/services/training/template-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const data = await getManagedTrainingTemplate(templateId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
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
    const data = await updateManagedTrainingTemplate(templateId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const data = await deleteManagedTrainingTemplate(templateId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

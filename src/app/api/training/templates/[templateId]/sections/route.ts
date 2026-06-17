import { fail, ok } from "@/lib/api-response";
import {
  createTrainingTemplateSection,
  getTrainingTemplate,
  mapTrainingTemplateError,
} from "@/server/services/training/template-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { templateId } = await params;
    const template = await getTrainingTemplate(templateId);
    return ok(template.sections);
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const { templateId } = await params;
    const data = await createTrainingTemplateSection(templateId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

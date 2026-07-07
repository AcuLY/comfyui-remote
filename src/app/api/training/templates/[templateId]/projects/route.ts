import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingProjectFromTemplate,
  mapTrainingProjectTemplateCopyError,
} from "@/server/services/training/project-template-copy-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { templateId } = await params;
    const data = await createTrainingProjectFromTemplate(templateId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingProjectTemplateCopyError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

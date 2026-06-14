import { fail, ok } from "@/lib/api-response";
import {
  createTrainingProjectFromTemplate,
  mapTrainingProjectTemplateCopyError,
} from "@/server/services/training/project-template-copy-service";

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
    const data = await createTrainingProjectFromTemplate(templateId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingProjectTemplateCopyError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

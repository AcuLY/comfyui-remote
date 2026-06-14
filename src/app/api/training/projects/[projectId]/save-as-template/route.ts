import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingProjectTemplateCopyError,
  saveTrainingProjectAsTemplate,
} from "@/server/services/training/project-template-copy-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const data = await saveTrainingProjectAsTemplate(projectId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingProjectTemplateCopyError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

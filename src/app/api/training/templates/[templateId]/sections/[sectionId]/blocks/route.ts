import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingTemplateSectionBlock,
  mapTrainingTemplateSceneBlockError,
} from "@/server/services/training/template-scene-block-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string; templateId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { sectionId, templateId } = await params;
    const data = await createTrainingTemplateSectionBlock(templateId, sectionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingTemplateSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

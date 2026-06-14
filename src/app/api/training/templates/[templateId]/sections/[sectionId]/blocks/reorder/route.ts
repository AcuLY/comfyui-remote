import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingTemplateSceneBlockError,
  reorderTrainingTemplateSectionBlocks,
} from "@/server/services/training/template-scene-block-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string; templateId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { sectionId, templateId } = await params;
    const data = await reorderTrainingTemplateSectionBlocks(templateId, sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

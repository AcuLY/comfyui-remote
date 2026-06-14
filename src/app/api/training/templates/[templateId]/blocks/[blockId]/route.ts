import { fail, ok } from "@/lib/api-response";
import {
  deleteTrainingTemplateSectionBlock,
  mapTrainingTemplateSceneBlockError,
  updateTrainingTemplateSectionBlock,
} from "@/server/services/training/template-scene-block-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ blockId: string; templateId: string }> },
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { blockId, templateId } = await params;
    const data = await updateTrainingTemplateSectionBlock(templateId, blockId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockId: string; templateId: string }> },
) {
  try {
    const { blockId, templateId } = await params;
    const data = await deleteTrainingTemplateSectionBlock(templateId, blockId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTemplateSceneBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

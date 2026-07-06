import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonBody } from "@/server/http/request-json";
import {
  assertPromptBlockBelongsToSection,
  editPromptBlock,
  removePromptBlock,
  mapPromptBlockError,
} from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string; blockId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { projectId, sectionId, blockId } = await context.params;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    await assertPromptBlockBelongsToSection(projectId, sectionId, blockId);
    const block = await editPromptBlock(blockId, body);
    return ok(block);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId, sectionId, blockId } = await context.params;

  try {
    await assertPromptBlockBelongsToSection(projectId, sectionId, blockId);
    await removePromptBlock(blockId);
    return ok({ success: true });
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

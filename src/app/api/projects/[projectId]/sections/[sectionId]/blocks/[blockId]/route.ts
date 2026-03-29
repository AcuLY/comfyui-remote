import { fail, ok } from "@/lib/api-response";
import { editPromptBlock, removePromptBlock, mapPromptBlockError } from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ jobId: string; jobPositionId: string; blockId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { blockId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const block = await editPromptBlock(blockId, body);
    return ok(block);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { blockId } = await context.params;

  try {
    await removePromptBlock(blockId);
    return ok({ success: true });
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

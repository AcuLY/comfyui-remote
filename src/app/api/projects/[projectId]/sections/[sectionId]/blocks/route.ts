import { fail, ok } from "@/lib/api-response";
import { getPromptBlocks, addPromptBlock, setPromptBlockOrder, mapPromptBlockError } from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  try {
    const blocks = await getPromptBlocks(sectionId);
    return ok(blocks);
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  // If body is an array, treat as reorder operation
  if (Array.isArray(body)) {
    try {
      const result = await setPromptBlockOrder(sectionId, body);
      return ok(result);
    } catch (error) {
      const mapped = mapPromptBlockError(error);
      return fail(mapped.message, mapped.status, mapped.details);
    }
  }

  // Otherwise, create a new block
  try {
    const block = await addPromptBlock(sectionId, body);
    return ok(block, { status: 201 });
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import { moveToFolder } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }

  const type = body?.type;
  if (type !== "preset" && type !== "group") {
    return fail("type must be 'preset' or 'group'", 400);
  }
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return fail("id is required", 400);
  }

  try {
    await moveToFolder(type, id, folderId || null);
    return ok({ success: true });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

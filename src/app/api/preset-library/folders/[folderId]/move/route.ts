import { fail, ok } from "@/lib/api-response";
import { moveToFolder } from "@/lib/actions";
import { HttpRequestError, readJsonObject } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ folderId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { folderId } = await context.params;

  try {
    const body = await readJsonObject(request);

    const type = body.type;
    if (type !== "preset" && type !== "group") {
      return fail("type must be 'preset' or 'group'", 400);
    }
    const id = body.id;
    if (!id || typeof id !== "string") {
      return fail("id is required", 400);
    }

    await moveToFolder(type, id, folderId || null);
    return ok({ success: true });
  } catch (e: unknown) {
    if (e instanceof HttpRequestError) {
      return fail(e.message, e.status, e.details);
    }
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

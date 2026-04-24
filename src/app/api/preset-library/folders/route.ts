import { fail, ok } from "@/lib/api-response";
import { createPresetFolder } from "@/lib/actions";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }

  const categoryId = body?.categoryId;
  const parentId = body?.parentId ?? null;
  const name = body?.name;

  if (!categoryId || typeof categoryId !== "string") return fail("categoryId is required", 400);
  if (!name || typeof name !== "string") return fail("name is required", 400);

  try {
    const result = await createPresetFolder(categoryId, parentId, name);
    return ok(result);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

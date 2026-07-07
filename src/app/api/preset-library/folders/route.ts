import { fail, failFromError, ok } from "@/lib/api-response";
import { createPresetFolder } from "@/lib/actions/preset-folder";
import { getPresetFolders } from "@/lib/server-data";
import { readJsonObject } from "@/server/http/request-json";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parentParam = url.searchParams.get("parentId");
    const folders = await getPresetFolders({
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      parentId: parentParam === null ? undefined : parentParam || null,
    });
    return ok(folders);
  } catch (e: unknown) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const categoryId = body.categoryId;
    const parentId = (body.parentId ?? null) as string | null;
    const name = body.name;

    if (!categoryId || typeof categoryId !== "string") return fail("categoryId is required", 400);
    if (!name || typeof name !== "string") return fail("name is required", 400);

    const result = await createPresetFolder(categoryId, parentId, name);
    return ok(result);
  } catch (e: unknown) {
    return failFromError(e);
  }
}

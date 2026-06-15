import { fail, ok } from "@/lib/api-response";
import {
  createTrainingSceneDescriptionFolder,
  listTrainingSceneDescriptionTree,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    const tree = await listTrainingSceneDescriptionTree({ includeInactive });
    const folders = tree.categories.flatMap((category) =>
      (category.folders ?? []).map((folder) => ({
        categoryId: folder.categoryId,
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        sortOrder: folder.sortOrder,
      }))
    );
    return ok({ folders });
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await createTrainingSceneDescriptionFolder(body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

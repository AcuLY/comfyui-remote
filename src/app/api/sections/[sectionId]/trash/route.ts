import { fail, ok } from "@/lib/api-response";
import { listSectionTrashItems } from "@/server/repositories/trash-repository";

type RouteContext = {
  params: Promise<{ sectionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sectionId } = await context.params;
  const normalizedSectionId = sectionId.trim();

  if (!normalizedSectionId) {
    return fail("sectionId is required", 400);
  }

  try {
    const data = await listSectionTrashItems(normalizedSectionId);
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.message === "SECTION_NOT_FOUND") {
      return fail("Section not found", 404);
    }

    return fail("Failed to load section trash items", 500, String(error));
  }
}

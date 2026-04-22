import { fail, ok } from "@/lib/api-response";
import { copySection } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sectionId } = await context.params;

  try {
    const id = await copySection(sectionId);
    if (!id) {
      return fail("Section not found", 404);
    }
    return ok({ id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to copy section", 500);
  }
}

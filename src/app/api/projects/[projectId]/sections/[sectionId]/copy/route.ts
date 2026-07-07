import { fail, ok } from "@/lib/api-response";
import { copySection } from "@/lib/actions/section";
import { assertSectionBelongsToProject, mapPromptBlockError } from "@/server/services/prompt-block-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { projectId, sectionId } = await context.params;

  try {
    await assertSectionBelongsToProject(projectId, sectionId);
    const id = await copySection(sectionId);
    if (!id) {
      return fail("Section not found", 404);
    }
    return ok({ id });
  } catch (error) {
    const mapped = mapPromptBlockError(error);
    if (mapped.status !== 500) return fail(mapped.message, mapped.status, mapped.details);
    return fail(error instanceof Error ? error.message : "Failed to copy section", 500);
  }
}

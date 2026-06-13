import { fail, ok } from "@/lib/api-response";
import { getTrainingProject, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  mapTrainingProjectSectionError,
  upsertTrainingProjectSectionOverride,
} from "@/server/services/training/project-section-service";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, sectionId } = await context.params;
    const project = await getTrainingProject(projectId);
    const section = project.sections.find((item) => item.id === sectionId);
    if (!section) {
      return fail("Training project section not found", 404, { projectId, sectionId });
    }
    return ok(section);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId, sectionId } = await context.params;
    const project = await getTrainingProject(projectId);
    const section = project.sections.find((item) => item.id === sectionId);
    if (!section) {
      return fail("Training project section not found", 404, { projectId, sectionId });
    }

    await upsertTrainingProjectSectionOverride(projectId, sectionId, body);

    const updatedProject = await getTrainingProject(projectId);
    const updatedSection = updatedProject.sections.find((item) => item.id === sectionId);
    if (!updatedSection) {
      return fail("Training project section not found after save", 404, { projectId, sectionId });
    }
    return ok(updatedSection);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

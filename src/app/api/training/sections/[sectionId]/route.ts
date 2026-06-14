import { fail, ok } from "@/lib/api-response";
import { getTrainingSectionContext, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  deleteTrainingProjectSection,
  mapTrainingProjectSectionError,
  upsertTrainingProjectSection,
} from "@/server/services/training/project-section-service";

type RouteContext = {
  params: Promise<{ sectionId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sectionId } = await context.params;
    const projectId = new URL(_request.url).searchParams.get("projectId");
    const { section } = await getTrainingSectionContext(sectionId, projectId);
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
    const { sectionId } = await context.params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const { project } = await getTrainingSectionContext(sectionId, projectId);
    await upsertTrainingProjectSection(project.id, sectionId, body, project.sections);
    const { section: updatedSection } = await getTrainingSectionContext(sectionId, projectId);
    return ok(updatedSection);
  } catch (error) {
    if (error instanceof Error && error.name === "TrainingReadServiceError") {
      const mapped = mapTrainingReadError(error);
      return fail(mapped.message, mapped.status, mapped.details);
    }
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sectionId } = await context.params;
    const projectId = new URL(_request.url).searchParams.get("projectId");
    const { project } = await getTrainingSectionContext(sectionId, projectId);
    const data = await deleteTrainingProjectSection(project.id, sectionId, project.sections);
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.name === "TrainingReadServiceError") {
      const mapped = mapTrainingReadError(error);
      return fail(mapped.message, mapped.status, mapped.details);
    }
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

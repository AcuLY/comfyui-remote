import { fail, ok } from "@/lib/api-response";
import {
  deleteTrainingProjectSection,
  getTrainingSection,
  getTrainingSectionProjectContext,
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
    const data = await getTrainingSection(sectionId, projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
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
    const sectionContext = await getTrainingSectionProjectContext(sectionId, projectId);
    const data = await upsertTrainingProjectSection(sectionContext.projectId, sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sectionId } = await context.params;
    const projectId = new URL(_request.url).searchParams.get("projectId");
    const sectionContext = await getTrainingSectionProjectContext(sectionId, projectId);
    const data = await deleteTrainingProjectSection(sectionContext.projectId, sectionId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

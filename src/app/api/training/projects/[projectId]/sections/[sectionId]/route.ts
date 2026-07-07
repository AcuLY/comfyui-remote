import { fail, failFromError, ok } from "@/lib/api-response";
import {
  deleteTrainingProjectSection,
  getTrainingProjectSection,
  mapTrainingProjectSectionError,
  upsertTrainingProjectSection,
} from "@/server/services/training/project-section-service";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ projectId: string; sectionId: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId, sectionId } = await context.params;
    const data = await getTrainingProjectSection(projectId, sectionId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId, sectionId } = await context.params;
    const data = await upsertTrainingProjectSection(projectId, sectionId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { projectId, sectionId } = await context.params;
    const data = await deleteTrainingProjectSection(projectId, sectionId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

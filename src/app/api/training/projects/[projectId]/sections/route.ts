import { fail, failFromError, ok } from "@/lib/api-response";
import {
  copyTrainingProjectSection,
  createTrainingProjectSection,
  listTrainingProjectSections,
  mapTrainingProjectSectionError,
} from "@/server/services/training/project-section-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const data = await listTrainingProjectSections(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId } = await params;
    const sourceSectionId = typeof body.sourceSectionId === "string"
      ? body.sourceSectionId
      : null;
    const data = sourceSectionId
      ? await copyTrainingProjectSection(projectId, sourceSectionId)
      : await createTrainingProjectSection(projectId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import {
  copyTrainingProjectSection,
  createTrainingProjectSection,
  listTrainingProjectSections,
  mapTrainingProjectSectionError,
} from "@/server/services/training/project-section-service";

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const { projectId } = await params;
    const sourceSectionId = body && typeof body === "object" && !Array.isArray(body) && typeof (body as { sourceSectionId?: unknown }).sourceSectionId === "string"
      ? (body as { sourceSectionId: string }).sourceSectionId
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

import { fail, ok } from "@/lib/api-response";
import { getTrainingProject } from "@/server/services/training/read-service";
import {
  mapTrainingProjectSectionError,
  reorderTrainingProjectSections,
} from "@/server/services/training/project-section-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const project = await getTrainingProject(projectId);
    const data = await reorderTrainingProjectSections(projectId, body, project.sections);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingSectionBlock,
  mapTrainingProjectSectionError,
} from "@/server/services/training/project-section-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { sectionId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    const data = await createTrainingSectionBlock(sectionId, body, { projectId });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingProjectSectionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

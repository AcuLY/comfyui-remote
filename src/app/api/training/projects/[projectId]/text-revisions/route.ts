import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingTextRevision,
  listTrainingTextRevisions,
  mapTrainingTextRevisionError,
} from "@/server/services/training/text-revision-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params;
    const url = new URL(request.url);
    const data = await listTrainingTextRevisions(projectId, {
      entityType: url.searchParams.get("entityType") ?? undefined,
      entityId: url.searchParams.get("entityId") ?? undefined,
      fieldName: url.searchParams.get("fieldName") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTextRevisionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { projectId } = await params;
    const data = await createTrainingTextRevision(projectId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingTextRevisionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { fail, ok } from "@/lib/api-response";
import { enqueueManagedTrainingSectionGenerationRun, mapTrainingProjectError } from "@/server/services/training/project-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  enqueueLegacyTrainingSectionGenerationRun,
  mapLegacyTrainingGenerationError,
} from "@/server/services/training/legacy-compat-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    const data = await listTrainingRuns({ kind: "generation", projectId, sectionId });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  let body: unknown = {};

  try {
    const rawBody = await request.text();
    body = rawBody.trim() ? JSON.parse(rawBody) : {};
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const { sectionId } = await params;
    const managed = await enqueueManagedTrainingSectionGenerationRun(sectionId, typeof body === "object" && body ? body as Record<string, unknown> : {});
    if (managed) {
      return ok(managed, { status: 201 });
    }
    const data = await enqueueLegacyTrainingSectionGenerationRun(sectionId, body);
    return ok(data, { status: 201 });
  } catch (error) {
    const managedMapped = mapTrainingProjectError(error);
    if (managedMapped.status !== 500 || managedMapped.message !== "Unexpected training project error") {
      return fail(managedMapped.message, managedMapped.status, managedMapped.details);
    }
    const mapped = mapLegacyTrainingGenerationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

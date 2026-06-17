import { fail, ok } from "@/lib/api-response";
import type { LoraTrainingRun } from "@/features/training/types";
import {
  enqueueTrainingSectionGenerationRun,
  mapTrainingGenerationRunMutationError,
} from "@/server/services/training/project-actions-service";
import { listTrainingGenerationTaskRuns } from "@/server/services/training/generation-task-draft-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  try {
    const { sectionId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    const data = await listTrainingRuns({ kind: "generation", projectId, sectionId });
    const taskRuns = projectId
      ? await listTrainingGenerationTaskRuns(projectId, {}).then((runs: LoraTrainingRun[]) =>
        runs.filter((run: LoraTrainingRun) => run.sectionId === sectionId))
      : [];
    const mergedRuns = new Map([...data, ...taskRuns].map((run) => [run.id, run]));
    return ok([...mergedRuns.values()]);
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
    const payload = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const queryProjectId = new URL(request.url).searchParams.get("projectId");
    const data = await enqueueTrainingSectionGenerationRun(sectionId, {
      ...payload,
      projectId: typeof payload.projectId === "string" ? payload.projectId : queryProjectId ?? undefined,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

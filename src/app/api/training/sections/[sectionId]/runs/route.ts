import { fail, failFromError, ok } from "@/lib/api-response";
import type { LoraTrainingRun } from "@/features/training/types";
import {
  enqueueTrainingSectionGenerationRun,
  mapTrainingGenerationRunMutationError,
} from "@/server/services/training/project-actions-service";
import { listTrainingGenerationTaskRuns } from "@/server/services/training/generation-task-draft-service";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import { readOptionalJsonObject } from "@/server/http/request-json";

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
  let body: Record<string, unknown>;

  try {
    body = await readOptionalJsonObject(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { sectionId } = await params;
    const queryProjectId = new URL(request.url).searchParams.get("projectId");
    const data = await enqueueTrainingSectionGenerationRun(sectionId, {
      ...body,
      projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId ?? undefined,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationRunMutationError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

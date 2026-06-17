import { fail, ok } from "@/lib/api-response";
import type { LoraTrainingTaskStatus } from "@/features/training/types";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createTrainingGenerationTask,
  listTrainingGenerationTaskRuns,
  listTrainingGenerationTasks,
  mapTrainingGenerationTaskError,
  normalizeGenerationTaskType,
} from "@/server/services/training/generation-task-draft-service";

export const dynamic = "force-dynamic";

const RUN_STATUSES = new Set<LoraTrainingTaskStatus>(["completed", "running", "queued", "failed"]);

function normalizeRunStatus(status: string | null): LoraTrainingTaskStatus | null {
  if (!status) return null;
  return RUN_STATUSES.has(status as LoraTrainingTaskStatus) ? status as LoraTrainingTaskStatus : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const taskType = url.searchParams.get("taskType");

  try {
    const { projectId } = await params;
    if (status === "draft") {
      const data = await listTrainingGenerationTasks(projectId, { status, taskType });
      return ok(data);
    }

    if (status && !normalizeRunStatus(status)) {
      return ok([]);
    }

    const statusFilter = normalizeRunStatus(status);
    const taskTypeFilter = taskType?.trim() ? normalizeGenerationTaskType(taskType) : null;
    const data = await listTrainingRuns({
      kind: "generation",
      projectId,
      status: statusFilter ?? undefined,
    });
    const taskRuns = await listTrainingGenerationTaskRuns(projectId, {
      status: statusFilter ?? null,
      taskType: taskTypeFilter,
    });
    const mergedRuns = new Map([...data, ...taskRuns].map((run) => [run.id, run]));
    return ok([...mergedRuns.values()].filter((run) => !taskTypeFilter || run.taskType === taskTypeFilter));
  } catch (error) {
    if (status === "draft") {
      const mapped = mapTrainingGenerationTaskError(error);
      return fail(mapped.message, mapped.status, mapped.details);
    }

    const mapped = mapTrainingReadError(error);
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
    return fail("Invalid JSON body", 400);
  }

  try {
    const { projectId } = await params;
    const payload = typeof body === "object" && body ? body as Record<string, unknown> : {};
    const data = await createTrainingGenerationTask(projectId, {
      generationKind: typeof payload.generationKind === "string" ? payload.generationKind : null,
      paramsJson: Object.prototype.hasOwnProperty.call(payload, "paramsJson") ? payload.paramsJson : undefined,
      sectionId: typeof payload.sectionId === "string" ? payload.sectionId : null,
      supplementalPrompt: typeof payload.supplementalPrompt === "string" ? payload.supplementalPrompt : null,
      taskType: typeof payload.taskType === "string" ? payload.taskType : null,
    });
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingGenerationTaskError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

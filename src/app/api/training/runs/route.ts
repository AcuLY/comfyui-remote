import { fail, ok } from "@/lib/api-response";
import { listTrainingRuns, mapTrainingReadError } from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const projectId = url.searchParams.get("projectId");
    const status = url.searchParams.get("status");
    const data = await listTrainingRuns({
      kind: kind === "generation" || kind === "training" ? kind : undefined,
      projectId: projectId ?? undefined,
      status: status === "completed" || status === "running" || status === "queued" || status === "failed" ? status : undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

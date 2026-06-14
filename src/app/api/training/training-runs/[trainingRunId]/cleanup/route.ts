import { fail, ok } from "@/lib/api-response";
import {
  cleanupTrainingRun,
  mapTrainingRunMaintenanceError,
} from "@/server/services/training/run-maintenance-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ trainingRunId: string }> },
) {
  try {
    const { trainingRunId } = await params;
    const data = await cleanupTrainingRun(trainingRunId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingRunMaintenanceError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

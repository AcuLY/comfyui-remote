import { fail, ok } from "@/lib/api-response";
import {
  getTrainingDatasetRevision,
  mapTrainingReadError,
} from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ revisionId: string }> },
) {
  try {
    const { revisionId } = await params;
    const data = await getTrainingDatasetRevision(revisionId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

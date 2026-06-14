import { fail, ok } from "@/lib/api-response";
import {
  mapTrainingTextRevisionError,
  restoreTrainingTextRevision,
} from "@/server/services/training/text-revision-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ revisionId: string }> },
) {
  try {
    const { revisionId } = await params;
    const data = await restoreTrainingTextRevision(revisionId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingTextRevisionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

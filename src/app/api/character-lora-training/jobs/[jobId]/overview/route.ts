import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraTrainingJobOverview,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";

export const dynamic = "force-dynamic";

type JobOverviewRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobOverviewRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await getCharacterLoraTrainingJobOverview(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

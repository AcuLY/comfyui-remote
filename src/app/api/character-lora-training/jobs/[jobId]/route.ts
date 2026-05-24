import { fail, ok } from "@/lib/api-response";
import {
  archiveCharacterLoraTrainingJob,
  getCharacterLoraTrainingJob,
  mapCharacterLoraTrainingJobError,
  updateCharacterLoraTrainingJob,
} from "@/server/services/character-lora-training/job-service";

type JobRouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: JobRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await getCharacterLoraTrainingJob(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function PATCH(request: Request, context: JobRouteContext) {
  const { jobId } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await updateCharacterLoraTrainingJob(jobId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function DELETE(_request: Request, context: JobRouteContext) {
  const { jobId } = await context.params;

  try {
    const data = await archiveCharacterLoraTrainingJob(jobId);
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

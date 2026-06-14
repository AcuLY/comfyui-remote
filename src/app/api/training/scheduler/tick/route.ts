import { fail, ok } from "@/lib/api-response";
import { mapTrainingProjectError, tickManagedTrainingScheduler } from "@/server/services/training/project-service";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const data = await tickManagedTrainingScheduler();
    if (!data) {
      return ok({
        idle: true,
      });
    }
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

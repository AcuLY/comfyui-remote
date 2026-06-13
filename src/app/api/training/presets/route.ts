import { fail, ok } from "@/lib/api-response";
import { listTrainingPresets, mapTrainingReadError } from "@/server/services/training/read-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listTrainingPresets();
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

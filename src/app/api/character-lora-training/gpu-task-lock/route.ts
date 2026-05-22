import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraGpuTaskLock,
  mapCharacterLoraTrainingError,
} from "@/server/services/character-lora-training/training-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCharacterLoraGpuTaskLock();
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

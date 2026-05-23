import { fail, ok } from "@/lib/api-response";
import {
  getCharacterLoraWorkerQueueStatus,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCharacterLoraWorkerQueueStatus();
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

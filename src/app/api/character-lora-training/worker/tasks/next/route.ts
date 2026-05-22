import { fail, ok } from "@/lib/api-response";
import {
  leaseNextCharacterLoraTask,
  mapCharacterLoraPhase3Error,
} from "@/server/services/character-lora-training/phase3-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  try {
    const data = await leaseNextCharacterLoraTask({
      workerType: searchParams.get("workerType"),
      leaseOwner: searchParams.get("leaseOwner") ?? undefined,
      leaseDurationSeconds: searchParams.get("leaseDurationSeconds")
        ? Number(searchParams.get("leaseDurationSeconds"))
        : undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraPhase3Error(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

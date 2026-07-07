import { fail, failFromError, ok } from "@/lib/api-response";
import {
  mapTrainingPresetError,
  saveTrainingSceneDescriptionPresetSortRules,
} from "@/server/services/training/preset-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await saveTrainingSceneDescriptionPresetSortRules(body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

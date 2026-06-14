import { fail, ok } from "@/lib/api-response";
import {
  listTrainingSceneDescriptionTree,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listTrainingSceneDescriptionTree();
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

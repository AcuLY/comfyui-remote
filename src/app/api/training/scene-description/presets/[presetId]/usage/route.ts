import { fail, ok } from "@/lib/api-response";
import {
  getTrainingSceneDescriptionPresetUsage,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ presetId: string }> },
) {
  try {
    const { presetId } = await params;
    const data = await getTrainingSceneDescriptionPresetUsage(presetId);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

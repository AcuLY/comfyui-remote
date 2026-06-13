import { fail, ok } from "@/lib/api-response";
import { listTrainingPresets, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createTrainingSceneDescriptionPreset,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await createTrainingSceneDescriptionPreset(body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

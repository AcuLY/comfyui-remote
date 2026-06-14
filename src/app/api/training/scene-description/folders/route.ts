import { fail, ok } from "@/lib/api-response";
import {
  createTrainingSceneDescriptionFolder,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await createTrainingSceneDescriptionFolder(body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

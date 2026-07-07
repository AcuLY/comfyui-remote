import { fail, failFromError, ok } from "@/lib/api-response";
import {
  createTrainingSceneDescriptionCategory,
  listTrainingSceneDescriptionTree,
  mapTrainingPresetError,
} from "@/server/services/training/preset-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    const data = await listTrainingSceneDescriptionTree({ includeInactive });
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await createTrainingSceneDescriptionCategory(body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingPresetError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

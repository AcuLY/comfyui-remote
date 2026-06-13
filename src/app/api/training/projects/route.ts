import { fail, ok } from "@/lib/api-response";
import { listTrainingProjects, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createCharacterLoraTrainingProject,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await listTrainingProjects({
      status: url.searchParams.get("status") ?? undefined,
    });
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
    const data = await createCharacterLoraTrainingProject(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api-response";
import {
  createCharacterLoraTrainingJob,
  listCharacterLoraTrainingJobs,
  mapCharacterLoraTrainingJobError,
} from "@/server/services/character-lora-training/job-service";

export async function GET(request: NextRequest) {
  try {
    const data = await listCharacterLoraTrainingJobs({
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
    });

    return ok(data);
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
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
    const data = await createCharacterLoraTrainingJob(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapCharacterLoraTrainingJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

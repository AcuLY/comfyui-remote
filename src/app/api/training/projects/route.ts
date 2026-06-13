import { fail, ok } from "@/lib/api-response";
import { listTrainingProjects, mapTrainingReadError } from "@/server/services/training/read-service";

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

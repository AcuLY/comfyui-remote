import { fail, ok } from "@/lib/api-response";
import { listJobs, mapJobError } from "@/server/services/job-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await listJobs({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      hasPending: searchParams.get("hasPending") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapJobError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

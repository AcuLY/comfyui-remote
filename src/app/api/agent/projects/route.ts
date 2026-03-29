import { fail, ok } from "@/lib/api-response";
import { listProjects, mapProjectError } from "@/server/services/project-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await listProjects({
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      hasPending: searchParams.get("hasPending") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    const mapped = mapProjectError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

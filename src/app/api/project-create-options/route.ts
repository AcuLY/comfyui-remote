import { fail, ok } from "@/lib/api-response";
import { getProjectCreateOptions } from "@/server/repositories/project-repository";

export async function GET() {
  try {
    const data = await getProjectCreateOptions();
    return ok(data);
  } catch (error) {
    return fail(
      "Failed to load project create options",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

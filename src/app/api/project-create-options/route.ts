import { fail, ok } from "@/lib/api-response";
import { getJobCreateOptions } from "@/server/repositories/job-repository";

export async function GET() {
  try {
    const data = await getJobCreateOptions();
    return ok(data);
  } catch (error) {
    return fail(
      "Failed to load job create options",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

import { fail, ok } from "@/lib/api-response";
import { getJobDetail } from "@/server/repositories/job-repository";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const normalizedJobId = jobId.trim();

  if (!normalizedJobId) {
    return fail("jobId is required", 400);
  }

  try {
    const data = await getJobDetail(normalizedJobId);
    return ok(data);
  } catch (error) {
    if (error instanceof Error && error.message === "JOB_NOT_FOUND") {
      return fail("Job not found", 404);
    }

    return fail(
      "Failed to load job detail",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

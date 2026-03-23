import { fail, ok } from "@/lib/api-response";
import { listJobs } from "@/server/repositories/job-repository";

export async function GET() {
  try {
    const data = await listJobs();
    return ok(data);
  } catch (error) {
    return fail("Failed to load jobs", 500, String(error));
  }
}

export async function POST() {
  return fail("Job creation is not implemented yet", 501);
}

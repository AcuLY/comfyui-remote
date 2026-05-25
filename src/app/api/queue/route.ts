import { fail, ok } from "@/lib/api-response";
import { getQueueRuns } from "@/server/repositories/queue-data-repository";

export async function GET() {
  try {
    const data = await getQueueRuns();
    return ok(data);
  } catch (error) {
    return fail("Failed to load queue runs", 500, String(error));
  }
}

import { fail, ok } from "@/lib/api-response";
import { listQueueRuns } from "@/server/repositories/queue-repository";

export async function GET() {
  try {
    const data = await listQueueRuns();
    return ok(data);
  } catch (error) {
    return fail("Failed to load queue runs", 500, String(error));
  }
}

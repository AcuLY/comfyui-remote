import { ok } from "@/lib/api-response";
import { listWorkflowTemplateSummaries } from "@/server/services/workflow-template-service";

export async function GET() {
  const summaries = await listWorkflowTemplateSummaries();
  return ok(summaries);
}

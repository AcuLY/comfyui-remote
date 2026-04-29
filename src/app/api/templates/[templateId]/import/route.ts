import { fail, ok } from "@/lib/api-response";
import { importTemplateToProject } from "@/lib/actions";

type RouteContext = { params: Promise<{ templateId: string }> };
const duplicatePolicies = new Set(["skip", "replace", "append", "error"]);

export async function POST(request: Request, context: RouteContext) {
  const { templateId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const projectId = body?.projectId;
  if (!projectId || typeof projectId !== "string") return fail("projectId is required", 400);

  const dryRun = body.dryRun === true;
  const onExistingSections = typeof body.onExistingSections === "string"
    ? body.onExistingSections
    : "append";
  if (!duplicatePolicies.has(onExistingSections)) {
    return fail('onExistingSections must be "skip", "replace", "append", or "error"', 400);
  }

  try {
    const result = await importTemplateToProject(projectId, templateId, {
      dryRun,
      onExistingSections: onExistingSections as "skip" | "replace" | "append" | "error",
    });
    return ok(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status =
      msg === "TEMPLATE_NOT_FOUND" || msg === "PROJECT_NOT_FOUND"
        ? 404
        : msg === "TEMPLATE_IMPORT_DUPLICATE_SECTIONS"
          ? 409
          : 500;
    return fail(msg, status);
  }
}

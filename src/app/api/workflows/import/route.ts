import { fail, ok } from "@/lib/api-response";
import { importWorkflow } from "@/server/services/workflow-import-service";

type ImportRequestBody = {
  name?: unknown;
  description?: unknown;
  id?: unknown;
  promptJson?: unknown;
};

export async function POST(request: Request) {
  let body: ImportRequestBody;

  try {
    body = (await request.json()) as ImportRequestBody;
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return fail("name is required (string)", 400);
  }

  if (
    !body.promptJson ||
    typeof body.promptJson !== "object" ||
    Array.isArray(body.promptJson)
  ) {
    return fail("promptJson is required (ComfyUI API prompt object)", 400);
  }

  try {
    const result = await importWorkflow({
      name: body.name,
      description: typeof body.description === "string" ? body.description : undefined,
      id: typeof body.id === "string" ? body.id : undefined,
      promptJson: body.promptJson,
    });

    return ok(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.startsWith("IMPORT_")) {
      return fail(message.replace(/^IMPORT_\w+:\s*/, ""), 400);
    }

    return fail("Failed to import workflow", 500, message);
  }
}

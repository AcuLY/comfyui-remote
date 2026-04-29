import { fail, ok } from "@/lib/api-response";
import { createProjectTemplate } from "@/lib/actions";
import { listProjectTemplates } from "@/lib/server-data";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const templates = await listProjectTemplates({
      name: url.searchParams.get("name") ?? undefined,
    });
    return ok(templates);
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return fail("Invalid JSON body", 400); }
  try {
    const id = await createProjectTemplate(body);
    return ok({ id }, { status: 201 });
  } catch (e: unknown) {
    return fail(e instanceof Error ? e.message : "Unknown error", 500);
  }
}

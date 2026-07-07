import { failFromError, ok } from "@/lib/api-response";
import { createProjectTemplate } from "@/lib/actions/template-crud";
import { listProjectTemplates } from "@/lib/server-data";
import { readJsonObject } from "@/server/http/request-json";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const templates = await listProjectTemplates({
      name: url.searchParams.get("name") ?? undefined,
    });
    return ok(templates);
  } catch (e: unknown) {
    return failFromError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const id = await createProjectTemplate(body as Parameters<typeof createProjectTemplate>[0]);
    return ok({ id }, { status: 201 });
  } catch (e: unknown) {
    return failFromError(e);
  }
}

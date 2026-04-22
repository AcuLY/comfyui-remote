import { fail, ok } from "@/lib/api-response";
import { addSection } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const id = await addSection(projectId, body?.name as string | undefined);
    return ok({ id });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Failed to add section", 500);
  }
}

import { fail, ok } from "@/lib/api-response";
import { listTrainingTemplates, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createManagedTrainingTemplate,
  mapTrainingTemplateError,
} from "@/server/services/training/template-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listTrainingTemplates();
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingReadError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const data = await createManagedTrainingTemplate(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

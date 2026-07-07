import { fail, failFromError, ok } from "@/lib/api-response";
import { listTrainingTemplates, mapTrainingReadError } from "@/server/services/training/read-service";
import {
  createTrainingTemplate,
  mapTrainingTemplateError,
} from "@/server/services/training/template-service";
import { readJsonBody } from "@/server/http/request-json";

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
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const data = await createTrainingTemplate(body);
    return ok(data, { status: 201 });
  } catch (error) {
    const mapped = mapTrainingTemplateError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

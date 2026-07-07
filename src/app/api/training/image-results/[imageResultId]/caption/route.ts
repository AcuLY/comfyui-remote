import { fail, failFromError, ok } from "@/lib/api-response";
import {
  generateTrainingImageCaption,
  mapTrainingCaptionError,
} from "@/server/services/training/caption-service";
import { readJsonBody } from "@/server/http/request-json";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ imageResultId: string }> },
) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return failFromError(error);
  }

  try {
    const { imageResultId } = await params;
    const data = await generateTrainingImageCaption(imageResultId, body);
    return ok(data);
  } catch (error) {
    const mapped = mapTrainingCaptionError(error);
    return fail(mapped.message, mapped.status, mapped.details);
  }
}

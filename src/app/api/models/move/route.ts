import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  ModelAssetError,
  moveModelFile,
  parseModelKind,
} from "@/server/services/model-asset-service";

export async function POST(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind"));
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid JSON body", 400);
    }
    const data = await moveModelFile(kind, body as { sourcePath?: string; targetDir?: string });
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to move model file", 500, String(error));
  }
}

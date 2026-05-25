import { z } from "zod";
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  ModelAssetError,
  moveModelFile,
  parseModelKind,
} from "@/server/services/model-asset-service";

const MoveSchema = z.object({
  sourcePath: z.string().min(1),
  targetDir: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind"));
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid JSON body", 400);
    }
    const result = MoveSchema.safeParse(body);
    if (!result.success) {
      return fail("Invalid input", 400, result.error.flatten());
    }
    const data = await moveModelFile(kind, result.data);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to move model file", 500, String(error));
  }
}

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  hashModelFile,
  ModelAssetError,
  parseModelKind,
} from "@/server/services/model-asset-service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const kind = parseModelKind(searchParams.get("kind"));
    const relativePath = searchParams.get("path") ?? "";
    const data = await hashModelFile(kind, relativePath);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to hash model file", 500, String(error));
  }
}

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  browseModelDirectory,
  ModelAssetError,
  parseModelKind,
} from "@/server/services/model-asset-service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const kind = parseModelKind(searchParams.get("kind"));
    const relativePath = searchParams.get("path") ?? "";
    const recursive = searchParams.get("recursive") === "true";
    const data = await browseModelDirectory(kind, relativePath, recursive);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to browse model directory", 500, String(error));
  }
}

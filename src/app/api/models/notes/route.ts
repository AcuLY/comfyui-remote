import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  getModelNotes,
  ModelAssetError,
  parseModelKind,
  updateModelNotes,
} from "@/server/services/model-asset-service";

export async function GET(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind"));
    const paths = request.nextUrl.searchParams.get("paths") ?? "";
    const data = await getModelNotes(kind, paths);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to load model notes", 500, String(error));
  }
}

export async function PUT(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind"));
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid JSON body", 400);
    }
    const data = await updateModelNotes(kind, body as { path?: string; notes?: string; triggerWords?: string });
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to save model notes", 500, String(error));
  }
}

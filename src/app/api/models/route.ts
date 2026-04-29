import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import {
  listModelAssets,
  ModelAssetError,
  parseModelKind,
  saveUploadedModelFile,
} from "@/server/services/model-asset-service";

export async function GET(request: NextRequest) {
  try {
    const kind = parseModelKind(request.nextUrl.searchParams.get("kind"));
    const data = await listModelAssets(kind);
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to load model assets", 500, String(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const kind = parseModelKind(
      request.nextUrl.searchParams.get("kind") ??
        (typeof formData.get("kind") === "string" ? String(formData.get("kind")) : null),
    );
    const targetDir = String(formData.get("targetDir") ?? formData.get("category") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("Missing file", 400);
    }

    const saved = await saveUploadedModelFile(kind, file, targetDir);
    return ok(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to upload model file", 500, String(error));
  }
}

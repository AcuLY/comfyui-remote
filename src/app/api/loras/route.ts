import { fail, ok } from "@/lib/api-response";
import {
  listModelAssets,
  ModelAssetError,
  saveUploadedModelFile,
} from "@/server/services/model-asset-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listModelAssets("lora");
    return ok(data);
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to load LoRA assets", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const targetDir = String(formData.get("targetDir") ?? formData.get("category") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("Missing file", 400);
    }

    const saved = await saveUploadedModelFile("lora", file, targetDir);
    return ok(saved, { status: 201 });
  } catch (error) {
    if (error instanceof ModelAssetError) {
      return fail(error.message, error.status, error.details);
    }
    return fail("Failed to upload LoRA", 500, String(error));
  }
}

import { fail, ok } from "@/lib/api-response";
import { listLoraAssets } from "@/server/repositories/lora-repository";
import { LoraUploadError, saveUploadedLora } from "@/server/services/lora-upload-service";

export async function GET() {
  try {
    const data = await listLoraAssets();
    return ok(data);
  } catch (error) {
    return fail("Failed to load LoRA assets", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    // Support both new `targetDir` and legacy `category` param
    const targetDir = String(formData.get("targetDir") ?? formData.get("category") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return fail("Missing file", 400);
    }

    const saved = await saveUploadedLora(file, targetDir);
    return ok(saved, { status: 201 });
  } catch (error) {
    if (error instanceof LoraUploadError) {
      return fail(error.message, error.status);
    }

    return fail("Failed to upload LoRA", 500, String(error));
  }
}

import { fail, ok } from "@/lib/api-response";
import { listLoraAssets } from "@/server/repositories/lora-repository";

export async function GET() {
  try {
    const data = await listLoraAssets();
    return ok(data);
  } catch (error) {
    return fail("Failed to load LoRA assets", 500, String(error));
  }
}

export async function POST() {
  return fail("LoRA upload is not implemented yet", 501, {
    acceptedCategories: ["characters", "styles", "poses", "misc"],
  });
}

import { ok } from "@/lib/api-response";
import { getUploadMeta } from "@/server/services/lora-upload-service";

export async function GET() {
  return ok(getUploadMeta());
}

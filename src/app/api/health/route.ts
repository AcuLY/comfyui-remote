import { ok } from "@/lib/api-response";

export async function GET() {
  return ok({
    service: "comfyui-manager",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { listPresets, parsePresetQuery } from "@/server/services/preset-query-service";

export async function GET(request: NextRequest) {
  try {
    const presets = await listPresets(parsePresetQuery(request.nextUrl.searchParams));
    return ok(presets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}

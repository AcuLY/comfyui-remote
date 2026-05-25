import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPreset, type PresetInput } from "@/lib/actions";
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

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const result = await createPreset(body as PresetInput);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

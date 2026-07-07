import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { createPreset, type PresetInput } from "@/lib/actions/preset-variant-crud";
import { listPresets, parsePresetQuery } from "@/server/services/preset-query-service";
import { readJsonBody } from "@/server/http/request-json";

export async function GET(request: NextRequest) {
  try {
    const presets = await listPresets(parsePresetQuery(request.nextUrl.searchParams));
    return ok(presets);
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await createPreset(body as PresetInput);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

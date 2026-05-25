import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetGroup } from "@/lib/actions";
import { getPresetGroups } from "@/lib/server-data";
import type { PresetGroupInput } from "@/lib/actions/preset-group";

export async function GET() {
  try {
    const groups = await getPresetGroups();
    return ok(groups);
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
    const result = await createPresetGroup(body as PresetGroupInput);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

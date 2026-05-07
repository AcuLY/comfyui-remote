import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetGroup } from "@/lib/actions";
import { getPresetGroups } from "@/lib/server-data";

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
  try {
    const body = await request.json();
    const result = await createPresetGroup(body);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

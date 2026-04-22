import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetCategory } from "@/lib/actions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createPresetCategory(body);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

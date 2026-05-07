import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetCategory } from "@/lib/actions";
import { getPresetCategoriesWithPresets } from "@/lib/server-data";

export async function GET() {
  try {
    const categories = await getPresetCategoriesWithPresets();
    return ok(categories);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 500);
  }
}

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

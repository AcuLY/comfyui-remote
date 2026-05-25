import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { createPresetCategory, type PresetCategoryInput } from "@/lib/actions";
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  try {
    const result = await createPresetCategory(body as PresetCategoryInput);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

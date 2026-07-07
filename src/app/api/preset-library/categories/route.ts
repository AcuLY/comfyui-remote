import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { createPresetCategory, type PresetCategoryInput } from "@/lib/actions/preset-category";
import { getPresetCategoriesWithPresets } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

export async function GET() {
  try {
    const categories = await getPresetCategoriesWithPresets();
    return ok(categories);
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await createPresetCategory(body as PresetCategoryInput);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

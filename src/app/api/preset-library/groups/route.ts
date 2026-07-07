import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { createPresetGroup, type PresetGroupInput } from "@/lib/actions/preset-group";
import { getPresetGroups } from "@/lib/server-data";
import { readJsonBody } from "@/server/http/request-json";

export async function GET() {
  try {
    const groups = await getPresetGroups();
    return ok(groups);
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const result = await createPresetGroup(body as PresetGroupInput);
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

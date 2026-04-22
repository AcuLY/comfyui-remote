import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { getPresetUsage } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const result = await getPresetUsage(presetId);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

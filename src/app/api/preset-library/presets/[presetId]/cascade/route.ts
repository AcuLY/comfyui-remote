import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { deletePresetCascade } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    await deletePresetCascade(presetId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

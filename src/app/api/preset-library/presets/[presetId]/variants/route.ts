import { NextRequest } from "next/server";
import { fail, failFromError, ok } from "@/lib/api-response";
import { createPresetVariant, type PresetVariantInput } from "@/lib/actions/preset-variant-crud";
import { resolveVariantContent } from "@/lib/actions/preset-variant-resolve";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ presetId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { presetId } = await context.params;

  try {
    const body = await readJsonBody(request) as {
      action?: string;
      presetId?: unknown;
      variantId?: string;
    } & Partial<PresetVariantInput>;

    if (body.action === "resolve") {
      const variantId = body.variantId ?? presetId;
      const result = await resolveVariantContent(variantId);
      return ok(result);
    }

    if (body.action === "create") {
      const input = { ...body };
      delete input.action;
      delete input.presetId;
      const result = await createPresetVariant({ ...input, presetId } as PresetVariantInput);
      return ok(result);
    }

    return fail('action must be "create" or "resolve"', 400);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

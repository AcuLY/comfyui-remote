import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { flattenGroup } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const result = await flattenGroup(groupId);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { removeGroupMember } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ groupId: string; memberId: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { memberId } = await context.params;

  try {
    await removeGroupMember(memberId);
    return ok({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

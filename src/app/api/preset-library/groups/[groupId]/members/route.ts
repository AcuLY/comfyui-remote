import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { addGroupMember } from "@/lib/actions";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const body = await request.json();
    // Use URL param to ensure route integrity
    const result = await addGroupMember({ ...body, groupId });
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return fail(message, 400);
  }
}

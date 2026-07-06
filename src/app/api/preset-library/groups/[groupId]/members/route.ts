import { NextRequest } from "next/server";
import { failFromError, ok } from "@/lib/api-response";
import { addGroupMember } from "@/lib/actions";
import { readJsonBody } from "@/server/http/request-json";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { groupId } = await context.params;

  try {
    const body = await readJsonBody(request) as Record<string, unknown>;
    // Use URL param to ensure route integrity
    const result = await addGroupMember({ ...body, groupId });
    return ok(result);
  } catch (error) {
    return failFromError(error, "Unknown error", 400);
  }
}

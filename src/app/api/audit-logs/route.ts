import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { listAuditLogs } from "@/server/services/audit-service";

export async function GET(request: NextRequest) {
  try {
    const entityType = request.nextUrl.searchParams.get("entityType") ?? undefined;
    const entityId = request.nextUrl.searchParams.get("entityId") ?? undefined;
    const action = request.nextUrl.searchParams.get("action") ?? undefined;
    const limitStr = request.nextUrl.searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;

    const logs = await listAuditLogs({
      entityType,
      entityId,
      action,
      limit: limit && !isNaN(limit) ? limit : undefined,
    });

    return ok(logs);
  } catch (error) {
    return fail(
      "Failed to load audit logs",
      500,
      error instanceof Error ? error.message : String(error),
    );
  }
}

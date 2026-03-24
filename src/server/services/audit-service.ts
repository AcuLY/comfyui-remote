/**
 * Audit Service
 *
 * Provides fire-and-forget audit logging for key business operations.
 * Writes to the AuditLog table without blocking the caller — if a write
 * fails it is silently swallowed (best-effort).
 *
 * Usage:
 *   import { audit } from "@/server/services/audit-service";
 *   audit("CompleteJob", jobId, "create", { title }, "user");
 */

import { ActorType } from "@/lib/db-enums";
import { prisma } from "@/lib/prisma";

export type AuditEntityType =
  | "CompleteJob"
  | "CompleteJobPosition"
  | "PositionRun"
  | "ImageResult"
  | "LoraAsset"
  | "Character"
  | "ScenePreset"
  | "StylePreset"
  | "PositionTemplate"
  | "PromptBlock";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "copy"
  | "enqueue"
  | "run"
  | "keep"
  | "trash"
  | "restore"
  | "upload"
  | "reorder"
  | "worker.claim"
  | "worker.done"
  | "worker.failed";

/**
 * Write an audit log entry. Returns immediately (fire-and-forget).
 *
 * The returned promise resolves to the created record on success, or
 * `null` if the write failed. Callers do NOT need to await this.
 */
export function audit(
  entityType: AuditEntityType,
  entityId: string,
  action: AuditAction,
  payload?: Record<string, unknown> | null,
  actorType: ActorType = ActorType.system,
) {
  return prisma.auditLog
    .create({
      data: {
        entityType,
        entityId,
        action,
        payload: payload ? (JSON.parse(JSON.stringify(payload)) as object) : undefined,
        actorType,
      },
    })
    .catch(() => null);
}

/**
 * Write multiple audit log entries in one batch (fire-and-forget).
 */
export function auditMany(
  entries: Array<{
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    payload?: Record<string, unknown> | null;
    actorType?: ActorType;
  }>,
) {
  if (entries.length === 0) return Promise.resolve(null);

  return prisma.auditLog
    .createMany({
      data: entries.map((entry) => ({
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        payload: entry.payload
          ? (JSON.parse(JSON.stringify(entry.payload)) as object)
          : undefined,
        actorType: entry.actorType ?? ActorType.system,
      })),
    })
    .catch(() => null);
}

/**
 * List recent audit logs for a specific entity.
 */
export async function listAuditLogs(options?: {
  entityType?: string;
  entityId?: string;
  action?: string;
  limit?: number;
}) {
  const { entityType, entityId, action, limit = 50 } = options ?? {};

  return prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });
}

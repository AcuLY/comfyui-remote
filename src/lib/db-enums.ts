/**
 * Database enum constants.
 *
 * These are defined here (rather than imported from the generated Prisma
 * client) so that the same source code works with **both** the PostgreSQL
 * and SQLite Prisma schemas. PostgreSQL uses native `ENUM` types while
 * SQLite stores these as plain `String` columns — Prisma therefore only
 * emits TypeScript enum types when using the PostgreSQL provider.
 *
 * The values must stay in sync with `prisma/schema.prisma` (enums) and
 * `prisma/schema.sqlite.prisma` (default string values).
 */

// ---------------------------------------------------------------------------
// JobStatus
// ---------------------------------------------------------------------------

export const JobStatus = {
  draft: "draft",
  queued: "queued",
  running: "running",
  partial_done: "partial_done",
  done: "done",
  failed: "failed",
} as const;

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// ---------------------------------------------------------------------------
// RunStatus
// ---------------------------------------------------------------------------

export const RunStatus = {
  queued: "queued",
  running: "running",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
} as const;

export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

// ---------------------------------------------------------------------------
// ReviewStatus
// ---------------------------------------------------------------------------

export const ReviewStatus = {
  pending: "pending",
  kept: "kept",
  trashed: "trashed",
} as const;

export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

// ---------------------------------------------------------------------------
// ActorType
// ---------------------------------------------------------------------------

export const ActorType = {
  user: "user",
  system: "system",
  agent: "agent",
} as const;

export type ActorType = (typeof ActorType)[keyof typeof ActorType];

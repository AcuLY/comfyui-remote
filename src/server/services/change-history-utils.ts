import { Prisma } from "@/generated/prisma";

/** Deep-clone a value into a JSON-safe representation (undefined → null). */
export function cloneForJson(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

/** Deterministic JSON string for shallow equality checks. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(cloneForJson(value));
}

/** Convert an arbitrary value into a Prisma-compatible JSON input. */
export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return cloneForJson(value) as Prisma.InputJsonValue;
}

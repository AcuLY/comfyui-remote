import { Prisma } from "@/generated/prisma";

import { CharacterLoraServiceError } from "./service-error";

// ---------------------------------------------------------------------------
// ID Validation
// ---------------------------------------------------------------------------

/**
 * Trim and validate a string ID, throwing if empty.
 *
 * @param id - The raw ID value (must be a string)
 * @param fieldName - Used in the error message to identify which field failed
 * @param ErrorClass - Optional custom error class (defaults to CharacterLoraServiceError)
 */
export function normalizeId(
  id: string,
  fieldName: string,
  ErrorClass: new (message: string, status: number, details?: unknown) => CharacterLoraServiceError = CharacterLoraServiceError,
): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new ErrorClass(`${fieldName} is required`, 400);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// JSON Coercion for Prisma
// ---------------------------------------------------------------------------

/**
 * Coerce an arbitrary value into a Prisma-compatible `InputJsonValue`
 * by round-tripping through JSON serialization.
 *
 * This strips `undefined`, converts BigInt/Date via `.toJSON()`, etc.
 */
export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Safe JSON Field Reading
// ---------------------------------------------------------------------------

/**
 * Safely read an unknown value as a JSON record (object).
 * Returns an empty object if the input is not a plain object.
 *
 * Equivalent to `asRecord` in training-service / `parseRecord` in benchmark-promotion-service.
 */
export function asJsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Safely read an unknown value as a JSON record, returning `null` if not an object.
 *
 * Equivalent to `readRecord` in benchmark-promotion-service.
 */
export function readJsonRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

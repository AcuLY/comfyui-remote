/**
 * Shared validation utilities for service-layer request parsing.
 *
 * Each service module (project-service, project-folder-service, review-service)
 * was previously defining identical parse/normalize helpers with its own error
 * class.  This module provides a single canonical implementation.
 */

export class ServiceValidationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceValidationError";
  }
}

/**
 * Ensures `body` is a non-null, non-array object and returns it typed as `T`.
 */
export function parseRequestBody<T extends Record<string, unknown>>(body: unknown): T {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ServiceValidationError("Request body must be an object", 400);
  }

  return body as T;
}

/**
 * Throws if `body` contains any keys not listed in `supportedFields`.
 */
export function ensureSupportedFields(
  body: Record<string, unknown>,
  supportedFields: readonly string[],
) {
  const unsupportedFields = Object.keys(body).filter((field) => !supportedFields.includes(field));

  if (unsupportedFields.length > 0) {
    throw new ServiceValidationError("Unsupported fields in request body", 400, {
      unsupportedFields,
      supportedFields,
    });
  }
}

/**
 * Validates that `value` is a non-empty string after trimming.
 */
export function normalizeRequiredStringField(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new ServiceValidationError(`${fieldName} is required`, 400);
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new ServiceValidationError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

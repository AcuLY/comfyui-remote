/**
 * Base error class for all character-lora-training service modules.
 *
 * Each service can extend this class with its own name, or use it directly.
 */
export class CharacterLoraServiceError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "CharacterLoraServiceError";
    this.status = status;
    this.details = details;
  }
}

/**
 * Map an unknown error to a structured HTTP-friendly response shape.
 */
export function mapServiceError(error: unknown): { message: string; status: number; details?: unknown } {
  if (error instanceof CharacterLoraServiceError) {
    return { message: error.message, status: error.status, details: error.details };
  }
  if (error instanceof Error) {
    return { message: error.message, status: 500 };
  }
  return { message: String(error), status: 500 };
}

export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

function assertJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpRequestError("Request body must be an object", 400);
  }

  return value as Record<string, unknown>;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpRequestError("Invalid JSON body", 400);
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  return assertJsonObject(await readJsonBody(request));
}

export async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return assertJsonObject(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      throw error;
    }
    throw new HttpRequestError("Invalid JSON body", 400);
  }
}

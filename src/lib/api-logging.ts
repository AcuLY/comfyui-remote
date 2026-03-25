/**
 * API Request Logging Middleware
 *
 * Provides request/response logging for Next.js API routes.
 * Wraps route handlers to automatically log request details,
 * response status, and timing information.
 *
 * Usage:
 *   import { withLogging } from "@/lib/api-logging";
 *
 *   export const GET = withLogging(async (request) => {
 *     // Your handler logic
 *     return ok({ data: "..." });
 *   }, { module: "jobs" });
 *
 * Or with the wrapper HOC:
 *   export const GET = withApiLogging(handler, "jobs");
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createLogger,
  createRequestLogger,
  generateRequestId,
  logHttpRequest,
  type Logger,
} from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string | string[]> }
) => Promise<Response> | Response;

export type LoggingOptions = {
  /** Module name for log categorization */
  module?: string;
  /** Skip logging for specific status codes */
  skipStatusCodes?: number[];
  /** Whether to log request body (default: false for privacy) */
  logRequestBody?: boolean;
  /** Whether to log response body (default: false for performance) */
  logResponseBody?: boolean;
  /** Max body size to log in bytes (default: 1000) */
  maxBodyLogSize?: number;
};

// ---------------------------------------------------------------------------
// Request Context
// ---------------------------------------------------------------------------

/**
 * Extract useful context from the request
 */
function extractRequestContext(request: NextRequest): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  // User agent
  const userAgent = request.headers.get("user-agent");
  if (userAgent) {
    context.userAgent = userAgent.length > 100 ? userAgent.slice(0, 100) + "..." : userAgent;
  }

  // Client IP (check common headers)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown";
  if (ip !== "unknown") {
    context.ip = ip;
  }

  // Content type and length
  const contentType = request.headers.get("content-type");
  if (contentType) {
    context.contentType = contentType;
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    context.contentLength = parseInt(contentLength, 10);
  }

  // Query parameters (sanitized)
  const url = new URL(request.url);
  if (url.searchParams.toString()) {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      // Mask sensitive parameters
      if (key.toLowerCase().includes("token") || key.toLowerCase().includes("key")) {
        params[key] = "[REDACTED]";
      } else {
        params[key] = value.length > 50 ? value.slice(0, 50) + "..." : value;
      }
    });
    context.query = params;
  }

  return context;
}

/**
 * Safely read and truncate request body for logging
 */
async function safeReadBody(
  request: NextRequest,
  maxSize: number
): Promise<string | null> {
  try {
    const cloned = request.clone();
    const text = await cloned.text();

    if (!text) return null;

    // Try to parse and redact sensitive fields
    try {
      const json = JSON.parse(text);
      const redacted = redactSensitiveFields(json);
      const serialized = JSON.stringify(redacted);
      return serialized.length > maxSize ? serialized.slice(0, maxSize) + "..." : serialized;
    } catch {
      // Not JSON, return truncated text
      return text.length > maxSize ? text.slice(0, maxSize) + "..." : text;
    }
  } catch {
    return null;
  }
}

/**
 * Redact common sensitive fields from an object
 */
function redactSensitiveFields(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields);
  }

  const result: Record<string, unknown> = {};
  const sensitiveKeys = ["password", "token", "secret", "key", "authorization", "apikey", "api_key"];

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redactSensitiveFields(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Wrap an API handler with request logging
 */
export function withLogging(
  handler: ApiHandler,
  options: LoggingOptions = {}
): ApiHandler {
  const {
    module,
    skipStatusCodes = [],
    logRequestBody = false,
    logResponseBody = false,
    maxBodyLogSize = 1000,
  } = options;

  return async (request, context) => {
    const startTime = performance.now();
    const requestId = request.headers.get("x-request-id") ?? generateRequestId();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;

    // Create request-scoped logger
    const log = createLogger({
      context: { requestId },
      module,
    });

    // Log incoming request
    const requestContext = extractRequestContext(request);
    log.debug(`→ ${method} ${path}`, requestContext);

    // Optionally log request body
    if (logRequestBody && ["POST", "PUT", "PATCH"].includes(method)) {
      const body = await safeReadBody(request, maxBodyLogSize);
      if (body) {
        log.debug("Request body", { body });
      }
    }

    let response: Response;
    let errorMessage: string | undefined;

    try {
      // Add request ID to response headers
      response = await handler(request, context);

      // Ensure response has request ID header
      if (!response.headers.has("x-request-id")) {
        const newHeaders = new Headers(response.headers);
        newHeaders.set("x-request-id", requestId);
        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }
    } catch (error) {
      // Log unhandled errors
      const err = error instanceof Error ? error : new Error(String(error));
      errorMessage = err.message;

      log.error(`Handler error: ${err.message}`, err, { method, path });

      // Return a generic error response
      response = NextResponse.json(
        { ok: false, error: { message: "Internal server error" } },
        {
          status: 500,
          headers: { "x-request-id": requestId },
        }
      );
    }

    const duration = performance.now() - startTime;
    const status = response.status;

    // Skip logging for configured status codes
    if (!skipStatusCodes.includes(status)) {
      logHttpRequest(log, {
        method,
        path,
        status,
        duration,
        requestId,
        userAgent: requestContext.userAgent as string | undefined,
        ip: requestContext.ip as string | undefined,
        error: errorMessage,
      });
    }

    // Optionally log response body (for debugging)
    if (logResponseBody && response.body) {
      try {
        const cloned = response.clone();
        const text = await cloned.text();
        if (text) {
          const truncated = text.length > maxBodyLogSize ? text.slice(0, maxBodyLogSize) + "..." : text;
          log.debug("Response body", { body: truncated, status });
        }
      } catch {
        // Ignore body read errors
      }
    }

    return response;
  };
}

/**
 * Create a logged version of a route handler module
 *
 * @example
 * // In route.ts
 * import { createLoggedRoutes } from "@/lib/api-logging";
 *
 * async function GET(request: NextRequest) { ... }
 * async function POST(request: NextRequest) { ... }
 *
 * export const { GET: LoggedGET, POST: LoggedPOST } = createLoggedRoutes(
 *   { GET, POST },
 *   { module: "jobs" }
 * );
 * export { LoggedGET as GET, LoggedPOST as POST };
 */
export function createLoggedRoutes<T extends Record<string, ApiHandler>>(
  handlers: T,
  options: LoggingOptions = {}
): T {
  const logged = {} as T;

  for (const [method, handler] of Object.entries(handlers)) {
    (logged as Record<string, ApiHandler>)[method] = withLogging(handler, options);
  }

  return logged;
}

// ---------------------------------------------------------------------------
// Utility: Get logger from request
// ---------------------------------------------------------------------------

/**
 * Get or create a logger for the current request
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const log = getRequestLogger(request, "jobs");
 *   log.info("Fetching jobs");
 *   // ...
 * }
 */
export function getRequestLogger(request: NextRequest, module?: string): Logger {
  return createRequestLogger(request, module);
}

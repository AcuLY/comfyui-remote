/**
 * Logger Module
 *
 * A comprehensive logging system for the backend with:
 * - Multiple log levels (debug, info, warn, error)
 * - Structured logging with JSON support
 * - Context propagation (request ID, user, etc.)
 * - Performance timing utilities
 * - Optional file output with rotation
 *
 * Usage:
 *   import { logger, createLogger } from "@/lib/logger";
 *
 *   // Simple logging
 *   logger.info("Server started", { port: 3000 });
 *
 *   // With context (e.g., in API routes)
 *   const log = createLogger({ requestId: "abc123", module: "jobs" });
 *   log.info("Processing project", { projectId: "xxx" });
 *
 *   // Performance timing
 *   const timer = logger.startTimer("database-query");
 *   await db.query(...);
 *   timer.done({ rows: 100 });
 */

import { env } from "@/lib/env";
import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
};

export type LoggerOptions = {
  /** Default context to include in all log entries */
  context?: LogContext;
  /** Minimum log level to output (default: from env or "info") */
  minLevel?: LogLevel;
  /** Module name for log filtering */
  module?: string;
};

export type Timer = {
  /** End the timer and log with optional additional context */
  done: (extraContext?: LogContext) => number;
  /** Get elapsed time without logging */
  elapsed: () => number;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Environment configuration with defaults
const getLogConfig = () => ({
  level: (env.logLevel ?? "info") as LogLevel,
  format: (env.logFormat ?? "pretty") as "json" | "pretty",
  enableFile: env.logEnableFile ?? false,
  filePath: env.logFilePath ?? "logs/app.log",
  maxFileSize: env.logMaxFileSize ?? 10 * 1024 * 1024, // 10MB
  maxFiles: env.logMaxFiles ?? 5,
});

// ---------------------------------------------------------------------------
// File Writer (optional)
// ---------------------------------------------------------------------------

class FileWriter {
  private currentSize = 0;
  private stream: fs.WriteStream | null = null;
  private initialized = false;

  constructor(
    private filePath: string,
    private maxSize: number,
    private maxFiles: number
  ) {}

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const stats = fs.statSync(this.filePath);
        this.currentSize = stats.size;
      }

      this.openStream();
    } catch {
      // File logging disabled if initialization fails
      console.error(`[logger] Failed to initialize file logging: ${this.filePath}`);
    }
  }

  private openStream() {
    this.stream = fs.createWriteStream(this.filePath, { flags: "a" });
    this.stream.on("error", () => {
      this.stream = null;
    });
  }

  private rotate() {
    if (!this.stream) return;

    this.stream.end();

    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${this.filePath}.${i}`;
      const newPath = `${this.filePath}.${i + 1}`;
      if (fs.existsSync(oldPath)) {
        if (i === this.maxFiles - 1) {
          fs.unlinkSync(oldPath);
        } else {
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // Move current file to .1
    if (fs.existsSync(this.filePath)) {
      fs.renameSync(this.filePath, `${this.filePath}.1`);
    }

    this.currentSize = 0;
    this.openStream();
  }

  write(line: string) {
    this.ensureInitialized();
    if (!this.stream) return;

    const bytes = Buffer.byteLength(line, "utf8");
    if (this.currentSize + bytes > this.maxSize) {
      this.rotate();
    }

    this.stream.write(line + "\n");
    this.currentSize += bytes + 1;
  }

  close() {
    this.stream?.end();
    this.stream = null;
  }
}

// Singleton file writer (lazy initialized)
let fileWriter: FileWriter | null = null;

function getFileWriter(): FileWriter | null {
  const config = getLogConfig();
  if (!config.enableFile) return null;

  if (!fileWriter) {
    fileWriter = new FileWriter(
      config.filePath,
      config.maxFileSize,
      config.maxFiles
    );
  }
  return fileWriter;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[32m",  // Green
  warn: "\x1b[33m",  // Yellow
  error: "\x1b[31m", // Red
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

function formatPretty(entry: LogEntry): string {
  const { timestamp, level, message, context, error, duration } = entry;
  const color = LEVEL_COLORS[level];
  const levelStr = level.toUpperCase().padEnd(5);

  // Format timestamp as HH:MM:SS.mmm
  const time = timestamp.slice(11, 23);

  let output = `${DIM}${time}${RESET} ${color}${levelStr}${RESET} ${message}`;

  if (duration !== undefined) {
    output += ` ${DIM}(${duration.toFixed(2)}ms)${RESET}`;
  }

  if (context && Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${DIM}${k}=${RESET}${formatValue(v)}`)
      .join(" ");
    output += ` ${contextStr}`;
  }

  if (error) {
    output += `\n  ${BOLD}${color}${error.name}: ${error.message}${RESET}`;
    if (error.stack) {
      const stackLines = error.stack.split("\n").slice(1, 6);
      output += `\n${DIM}${stackLines.join("\n")}${RESET}`;
    }
  }

  return output;
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > 100 ? `"${value.slice(0, 97)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    return json.length > 100 ? `${json.slice(0, 97)}...` : json;
  } catch {
    return String(value);
  }
}

function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// ---------------------------------------------------------------------------
// Logger Class
// ---------------------------------------------------------------------------

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;
  private module?: string;

  constructor(options: LoggerOptions = {}) {
    this.context = options.context ?? {};
    this.minLevel = options.minLevel ?? getLogConfig().level;
    this.module = options.module;

    if (this.module) {
      this.context.module = this.module;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private write(entry: LogEntry) {
    const config = getLogConfig();
    const formatted =
      config.format === "json" ? formatJson(entry) : formatPretty(entry);

    // Console output
    if (entry.level === "error") {
      console.error(formatted);
    } else if (entry.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // File output (always JSON for parseability)
    const writer = getFileWriter();
    if (writer) {
      writer.write(formatJson(entry));
    }
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Clean up empty context
    if (entry.context && Object.keys(entry.context).length === 0) {
      delete entry.context;
    }

    this.write(entry);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const err = error instanceof Error ? error : undefined;
    const ctx = error instanceof Error ? context : (error as LogContext | undefined);
    this.log("error", message, ctx, err);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({
      context: { ...this.context, ...context },
      minLevel: this.minLevel,
      module: this.module,
    });
  }

  /**
   * Start a timer for performance measurement
   */
  startTimer(operation: string, context?: LogContext): Timer {
    const start = performance.now();
    const timerContext = { ...context, operation };

    return {
      elapsed: () => performance.now() - start,
      done: (extraContext?: LogContext) => {
        const duration = performance.now() - start;
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: "info",
          message: `${operation} completed`,
          context: { ...this.context, ...timerContext, ...extraContext },
          duration,
        };

        if (Object.keys(entry.context ?? {}).length === 0) {
          delete entry.context;
        }

        this.write(entry);
        return duration;
      },
    };
  }

  /**
   * Log and re-throw an error (useful in catch blocks)
   */
  throwError(message: string, error: Error, context?: LogContext): never {
    this.error(message, error, context);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create a new logger with specific context
 *
 * @example
 * const log = createLogger({ module: "jobs", requestId: "abc123" });
 * log.info("Processing project", { projectId: "xxx" });
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

/**
 * Create a request-scoped logger
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const log = createRequestLogger(request, "jobs");
 *   log.info("Listing jobs");
 *   // ...
 * }
 */
export function createRequestLogger(
  request: Request,
  module?: string
): Logger {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();
  const method = request.method;
  const url = new URL(request.url);
  const path = url.pathname;

  return new Logger({
    context: {
      requestId,
      method,
      path,
    },
    module,
  });
}

/**
 * Generate a short unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Default Logger Instance
// ---------------------------------------------------------------------------

/**
 * Default logger instance for general use
 *
 * @example
 * import { logger } from "@/lib/logger";
 * logger.info("Application started");
 */
export const logger = new Logger();

// ---------------------------------------------------------------------------
// Utility: Wrap async functions with automatic error logging
// ---------------------------------------------------------------------------

/**
 * Wrap an async function with automatic error logging
 *
 * @example
 * const safeHandler = withErrorLogging(
 *   async () => { ... },
 *   createLogger({ module: "worker" }),
 *   "process-job"
 * );
 */
export function withErrorLogging<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  log: Logger,
  operation: string
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (error) {
      log.error(`${operation} failed`, error);
      throw error;
    }
  };
}

// ---------------------------------------------------------------------------
// Utility: Log HTTP response details
// ---------------------------------------------------------------------------

export type HttpLogContext = {
  method: string;
  path: string;
  status: number;
  duration: number;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  error?: string;
};

/**
 * Log HTTP request completion
 */
export function logHttpRequest(log: Logger, ctx: HttpLogContext) {
  const level: LogLevel = ctx.status >= 500 ? "error" : ctx.status >= 400 ? "warn" : "info";
  const message = `${ctx.method} ${ctx.path} ${ctx.status}`;

  const context: LogContext = {
    status: ctx.status,
    duration: Math.round(ctx.duration),
  };

  if (ctx.requestId) context.requestId = ctx.requestId;
  if (ctx.userAgent) context.userAgent = ctx.userAgent;
  if (ctx.ip) context.ip = ctx.ip;
  if (ctx.error) context.error = ctx.error;

  if (level === "error") {
    log.error(message, undefined, context);
  } else if (level === "warn") {
    log.warn(message, context);
  } else {
    log.info(message, context);
  }
}

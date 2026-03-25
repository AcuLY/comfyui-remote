/**
 * Logs API Endpoint
 *
 * GET /api/logs - Retrieve recent application logs
 *
 * Query parameters:
 * - lines: Number of log lines to return (default: 100, max: 1000)
 * - level: Filter by minimum log level (debug|info|warn|error)
 * - module: Filter by module name
 * - since: Return logs after this ISO timestamp
 *
 * Note: This endpoint requires file logging to be enabled (LOG_ENABLE_FILE=true)
 * and only works when logs are written to files.
 */

import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { env } from "@/lib/env";
import { createRequestLogger, type LogLevel } from "@/lib/logger";
import * as fs from "node:fs";
import * as readline from "node:readline";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
};

type ParsedLogEntry = LogEntry & {
  raw?: string;
};

const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
const MAX_LINES = 1000;
const DEFAULT_LINES = 100;

function parseLogLine(line: string): ParsedLogEntry | null {
  if (!line.trim()) return null;

  try {
    const parsed = JSON.parse(line) as LogEntry;
    if (parsed.timestamp && parsed.level && parsed.message) {
      return parsed;
    }
    return null;
  } catch {
    // Not valid JSON, return as raw text
    return {
      timestamp: new Date().toISOString(),
      level: "info",
      message: line,
      raw: line,
    };
  }
}

function matchesFilters(
  entry: ParsedLogEntry,
  minLevel?: LogLevel,
  module?: string,
  since?: Date
): boolean {
  // Level filter
  if (minLevel) {
    const entryLevelIndex = LOG_LEVELS.indexOf(entry.level);
    const minLevelIndex = LOG_LEVELS.indexOf(minLevel);
    if (entryLevelIndex < minLevelIndex) {
      return false;
    }
  }

  // Module filter
  if (module && entry.context?.module !== module) {
    return false;
  }

  // Since filter
  if (since) {
    const entryTime = new Date(entry.timestamp);
    if (entryTime < since) {
      return false;
    }
  }

  return true;
}

async function readLogFile(
  filePath: string,
  options: {
    lines: number;
    minLevel?: LogLevel;
    module?: string;
    since?: Date;
  }
): Promise<ParsedLogEntry[]> {
  const { lines, minLevel, module, since } = options;

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  // Collect all lines first, then filter and take last N
  const allEntries: ParsedLogEntry[] = [];

  for await (const line of rl) {
    const entry = parseLogLine(line);
    if (entry && matchesFilters(entry, minLevel, module, since)) {
      allEntries.push(entry);
    }
  }

  // Take last N entries
  const startIndex = Math.max(0, allEntries.length - lines);
  return allEntries.slice(startIndex);
}

function getLogFilePaths(): string[] {
  const basePath = env.logFilePath;
  const paths: string[] = [];

  // Current log file
  if (fs.existsSync(basePath)) {
    paths.push(basePath);
  }

  // Rotated files (newest first)
  for (let i = 1; i <= env.logMaxFiles; i++) {
    const rotatedPath = `${basePath}.${i}`;
    if (fs.existsSync(rotatedPath)) {
      paths.push(rotatedPath);
    }
  }

  return paths;
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request, "logs-api");

  // Parse query parameters
  const url = new URL(request.url);
  const linesParam = url.searchParams.get("lines");
  const levelParam = url.searchParams.get("level");
  const moduleParam = url.searchParams.get("module");
  const sinceParam = url.searchParams.get("since");

  // Validate lines
  let lines = DEFAULT_LINES;
  if (linesParam) {
    const parsed = parseInt(linesParam, 10);
    if (isNaN(parsed) || parsed < 1) {
      return fail("lines must be a positive integer", 400);
    }
    lines = Math.min(parsed, MAX_LINES);
  }

  // Validate level
  let minLevel: LogLevel | undefined;
  if (levelParam) {
    const normalized = levelParam.toLowerCase() as LogLevel;
    if (!LOG_LEVELS.includes(normalized)) {
      return fail(`level must be one of: ${LOG_LEVELS.join(", ")}`, 400);
    }
    minLevel = normalized;
  }

  // Validate since
  let since: Date | undefined;
  if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (isNaN(parsed.getTime())) {
      return fail("since must be a valid ISO timestamp", 400);
    }
    since = parsed;
  }

  // Check if file logging is enabled
  if (!env.logEnableFile) {
    log.debug("Log file access attempted but file logging is disabled");
    return ok({
      enabled: false,
      message: "File logging is not enabled. Set LOG_ENABLE_FILE=true to enable.",
      entries: [],
      config: {
        logLevel: env.logLevel,
        logFormat: env.logFormat,
        logEnableFile: env.logEnableFile,
      },
    });
  }

  try {
    const logFiles = getLogFilePaths();

    if (logFiles.length === 0) {
      return ok({
        enabled: true,
        message: "No log files found yet",
        entries: [],
        files: [],
      });
    }

    // Read from the current log file
    const entries = await readLogFile(logFiles[0], {
      lines,
      minLevel,
      module: moduleParam ?? undefined,
      since,
    });

    log.debug("Logs retrieved", { count: entries.length, files: logFiles.length });

    return ok({
      enabled: true,
      entries,
      files: logFiles,
      filters: {
        lines,
        level: minLevel,
        module: moduleParam,
        since: sinceParam,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Failed to read log files", error);
    return fail(`Failed to read logs: ${message}`, 500);
  }
}

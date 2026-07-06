import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

export type BetterSqliteDatabase = Database.Database;
export type BetterSqliteOptions = Database.Options;

export interface BetterSqliteTestDatabase {
  tempDir: string;
  dbPath: string;
  databaseUrl: string;
  cleanup: () => Promise<void>;
  setup: (sql: string) => void;
  open: (options?: BetterSqliteOptions) => BetterSqliteDatabase;
}

export function createBetterSqliteTestDatabase(
  prefix: string,
  fileName = "test.db",
): BetterSqliteTestDatabase {
  const tempDir = mkdtempSync(path.join(tmpdir(), prefix));
  const dbPath = path.join(tempDir, fileName);

  return {
    tempDir,
    dbPath,
    databaseUrl: `file:${dbPath}`,
    cleanup: () => rm(tempDir, { recursive: true, force: true }),
    setup: (sql) => {
      withBetterSqliteDatabase(dbPath, (db) => {
        db.exec(sql);
      });
    },
    open: (options) => new Database(dbPath, options),
  };
}

export function withBetterSqliteDatabase<T>(
  dbPath: string,
  callback: (db: BetterSqliteDatabase) => T,
): T;
export function withBetterSqliteDatabase<T>(
  dbPath: string,
  options: BetterSqliteOptions,
  callback: (db: BetterSqliteDatabase) => T,
): T;
export function withBetterSqliteDatabase<T>(
  dbPath: string,
  optionsOrCallback: BetterSqliteOptions | ((db: BetterSqliteDatabase) => T),
  callback?: (db: BetterSqliteDatabase) => T,
): T {
  const options = typeof optionsOrCallback === "function" ? undefined : optionsOrCallback;
  const run = typeof optionsOrCallback === "function" ? optionsOrCallback : callback;
  if (!run) throw new Error("Missing better-sqlite3 callback");

  const db = new Database(dbPath, options);
  try {
    return run(db);
  } finally {
    db.close();
  }
}

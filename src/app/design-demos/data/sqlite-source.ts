import fs from "node:fs";
import path from "node:path";

export function resolveSqlitePath() {
  const rawUrl = process.env.DATABASE_URL?.trim() ?? "";
  const candidates: string[] = [];

  if (rawUrl.startsWith("file:")) {
    const rawPath = rawUrl.slice("file:".length);
    const normalized = rawPath.replace(/^\/([A-Za-z]:)/, "$1");
    if (path.isAbsolute(normalized)) {
      candidates.push(normalized);
    } else {
      candidates.push(path.resolve(/* turbopackIgnore: true */ process.cwd(), normalized));
      candidates.push(path.resolve(/* turbopackIgnore: true */ process.cwd(), "prisma", normalized));
    }
  }

  candidates.push(path.resolve(/* turbopackIgnore: true */ process.cwd(), "prisma", "data", "comfyui.db"));

  const found = candidates.find((candidate) => {
    try {
      return fs.existsSync(/* turbopackIgnore: true */ candidate);
    } catch {
      return false;
    }
  });

  return {
    path: found ?? null,
    label: found ? path.basename(found) : rawUrl ? "DATABASE_URL 非本地 SQLite" : "未配置 DATABASE_URL",
  };
}

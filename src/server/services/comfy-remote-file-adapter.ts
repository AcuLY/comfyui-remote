import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import type { ModelKind } from "@/lib/model-constants";
import type { SshComfyTarget } from "@/server/services/comfy-target";
import { quotePosixShellArg, runSshCommand } from "@/server/services/comfy-ssh";
import type { ModelBrowseItem } from "@/server/services/model-asset-service";

const MODEL_EXTENSIONS: Record<ModelKind, Set<string>> = {
  lora: new Set([".safetensors", ".ckpt", ".pt", ".pth"]),
  checkpoint: new Set([".safetensors"]),
};

type MoveInput = {
  sourcePath: string;
  targetDir: string;
};

function modelKindDir(kind: ModelKind) {
  return kind === "lora" ? "loras" : "checkpoints";
}

function normalizeRemoteRoot(root: string) {
  return root.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function normalizeRemoteRelativePath(value: string) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized) return "";
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid remote model path: ${value}`);
  }
  return parts.join("/");
}

export function resolveRemoteModelPath(
  remoteModelsRoot: string,
  kind: ModelKind,
  relativePath: string,
) {
  const root = normalizeRemoteRoot(remoteModelsRoot);
  const kindRoot = `${root}/${modelKindDir(kind)}`;
  const normalizedRelativePath = normalizeRemoteRelativePath(relativePath);
  return normalizedRelativePath ? `${kindRoot}/${normalizedRelativePath}` : kindRoot;
}

function buildScpArgs(target: SshComfyTarget, localPath: string, remotePath: string) {
  const args: string[] = [];
  if (target.sshPort !== 22) {
    args.push("-P", String(target.sshPort));
  }
  if (target.sshKeyPath) {
    args.push("-i", target.sshKeyPath);
  }
  args.push(localPath, `${target.sshHost}:${quotePosixShellArg(remotePath)}`);
  return args;
}

function isAllowedModelFile(kind: ModelKind, fileName: string) {
  return MODEL_EXTENSIONS[kind].has(path.posix.extname(fileName).toLowerCase());
}

export function buildRemoteModelListCommand(
  remoteModelsRoot: string,
  kind: ModelKind,
  relativePath: string,
  recursive: boolean,
) {
  const remoteDir = resolveRemoteModelPath(remoteModelsRoot, kind, relativePath);
  const depth = recursive ? "" : " -maxdepth 1";
  return `find ${quotePosixShellArg(remoteDir)} -mindepth 1${depth} -printf '%y\\t%P\\t%s\\n'`;
}

export function parseRemoteModelListOutput(output: string, kind: ModelKind): ModelBrowseItem[] {
  const items: ModelBrowseItem[] = [];

  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const [rawType, rawPath, rawSize] = trimmed.split("\t");
    const relativePath = normalizeRemoteRelativePath(rawPath ?? "");
    if (!relativePath) continue;

    const name = path.posix.basename(relativePath);
    if (rawType === "d" || rawType === "directory") {
      items.push({ type: "directory", name, path: relativePath });
      continue;
    }

    if ((rawType === "f" || rawType === "file") && isAllowedModelFile(kind, name)) {
      const size = Number(rawSize);
      items.push({
        type: "file",
        name,
        path: relativePath,
        size: Number.isFinite(size) ? size : undefined,
      });
    }
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

export function buildRemoteHashCommand(
  remoteModelsRoot: string,
  kind: ModelKind,
  relativePath: string,
  template = "sha256sum {path}",
) {
  const remotePath = resolveRemoteModelPath(remoteModelsRoot, kind, relativePath);
  return template.replaceAll("{path}", quotePosixShellArg(remotePath));
}

export function buildRemoteMoveCommand(
  remoteModelsRoot: string,
  kind: ModelKind,
  input: MoveInput,
) {
  const sourcePath = resolveRemoteModelPath(remoteModelsRoot, kind, input.sourcePath);
  const targetDir = resolveRemoteModelPath(remoteModelsRoot, kind, input.targetDir);
  const targetPath = `${targetDir}/${path.posix.basename(sourcePath)}`;
  return `mkdir -p ${quotePosixShellArg(targetDir)} && mv -- ${quotePosixShellArg(sourcePath)} ${quotePosixShellArg(targetPath)}`;
}

export async function browseRemoteModelDirectory(
  target: SshComfyTarget,
  kind: ModelKind,
  relativePath: string,
  recursive: boolean,
) {
  const command = buildRemoteModelListCommand(target.remoteModelsRoot, kind, relativePath, recursive);
  const result = await runSshCommand(target, command);
  const currentPath = normalizeRemoteRelativePath(relativePath);
  const parentPath = currentPath
    ? path.posix.dirname(currentPath) === "."
      ? ""
      : path.posix.dirname(currentPath)
    : null;
  return {
    currentPath,
    parentPath,
    items: parseRemoteModelListOutput(result.stdout, kind),
  };
}

export async function hashRemoteModelFile(
  target: SshComfyTarget,
  kind: ModelKind,
  relativePath: string,
) {
  const command = buildRemoteHashCommand(
    target.remoteModelsRoot,
    kind,
    relativePath,
    target.hashCommandTemplate ?? "sha256sum {path}",
  );
  const result = await runSshCommand(target, command);
  const [sha256] = result.stdout.trim().split(/\s+/);
  if (!/^[a-fA-F0-9]{64}$/.test(sha256 ?? "")) {
    throw new Error(`Remote hash command did not return a SHA-256 hash for ${relativePath}`);
  }
  const remotePath = resolveRemoteModelPath(target.remoteModelsRoot, kind, relativePath);
  return {
    name: path.posix.basename(relativePath),
    path: normalizeRemoteRelativePath(relativePath),
    absolutePath: remotePath,
    size: 0,
    sha256: sha256.toLowerCase(),
  };
}

export async function moveRemoteModelFile(
  target: SshComfyTarget,
  kind: ModelKind,
  input: MoveInput,
) {
  await runSshCommand(target, buildRemoteMoveCommand(target.remoteModelsRoot, kind, input));
  const relativePath = normalizeRemoteRelativePath(`${input.targetDir}/${path.posix.basename(input.sourcePath)}`);
  return {
    name: path.posix.basename(relativePath),
    path: relativePath,
  };
}

export async function uploadRemoteModelFile(
  target: SshComfyTarget,
  kind: ModelKind,
  file: File,
  targetDir: string,
) {
  const safeName = file.name.replace(/[\\/:*?"<>|]/g, "_");
  if (!isAllowedModelFile(kind, safeName)) {
    throw new Error(`Unsupported remote model file extension: ${safeName}`);
  }

  const normalizedTargetDir = normalizeRemoteRelativePath(targetDir || "");
  const remoteDir = resolveRemoteModelPath(target.remoteModelsRoot, kind, normalizedTargetDir);
  const remotePath = `${remoteDir}/${safeName}`;
  const tempPath = path.join(os.tmpdir(), `comfy-model-upload-${randomUUID()}-${safeName}`);

  try {
    const writeStream = createWriteStream(tempPath);
    const uploadStream = file.stream() as unknown as NodeReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(uploadStream), writeStream);
    await runSshCommand(target, `mkdir -p ${quotePosixShellArg(remoteDir)}`);
    await new Promise<void>((resolve, reject) => {
      const child = spawn("scp", buildScpArgs(target, tempPath, remotePath), {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
      });
      const stderr: Buffer[] = [];
      child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`scp failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8")}`));
        }
      });
    });
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }

  const relativePath = normalizedTargetDir ? `${normalizedTargetDir}/${safeName}` : safeName;
  return {
    name: safeName,
    category: normalizedTargetDir || ".",
    fileName: safeName,
    absolutePath: remotePath,
    relativePath,
    size: BigInt(file.size),
  };
}

import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

import type { SshComfyTarget } from "@/server/services/comfy-target";
import { getActiveComfyTarget } from "@/server/services/comfy-target";

type CommandResult = {
  stdout: string;
  stderr: string;
};

const tunnelProcesses = new Map<string, ChildProcess>();

export function quotePosixShellArg(value: string) {
  if (value.length === 0) return "''";
  return `'${value.replace(/'/g, "'\"'\"'")}'`;
}

function buildSshBaseArgs(target: SshComfyTarget) {
  const args: string[] = [];
  if (target.sshPort !== 22) {
    args.push("-p", String(target.sshPort));
  }
  if (target.sshKeyPath) {
    args.push("-i", target.sshKeyPath);
  }
  args.push(target.sshHost);
  return args;
}

function getLocalTunnelEndpoint(target: SshComfyTarget) {
  const parsed = new URL(target.localApiUrl);
  const hostname = parsed.hostname || "127.0.0.1";
  const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid local tunnel port in ${target.localApiUrl}`);
  }
  return { hostname, port };
}

export function buildSshArgs(target: SshComfyTarget, remoteCommand: string) {
  return [...buildSshBaseArgs(target), remoteCommand];
}

export function buildSshTunnelArgs(target: SshComfyTarget) {
  const local = getLocalTunnelEndpoint(target);
  return [
    "-N",
    "-L",
    `${local.hostname}:${local.port}:${target.remoteApiHost}:${target.remoteApiPort}`,
    ...buildSshBaseArgs(target),
  ];
}

function isPortListening(hostname: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
    const done = (listening: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function waitForSshTunnelPort(
  probe: () => Promise<boolean>,
  options: {
    intervalMs?: number;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
  } = {},
) {
  const intervalMs = options.intervalMs ?? 250;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + (options.timeoutMs ?? 5_000);

  while (true) {
    if (await probe()) return true;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) return false;
    await sleep(Math.min(intervalMs, remainingMs));
  }
}

export async function runSshCommand(
  target: SshComfyTarget,
  remoteCommand: string,
  options: { timeoutMs?: number } = {},
): Promise<CommandResult> {
  const args = buildSshArgs(target, remoteCommand);
  const timeoutMs = options.timeoutMs ?? 60_000;

  return await new Promise((resolve, reject) => {
    const child = spawn("ssh", args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`SSH command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === 0) {
        resolve(result);
      } else {
        reject(new Error(`SSH command failed with exit code ${code}: ${result.stderr || result.stdout}`));
      }
    });
  });
}

export async function ensureSshTunnel(target: SshComfyTarget) {
  if (!target.tunnelAutoStart) return;

  const local = getLocalTunnelEndpoint(target);
  if (await isPortListening(local.hostname, local.port)) {
    return;
  }

  const existing = tunnelProcesses.get(target.id);
  if (existing && existing.exitCode === null && !existing.killed) {
    return;
  }

  const child = spawn("ssh", buildSshTunnelArgs(target), {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  tunnelProcesses.set(target.id, child);

  const ready = await waitForSshTunnelPort(
    () => isPortListening(local.hostname, local.port),
  );
  if (!ready) {
    throw new Error(`SSH tunnel did not start listening on ${local.hostname}:${local.port}`);
  }
}

export async function ensureActiveComfySshTunnel(apiUrl?: string) {
  const target = getActiveComfyTarget();
  if (target.mode !== "ssh") return;
  if (apiUrl && target.apiUrl !== apiUrl.trim().replace(/\/+$/, "")) return;
  await ensureSshTunnel(target);
}

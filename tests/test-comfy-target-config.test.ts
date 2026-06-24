import assert from "node:assert/strict";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSshArgs,
  buildSshTunnelArgs,
  quotePosixShellArg,
  waitForSshTunnelPort,
} from "../src/server/services/comfy-ssh";
import {
  loadComfyTargetConfig,
  resolveComfyTargetFromConfig,
  type ComfyTargetConfigFile,
} from "../src/server/services/comfy-target";

test("comfy target config resolves the active SSH target to a local tunnel API URL", () => {
  const config: ComfyTargetConfigFile = {
    active: "remote-a",
    targets: {
      "remote-a": {
        mode: "ssh",
        sshHost: "artist@example.com",
        sshPort: 2222,
        sshKeyPath: "C:/Users/me/.ssh/id_ed25519",
        localApiUrl: "http://127.0.0.1:18188",
        remoteApiHost: "127.0.0.1",
        remoteApiPort: 8188,
        remoteComfyRoot: "/srv/Comfy UI",
        remoteModelsRoot: "/srv/Comfy UI/models",
        startCommand: "systemctl --user start comfyui",
        stopCommand: "systemctl --user stop comfyui",
        restartCommand: "systemctl --user restart comfyui",
        logCommand: "journalctl --user -u comfyui -n 200 --no-pager",
        hashCommandTemplate: "sha256sum {path}",
      },
    },
  };

  const target = resolveComfyTargetFromConfig(config, {
    activeTargetId: "remote-a",
    fallbackApiUrl: "http://127.0.0.1:8188",
    fallbackModelBaseDir: "D:/ComfyUI/models",
  });

  assert.equal(target.id, "remote-a");
  assert.equal(target.mode, "ssh");
  assert.equal(target.apiUrl, "http://127.0.0.1:18188");
  assert.equal(target.remoteApiHost, "127.0.0.1");
  assert.equal(target.remoteApiPort, 8188);
  assert.equal(target.remoteComfyRoot, "/srv/Comfy UI");
  assert.equal(target.remoteModelsRoot, "/srv/Comfy UI/models");
  assert.equal(target.tunnelAutoStart, true);
});

test("comfy target config falls back to local .env style settings without a config file", () => {
  const target = resolveComfyTargetFromConfig(null, {
    activeTargetId: null,
    fallbackApiUrl: "http://127.0.0.1:8188/",
    fallbackModelBaseDir: "D:/ComfyUI/models",
    fallbackLaunchCmd: "python main.py",
    fallbackLaunchCwd: "D:/ComfyUI",
  });

  assert.equal(target.id, "local");
  assert.equal(target.mode, "local");
  assert.equal(target.apiUrl, "http://127.0.0.1:8188");
  assert.equal(target.modelBaseDir, "D:/ComfyUI/models");
  assert.equal(target.comfyLaunchCmd, "python main.py");
  assert.equal(target.comfyLaunchCwd, "D:/ComfyUI");
});

test("comfy target config loads UTF-8 BOM JSON files written by Windows tools", async () => {
  const dir = await mkdtemp(join(tmpdir(), "comfy-target-config-bom-"));
  const configPath = join(dir, "targets.json");
  await writeFile(
    configPath,
    `\uFEFF${JSON.stringify({
      active: "local",
      targets: {
        local: {
          mode: "local",
          apiUrl: "http://127.0.0.1:8188",
        },
      },
    })}`,
    "utf8",
  );

  const config = loadComfyTargetConfig(configPath);

  assert.equal(config?.active, "local");
});

test("SSH command builders use argv arrays and preserve spaces through shell quoting", () => {
  const target = resolveComfyTargetFromConfig({
    active: "remote-a",
    targets: {
      "remote-a": {
        mode: "ssh",
        sshHost: "artist@example.com",
        sshPort: 2222,
        sshKeyPath: "C:/Users/me/.ssh/id_ed25519",
        localApiUrl: "http://127.0.0.1:18188",
        remoteApiHost: "127.0.0.1",
        remoteApiPort: 8188,
        remoteComfyRoot: "/srv/Comfy UI",
        remoteModelsRoot: "/srv/Comfy UI/models",
      },
    },
  }, {
    activeTargetId: "remote-a",
    fallbackApiUrl: "http://127.0.0.1:8188",
    fallbackModelBaseDir: "",
  });

  assert.equal(target.mode, "ssh");
  if (target.mode !== "ssh") return;

  assert.equal(quotePosixShellArg("/srv/Comfy UI/models/a'b.safetensors"), "'/srv/Comfy UI/models/a'\"'\"'b.safetensors'");
  assert.deepEqual(buildSshArgs(target, "systemctl --user restart comfyui"), [
    "-p",
    "2222",
    "-i",
    "C:/Users/me/.ssh/id_ed25519",
    "artist@example.com",
    "systemctl --user restart comfyui",
  ]);
  assert.deepEqual(buildSshTunnelArgs(target), [
    "-N",
    "-T",
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    "-o",
    "TCPKeepAlive=yes",
    "-L",
    "127.0.0.1:18188:127.0.0.1:8188",
    "-p",
    "2222",
    "-i",
    "C:/Users/me/.ssh/id_ed25519",
    "artist@example.com",
  ]);
});

test("SSH tunnel readiness waits until the forwarded local port is listening", async () => {
  let attempts = 0;
  const sleeps: number[] = [];

  const ready = await waitForSshTunnelPort(
    async () => {
      attempts += 1;
      return attempts === 3;
    },
    {
      intervalMs: 10,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      timeoutMs: 1_000,
    },
  );

  assert.equal(ready, true);
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [10, 10]);
});

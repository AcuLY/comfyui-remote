import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSshArgs,
  buildSshTunnelArgs,
  quotePosixShellArg,
} from "../src/server/services/comfy-ssh";
import {
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
    "-L",
    "127.0.0.1:18188:127.0.0.1:8188",
    "-p",
    "2222",
    "-i",
    "C:/Users/me/.ssh/id_ed25519",
    "artist@example.com",
  ]);
});

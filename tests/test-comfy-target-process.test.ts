import assert from "node:assert/strict";
import test from "node:test";

import { resolveComfyTargetFromConfig } from "../src/server/services/comfy-target";
import { runComfyTargetProcessAction } from "../src/server/services/comfy-target-process";

function sshTarget(commands: Partial<Record<"startCommand" | "stopCommand" | "restartCommand", string>> = {}) {
  const target = resolveComfyTargetFromConfig({
    active: "remote-a",
    targets: {
      "remote-a": {
        mode: "ssh",
        sshHost: "artist@example.com",
        localApiUrl: "http://127.0.0.1:18188",
        remoteApiHost: "127.0.0.1",
        remoteApiPort: 8188,
        remoteComfyRoot: "/srv/ComfyUI",
        remoteModelsRoot: "/srv/ComfyUI/models",
        ...commands,
      },
    },
  }, {
    activeTargetId: "remote-a",
    fallbackApiUrl: "http://127.0.0.1:8188",
    fallbackModelBaseDir: "",
  });
  assert.equal(target.mode, "ssh");
  return target;
}

test("SSH process actions execute configured remote commands", async () => {
  const calls: string[] = [];
  const target = sshTarget({
    startCommand: "systemctl --user start comfyui",
    stopCommand: "systemctl --user stop comfyui",
    restartCommand: "systemctl --user restart comfyui",
  });

  const restart = await runComfyTargetProcessAction(target, "restart", async (_target, command) => {
    calls.push(command);
    return { stdout: "ok\n", stderr: "" };
  });

  assert.deepEqual(calls, ["systemctl --user restart comfyui"]);
  assert.deepEqual(restart, { ok: true, message: "Remote ComfyUI restart command completed" });
});

test("SSH process actions fail closed when a command is not configured", async () => {
  const result = await runComfyTargetProcessAction(sshTarget(), "stop", async () => {
    throw new Error("must not run");
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /stopCommand is not configured/);
});

test("local process actions are reported as not handled by the SSH target adapter", async () => {
  const target = resolveComfyTargetFromConfig(null, {
    activeTargetId: null,
    fallbackApiUrl: "http://127.0.0.1:8188",
    fallbackModelBaseDir: "",
  });

  const result = await runComfyTargetProcessAction(target, "start", async () => {
    throw new Error("must not run");
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /only handles SSH/);
});

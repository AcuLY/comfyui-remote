import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

async function withRemoteTargetConfig(run: () => Promise<void>) {
  const previousConfigPath = process.env.COMFY_TARGET_CONFIG_PATH;
  const previousActiveTarget = process.env.COMFY_ACTIVE_TARGET;
  const configDir = await mkdtemp(join(tmpdir(), "comfy-target-config-"));
  const configPath = join(configDir, "targets.json");
  await writeFile(configPath, JSON.stringify({
    active: "remote-a",
    targets: {
      "remote-a": {
        mode: "ssh",
        sshHost: "comfy.example.com",
        localApiUrl: "http://127.0.0.1:18188",
        remoteComfyRoot: "/srv/ComfyUI",
        remoteModelsRoot: "/srv/ComfyUI/models",
      },
    },
  }));

  process.env.COMFY_TARGET_CONFIG_PATH = configPath;
  process.env.COMFY_ACTIVE_TARGET = "remote-a";
  try {
    await run();
  } finally {
    if (previousConfigPath === undefined) {
      delete process.env.COMFY_TARGET_CONFIG_PATH;
    } else {
      process.env.COMFY_TARGET_CONFIG_PATH = previousConfigPath;
    }
    if (previousActiveTarget === undefined) {
      delete process.env.COMFY_ACTIVE_TARGET;
    } else {
      process.env.COMFY_ACTIVE_TARGET = previousActiveTarget;
    }
  }
}

test("remote model notes reject traversal paths before database writes", async () => {
  const { updateModelNotes } = await import("../src/server/services/model-asset-service");

  await withRemoteTargetConfig(async () => {
    await assert.rejects(
      () => updateModelNotes("lora", { path: "../outside.safetensors", notes: "bad" }),
      (error) =>
        error instanceof Error &&
        error.name === "ModelAssetError" &&
        error.message === "Invalid path" &&
        "status" in error &&
        error.status === 400,
    );
  });
});

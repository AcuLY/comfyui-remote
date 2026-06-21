import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ComfyTarget, SshComfyTarget } from "../src/server/services/comfy-target";
import { cleanupComfyOutputSubfoldersForTarget } from "../src/server/services/comfy-output-cleanup";

function localTarget(comfyLaunchCwd: string): ComfyTarget {
  return {
    id: "local",
    mode: "local",
    apiUrl: "http://127.0.0.1:8188",
    modelBaseDir: "",
    loraBaseDir: "",
    checkpointBaseDir: "",
    comfyLaunchCmd: "",
    comfyLaunchCwd,
  };
}

function sshTarget(): SshComfyTarget {
  return {
    id: "remote-a",
    mode: "ssh",
    apiUrl: "http://127.0.0.1:18188",
    localApiUrl: "http://127.0.0.1:18188",
    sshHost: "comfy-remote",
    sshPort: 22,
    sshKeyPath: null,
    remoteApiHost: "127.0.0.1",
    remoteApiPort: 8188,
    remoteComfyRoot: "/srv/ComfyUI",
    remoteModelsRoot: "/srv/ComfyUI/models",
    startCommand: null,
    stopCommand: null,
    restartCommand: null,
    logCommand: null,
    hashCommandTemplate: null,
    tunnelAutoStart: true,
  };
}

test("active target cleanup preserves local ComfyUI output safety checks", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "comfy-output-cleanup-"));
  const outputDir = join(cwd, "output");
  const safeDir = join(outputDir, "Project A");
  const outsideDir = join(cwd, "outside");
  await mkdir(safeDir, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
  await writeFile(join(safeDir, "image.png"), "png");
  await writeFile(join(outsideDir, "keep.txt"), "keep");

  const deleted = await cleanupComfyOutputSubfoldersForTarget(localTarget(cwd), [
    "Project A/run-1",
    "Project A/run-2",
    "../outside",
    "",
  ]);

  assert.equal(deleted, 1);
  await assert.rejects(access(safeDir));
  await access(outsideDir);
});

test("active target cleanup delegates SSH output deletion to the remote adapter", async () => {
  const calls: Array<Array<string | null>> = [];

  const deleted = await cleanupComfyOutputSubfoldersForTarget(
    sshTarget(),
    ["Project A/run-1", "Project B/run-2"],
    {
      cleanupRemote: async (_target, subfolders) => {
        calls.push(subfolders);
        return 2;
      },
    },
  );

  assert.equal(deleted, 2);
  assert.deepEqual(calls, [["Project A/run-1", "Project B/run-2"]]);
});

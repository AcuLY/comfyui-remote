import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRemoteHashCommand,
  buildRemoteModelListCommand,
  buildRemoteMoveCommand,
  parseRemoteModelListOutput,
  resolveRemoteModelPath,
} from "../src/server/services/comfy-remote-file-adapter";

test("remote model path resolution rejects traversal and stays under kind roots", () => {
  assert.equal(
    resolveRemoteModelPath("/srv/ComfyUI/models", "lora", "characters/a.safetensors"),
    "/srv/ComfyUI/models/loras/characters/a.safetensors",
  );
  assert.equal(
    resolveRemoteModelPath("/srv/ComfyUI/models", "checkpoint", "sdxl/base.safetensors"),
    "/srv/ComfyUI/models/checkpoints/sdxl/base.safetensors",
  );
  assert.throws(
    () => resolveRemoteModelPath("/srv/ComfyUI/models", "lora", "../checkpoints/base.safetensors"),
    /Invalid remote model path/,
  );
});

test("remote model list commands and parser expose directories before model files", () => {
  const command = buildRemoteModelListCommand("/srv/Comfy UI/models", "lora", "characters", false);
  assert.match(command, /find '\/srv\/Comfy UI\/models\/loras\/characters'/);
  assert.match(command, /-maxdepth 1/);

  const items = parseRemoteModelListOutput(
    [
      "directory\tcharacters\t0",
      "file\tcharacters/a.safetensors\t123",
      "file\tcharacters/readme.txt\t10",
      "file\tcharacters/b.ckpt\t456",
    ].join("\n"),
    "lora",
  );

  assert.deepEqual(items, [
    { type: "directory", name: "characters", path: "characters" },
    { type: "file", name: "a.safetensors", path: "characters/a.safetensors", size: 123 },
    { type: "file", name: "b.ckpt", path: "characters/b.ckpt", size: 456 },
  ]);
});

test("remote hash and move commands quote paths and use configured hash templates", () => {
  assert.equal(
    buildRemoteHashCommand(
      "/srv/Comfy UI/models",
      "checkpoint",
      "sdxl/base model.safetensors",
      "sha256sum {path}",
    ),
    "sha256sum '/srv/Comfy UI/models/checkpoints/sdxl/base model.safetensors'",
  );

  const move = buildRemoteMoveCommand(
    "/srv/Comfy UI/models",
    "lora",
    {
      sourcePath: "characters/a.safetensors",
      targetDir: "characters/archive",
    },
  );

  assert.match(move, /mkdir -p '\/srv\/Comfy UI\/models\/loras\/characters\/archive'/);
  assert.match(move, /mv -- '\/srv\/Comfy UI\/models\/loras\/characters\/a.safetensors' '\/srv\/Comfy UI\/models\/loras\/characters\/archive\/a.safetensors'/);
});

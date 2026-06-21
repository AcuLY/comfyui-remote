import assert from "node:assert/strict";
import test from "node:test";

import { buildRemoteOutputCleanupCommand } from "../src/server/services/comfy-remote-output-cleanup";

test("remote output cleanup deletes only top-level ComfyUI output folders", () => {
  const command = buildRemoteOutputCleanupCommand("/srv/Comfy UI", [
    "Project A/1.section",
    "Project B",
    "",
    "../outside",
    "Project A/2.other",
  ]);

  assert.equal(
    command,
    "rm -rf -- '/srv/Comfy UI/output/Project A' '/srv/Comfy UI/output/Project B'",
  );
});

test("remote output cleanup returns null when no safe folders remain", () => {
  assert.equal(buildRemoteOutputCleanupCommand("/srv/ComfyUI", ["", "../outside", "./bad"]), null);
});

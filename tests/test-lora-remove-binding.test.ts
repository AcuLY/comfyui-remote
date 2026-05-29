import test from "node:test";
import assert from "node:assert/strict";
import { removeLoraEntriesByBinding } from "../src/lib/lora-types";

test("removeLoraEntriesByBinding removes only entries matching the binding in both slots", () => {
  const input = {
    lora1: [
      { id: "a", path: "a.safetensors", weight: 1, enabled: true, source: "preset" as const, bindingId: "remove-me" },
      { id: "b", path: "b.safetensors", weight: 1, enabled: true, source: "manual" as const },
    ],
    lora2: [
      { id: "c", path: "c.safetensors", weight: 1, enabled: true, source: "preset" as const, bindingId: "remove-me" },
      { id: "d", path: "d.safetensors", weight: 1, enabled: true, source: "preset" as const, bindingId: "keep-me" },
    ],
  };

  const result = removeLoraEntriesByBinding(input, "remove-me");

  assert.deepEqual(result.config.lora1.map((entry) => entry.id), ["b"]);
  assert.deepEqual(result.config.lora2.map((entry) => entry.id), ["d"]);
  assert.equal(result.removed.lora1, 1);
  assert.equal(result.removed.lora2, 1);
});

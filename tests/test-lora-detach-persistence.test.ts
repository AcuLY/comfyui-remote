import test from "node:test";
import assert from "node:assert/strict";
import { shouldPersistLoraBindingLink } from "../src/lib/lora-types";

test("detached preset LoRA persists as manual without binding link", () => {
  assert.equal(shouldPersistLoraBindingLink({
    source: "manual",
    detachedBindingId: "bind-a",
    detachedPresetPath: "a.safetensors",
  }), false);
});

test("suppressed preset LoRA persists as detached manual tombstone without binding link", () => {
  assert.equal(shouldPersistLoraBindingLink({
    source: "manual",
    detachedBindingId: "bind-a",
    detachedPresetPath: "a.safetensors",
    suppressed: true,
  }), false);
});

test("ordinary manual LoRA does not attach to preset binding", () => {
  assert.equal(shouldPersistLoraBindingLink({ source: "manual" }), false);
});

test("clean preset LoRA can keep binding identity until the caller filters it out", () => {
  assert.equal(shouldPersistLoraBindingLink({ source: "preset", bindingId: "bind-a" }), true);
});

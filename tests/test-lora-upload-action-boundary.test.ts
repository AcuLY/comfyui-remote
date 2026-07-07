import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("LoRA upload form imports upload action from the focused lora module", () => {
  const form = readSource("src/app/assets/loras/lora-upload-form.tsx");
  const action = readSource("src/lib/actions/lora.ts");

  assert.match(action, /export async function uploadLora\(formData: FormData\)/);
  assert.match(form, /from "@\/lib\/actions\/lora";/);
  assert.doesNotMatch(form, /from "@\/lib\/actions";/);
});

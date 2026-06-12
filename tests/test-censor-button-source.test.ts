import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("project censor menu offers a marked pixiv preview cover option", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/projects/[projectId]/censor-button.tsx"), "utf8");

  assert.match(source, /ProjectCensorMode/);
  assert.match(source, /handleCensor\("marked"\)/);
  assert.match(source, /p站 \+ 预览 \+ 封面/);
});

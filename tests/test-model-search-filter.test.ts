import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();

function readSource(path: string) {
  return readFileSync(join(rootDir, path), "utf8");
}

test("model file manager searches and filters model files", () => {
  const source = readSource("src/app/assets/models/model-file-manager.tsx");

  assert.match(source, /\bSearch\b/, "model manager should render a search icon/input affordance");
  assert.match(source, /const \[searchQuery, setSearchQuery\] = useState\(""\)/, "search query should be tracked in component state");
  assert.match(source, /params\.set\("recursive", "1"\)/, "search should browse model files recursively");
  assert.match(source, /function matchesModelSearch/, "search matching should be centralized");
  assert.match(source, /item\.notes/, "search should match saved notes");
  assert.match(source, /item\.triggerWords/, "search should match LoRA trigger words");
  assert.match(source, /item\.civitaiLink/, "search should match Civitai links");
  assert.match(source, /value=\{searchQuery\}/, "search input should be controlled");
  assert.match(source, /displayItems\.map/, "rendered list should come from filtered display items");
});

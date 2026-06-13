import test from "node:test";
import assert from "node:assert/strict";

import { config } from "../src/proxy";

test("proxy matcher excludes all Next internal routes, including dev HMR", () => {
  const matcher = config.matcher.join("\n");

  assert.match(
    matcher,
    /\(\?!_next\/\|/,
    "proxy must leave /_next/webpack-hmr and other Next internals to the Next dev server",
  );
});

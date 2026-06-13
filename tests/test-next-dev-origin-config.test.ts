import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config";

test("Next dev server allows both loopback browser origins", () => {
  const allowedOrigins = nextConfig.allowedDevOrigins ?? [];

  assert.ok(
    allowedOrigins.includes("localhost"),
    "localhost must stay allowed for the default dev server origin",
  );
  assert.ok(
    allowedOrigins.includes("127.0.0.1"),
    "127.0.0.1 must be allowed so in-app browser HMR can hydrate pages",
  );
});

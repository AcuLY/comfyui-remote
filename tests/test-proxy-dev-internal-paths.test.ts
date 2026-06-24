import test from "node:test";
import assert from "node:assert/strict";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

import { config, proxy } from "../src/proxy";

test("proxy matcher excludes all Next internal routes, including dev HMR", () => {
  for (const url of ["/_next/webpack-hmr", "/_next/static/chunks/main.js"]) {
    assert.equal(
      unstable_doesMiddlewareMatch({
        config,
        url,
      }),
      false,
      "proxy must leave /_next/webpack-hmr and other Next internals to the Next dev server",
    );
  }
});

test("proxy matcher includes generated image resources even when the URL has an image extension", () => {
  assert.equal(
    unstable_doesMiddlewareMatch({
      config,
      url: "/api/images/project/run/raw/001.png",
    }),
    true,
  );
});

test("proxy rejects unauthenticated generated image resource requests", async () => {
  const previousAuthToken = process.env.AUTH_TOKEN;
  process.env.AUTH_TOKEN = "test-auth-token";

  try {
    const response = await proxy(new NextRequest("http://localhost/api/images/project/run/raw/001.png"));

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.deepEqual(await response.json(), {
      error: "Unauthorized",
      message: "Valid auth_token cookie required",
    });
  } finally {
    if (previousAuthToken === undefined) {
      delete process.env.AUTH_TOKEN;
    } else {
      process.env.AUTH_TOKEN = previousAuthToken;
    }
  }
});

test("proxy rejects unauthenticated API requests outside the auth namespace", async () => {
  const previousAuthToken = process.env.AUTH_TOKEN;
  process.env.AUTH_TOKEN = "test-auth-token";

  try {
    const response = await proxy(new NextRequest("http://localhost/api/health"));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Unauthorized",
      message: "Valid auth_token cookie required",
    });
  } finally {
    if (previousAuthToken === undefined) {
      delete process.env.AUTH_TOKEN;
    } else {
      process.env.AUTH_TOKEN = previousAuthToken;
    }
  }
});

# Test Suite Map

This directory is the safety net for staged refactors. Keep tests scoped to the behavior they protect, and update this map when adding a new fixture helper, source-contract family, or environment-dependent test group.

## Fixture Helpers

- `tests/fixtures/domain-builders.ts` owns lightweight project, section, preset category, preset, preset group, template, run, image result, training project, training section, generation task, dataset revision, and training run fixture builders. Use these for pure tests that only need stable IDs, relationship fields, and override-friendly object shapes.
- `tests/fixtures/sqlite-db.ts` owns `better-sqlite3` temp database setup, `file:` URL exposure, SQL bootstrap, open/close wrapping, and cleanup.
- `tests/fixtures/prisma-schema-source.ts` owns cached Prisma schema source reads, model block parsing, enum discovery, and directive lookup for source-contract tests.

## Native Modules And Local Data

Some DB tests require regenerated native modules such as `better-sqlite3` or generated Prisma clients. When those fail to load, treat the failure as an environment/tooling issue first, not as proof that the domain behavior changed.

Local DB files such as `data/comfyui.db` and `prisma/data/comfyui.db` are runtime data, not fixtures. Tests that need SQLite state should create fresh DB/file fixtures in a temp directory through `tests/fixtures/sqlite-db.ts` or an equivalent per-test temp setup.

## Source Contract Tests

Source contract tests inspect file text to protect architecture boundaries that runtime tests cannot see directly, such as import direction, route ownership, App Router compatibility, generated/runtime-file boundaries, and UI module split decisions. Keep source contract assertions explicit about the behavior they protect and avoid duplicating runtime assertions.

Tests named `test-*-source`, `test-*-boundary`, `test-*-governance`, and source-scanning sections inside broader route or UI suites are source contract tests. Runtime behavior tests should import modules or call services/routes directly instead of scanning source text.

## Route And Environment Order

Route tests must import route modules only after test env vars are set. Set `AUTH_TOKEN`, `DB_PROVIDER`, `DATABASE_URL`, or other required process env values before `await import("../src/app/api/.../route")`, and restore changed env values in `finally` blocks when the test mutates global process state.

Static imports from `src/app/api/**` in test files are disallowed because they can load route modules before env setup. Use dynamic imports inside the test body or setup block instead.

## Isolation Rules

- Create fresh DB/file fixtures per test file or per test case; do not rely on another test's database rows, temp files, process env mutation, or execution order.
- Keep visual and UI source tests focused on rendered output, stable component contracts, or documented source-contract boundaries rather than incidental CSS class order.
- Keep skipped tests explicit about the missing local capability, such as unavailable `node:sqlite`, and do not hide unexpected failures behind broad skips.

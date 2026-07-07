# Whole Repo Refactor Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the entire `comfyui-remote` repository into a consistently bounded, testable, documented system without losing existing generation, review, preset, training, worker, ComfyUI, Agent API, MCP, and deployment behavior.

**Architecture:** Keep Next.js route handlers thin, move business behavior into explicit service modules, keep repositories focused on persistence, keep UI pages as route containers, and make design demos, docs, scripts, generated code, and runtime files first-class governed areas instead of side effects. Refactoring must proceed in small behavior-preserving batches with known baseline failures fixed or explicitly recorded before dependent work starts.

**Tech Stack:** Next.js 16.2.1 App Router, React 19.2.4, TypeScript 5, Prisma 7 with PostgreSQL and SQLite schemas, Node test runner with `tsx`, Tailwind CSS 4, shadcn/Base UI/lucide UI pieces, ComfyUI HTTP integration, Python auto-censor runner, and Windows `mypc` deployment constraints documented in `AGENTS.md`.

---

## Scope And Ground Rules

- [ ] Cover every tracked area: root files, `agent-rules/`, `config/`, `design-demos/`, `docs/`, `prisma/`, `public/`, `scripts/`, `src/`, and `tests/`.
- [ ] Treat generated and runtime files differently from source files: generated files must be regenerated, runtime files must be ignored or documented, and neither should be hand-refactored.
- [ ] Do not change runtime behavior in the same commit as broad movement unless the test explicitly proves the behavior is unchanged.
- [ ] Prefer moving code behind stable exports before changing implementation details.
- [ ] Keep route URLs, API response envelopes, database shape, queue semantics, auth token handling, and deployment scripts stable until a task explicitly changes them.
- [ ] Keep `/api/queue` semantics explicit: it is the review queue, not the active queued/running work source.
- [ ] For active work state, use `/api/worker/status`, `/api/queue-data`, `pause-active`, and `resume-paused`.
- [ ] Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before changing App Router, route handler, proxy, build, cache, or React Server Component patterns.
- [ ] Keep all auth verification compatible with the `.env` token workflow in `AGENTS.md`; never hard-code or print token values.
- [ ] Any later implementation that affects runtime behavior must follow the repository deploy rules in `AGENTS.md`, including `.deploy.lock`, queue pause/resume, build checks, service restart filtering, and authenticated verification.

## Architecture Quality Gates

**Purpose:** Make module boundaries, maintainability, code style, and extensibility explicit acceptance criteria for every refactor batch.

**Module split gates:**
- [ ] Every module must have one primary reason to change; if a file changes for UI layout, API behavior, persistence, and worker behavior at the same time, split it.
- [ ] Every moved or newly created file must declare its owner area in the inventory: route, page container, UI component, hook, service, repository, worker, script, test fixture, doc, generated code, or runtime artifact.
- [ ] A route file must not own business workflow. It can own request parsing, auth checks, input validation, service invocation, and response mapping.
- [ ] A service file must not own raw page rendering or route-specific response formatting. It can own workflow orchestration, validation coordination, audit, external calls, and side effects.
- [ ] A repository file must not own business decisions, UI labels, HTTP response shape, or external process behavior. It can own query construction, persistence, transactions, and row mapping.
- [ ] A UI component must not import Prisma, repository modules, server services, Node-only APIs, or deployment/runtime utilities.
- [ ] Shared helpers must be classified as client-safe, server-only, or universal before they are imported from multiple modules.
- [ ] Any module that remains intentionally broad must have an explicit retention reason and a follow-up split checkpoint.

**Dependency gates:**
- [ ] Preferred request dependency direction is `src/app/api -> src/server/services -> src/server/repositories -> prisma`.
- [ ] Preferred page dependency direction is `src/app/* route/page -> src/features or src/components -> src/lib client-safe helpers`.
- [ ] Repositories must not import services.
- [ ] Server services must not import React components or route client modules.
- [ ] Client components must not import `src/server/**`, `src/lib/db.ts`, `src/lib/prisma.ts`, or Node built-ins.
- [ ] Training-owned resources must not fall back to generation-owned APIs or UI routes except for explicitly shared resources such as models and settings.
- [ ] Generation-owned resources must not use training APIs or training UI routes as compatibility shortcuts.
- [ ] Barrel files must use explicit exports for public APIs; wildcard barrels require a documented reason and a test that catches accidental public surface expansion.

**Maintainability gates:**
- [ ] Files over 800 lines must be reviewed for extraction before feature work continues.
- [ ] Files over 1200 lines must either be split in the same batch or have a written exception with a target split batch.
- [ ] Functions over 80 lines must be reviewed for extraction into parser, mapper, validator, command, or renderer helpers.
- [ ] Components with more than three independent state clusters must extract hooks or child components.
- [ ] Any helper used by three or more modules must live in a named shared module with tests.
- [ ] Every nontrivial module must have a stable test entrypoint or an explicit reason why it is covered through a higher-level test.
- [ ] Known-red tests must be listed with cause and owner before unrelated refactors proceed.
- [ ] Source-contract tests that inspect file text must explain the behavior they protect and should not duplicate runtime tests.

**Code style gates:**
- [ ] Naming must reflect layer and domain: route handlers use HTTP verbs, services use command/query names, repositories use list/get/create/update/delete or transaction-specific names, UI components use product nouns, hooks start with `use`.
- [ ] Error responses must use the shared API envelope and a consistent error message extraction path.
- [ ] Toast messages, route labels, status labels, and audit messages must be owned by the feature area that renders or records them, not duplicated in routes.
- [ ] Import paths must prefer `@/` aliases for source modules and relative paths for files within the same small folder.
- [ ] Type definitions shared across client and server must not include Prisma-only types unless the file is server-only.
- [ ] `unknown` parsing must be localized to boundary modules; downstream code should receive typed inputs.
- [ ] `any` requires a local explanation or replacement with `unknown`, typed generics, or schema parsing.
- [ ] CSS modules must stay colocated with the component or feature they style; global CSS is reserved for tokens, resets, and app-wide layout primitives.
- [ ] Generated files, runtime logs, local DB files, and build artifacts must not be formatted, linted, or manually edited.

**Extensibility gates:**
- [ ] Adding a new API route requires a service owner, input schema, response shape, route test, and docs update if public or agent-facing.
- [ ] Adding a new service requires a repository or external dependency map, a test plan, and a note about side effects.
- [ ] Adding a new repository method requires a typed filter/input object and at least one test for ordering, scoping, or transaction behavior if the query is nontrivial.
- [ ] Adding a new Prisma model requires updates to both PostgreSQL and SQLite schemas, migration strategy, generated client plan, and schema compatibility tests.
- [ ] Adding a new worker task requires task ID parsing, lease/heartbeat/complete/fail behavior, retry semantics, and worker route tests.
- [ ] Adding a new UI route requires route data ownership, loading/error state, mobile layout behavior, auth behavior if protected, and navigation placement.
- [ ] Adding a new design-demo page requires a clear relationship to production: active reference, component lab, migration staging, or archive.
- [ ] Adding a new script requires documented inputs, outputs, dry-run behavior, logging, and exit code semantics.
- [ ] Adding a new doc requires classification as current, runbook, historical, prototype, generated, or superseded.

**Documentation system gates:**
- [ ] The refactor must leave behind a maintained documentation system, not only updated individual documents.
- [ ] Every documentation file must be classified as current, runbook, architecture reference, API contract, product/design reference, prototype, historical record, generated artifact, or superseded.
- [ ] Every current document must have an owner area, update trigger, and verification method.
- [ ] Every superseded document must either be deleted, moved to an archive area, or kept with a clear supersession banner pointing to the current source of truth.
- [ ] Historical plans and PRDs must not be presented as current runtime truth; they must be indexed as historical/product intent if retained.
- [ ] Prototype HTML/CSS/JS files must be classified as active reference, migration staging, or archive; stale prototype files must not remain beside current docs without status.
- [ ] The documentation system must include a top-level index that tells agents which docs to read first for architecture, local development, deployment, API contracts, UI design, training, queue/worker behavior, and troubleshooting.
- [ ] Documentation changes must accompany module boundary changes, route contract changes, Prisma schema changes, script behavior changes, and deployment workflow changes.
- [ ] Docs that duplicate another source must either become generated/synchronized, be merged into the authoritative doc, or be removed.
- [ ] File cleanup must include stale docs, stale prototype assets, obsolete static demos, unused public assets, abandoned scripts, and old local verification notes.
- [ ] A deleted documentation or prototype file must have its replacement path or deletion reason recorded in the batch notes.
- [ ] New docs must avoid vague handoff prose; they must name exact files, commands, routes, services, repositories, scripts, and verification gates.

**Review gates:**
- [ ] Each batch review must explicitly answer: did this improve module split, maintainability, style consistency, or extensibility?
- [ ] If a batch only moves files, review must compare imports before and after and run import-level tests.
- [ ] If a batch changes behavior, review must include test evidence and user-visible behavior notes.
- [ ] If a batch introduces an exception to these gates, the exception must name an owner, reason, risk, and removal trigger.
- [ ] Final convergence cannot pass while files remain unclassified, generated/runtime files are mixed with source, or broad modules lack split decisions.

## Current Inventory Snapshot

- [ ] Root tracked files: `AGENTS.md`, `CLAUDE.md`, `README.md`, `DESIGN.md`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `prisma.config.ts`, `components.json`, `docker-compose.yml`, `position_presets.md`, `start-server.bat`.
- [ ] Source areas: `src/app`, `src/app/api`, `src/components`, `src/features/training`, `src/lib`, `src/server`, `src/hooks`, `src/scripts`, `src/generated`, `src/proxy.ts`, `src/instrumentation.ts`, `src/instrumentation.node.ts`.
- [ ] Test areas: `tests/*.test.ts`, colocated design-demo tests under `src/app/design-demos/**`, component tests under `src/components/**`.
- [ ] Documentation areas: `docs/analysis`, `docs/plans`, `docs/prd`, `docs/prototypes`, `docs/superpowers`, top-level design and verification docs.
- [ ] Operational areas: `agent-rules/`, `scripts/`, `config/`, `prisma/`, `public/`, legacy static demos under `design-demos/`.
- [x] Baseline check: `better-sqlite3` ABI failure was not reproduced on Node v20.20.0 in this workspace after current dependency install.
- [x] Resolved baseline issue: `npm test` no longer has deterministic source-contract or `test-zero-redundancy-migration` assertion failures after Batch 3.
- [x] Resolved baseline issue: `npm run lint` no longer reports the React hooks `set-state-in-effect` errors or unused training warnings after Batch 1.

## Phase 0: Baseline, Ownership Map, And Safety Rails

**Purpose:** Make the repo measurable before moving anything.

**Files and modules:**
- Root: `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `.gitignore`, `.env.example`.
- Docs: create or update a baseline section in this roadmap as work proceeds; update `docs/local-verification.md` if verification commands change.
- Tests: all `tests/*.test.ts`, design-demo tests, component tests.

- [x] Record `node -v`, `npm -v`, `npm ls next react prisma @prisma/client better-sqlite3`.
- [x] Run `git status --short --branch` and confirm whether the worktree is clean before each implementation batch.
- [x] Run `npm run lint`; preserve exact failing files and line numbers in the batch notes.
- [x] Run `npm test`; classify failures as environment, deterministic assertion, external dependency, or flaky.
- [x] Run Prisma generate for both providers after the ABI issue is resolved:
  - [x] `npm run prisma:generate`.
  - [x] `npm run prisma:generate:sqlite`.
  - [x] `npm run prisma:generate:all`.
- [ ] Run `npx next build --webpack` only in an implementation batch that is allowed to perform build verification.
- [x] Create an inventory table for all tracked files with columns: path, area, owner module, file type, current role, target role, action.
- [x] Mark every file as one of: keep, move, split, rename, regenerate, archive, delete, or document-only.
- [x] Add a dependency-rule note: `src/app/api -> src/server/services -> src/server/repositories -> prisma` is the preferred request path; `src/features/*` and `src/components/*` must not import server-only modules.
- [x] Add a generated-code rule: `src/generated/**` is regenerated from Prisma and not manually edited.
- [x] Add a runtime-file rule: `.next/**`, `data/**`, `logs/**`, `.tmp/**`, `server-dev-*.log`, `server-prod-*.log`, `build-prod*.log`, `.deploy.lock/**`, and local DB files are runtime artifacts.

### Phase 0 Baseline Notes - 2026-07-06

- Environment recorded: `node -v` = `v20.20.0`; `npm -v` = `10.8.2`; `npm ls next react prisma @prisma/client better-sqlite3` reported `next@16.2.1`, `react@19.2.4`, `prisma@7.5.0`, `@prisma/client@7.5.0`, and `better-sqlite3@12.8.0`.
- Work started from `main...origin/main` with this roadmap file untracked, then continued on `codex/whole-repo-refactor-roadmap` to avoid implementation work directly on `main`.
- Initial `npm run lint` failed with `react-hooks/set-state-in-effect` at `src/components/design-demo-shell/app-shell.tsx:409` and `src/components/preset-cascade-picker.tsx:120`, plus unused warnings in `src/server/repositories/training/projects.ts` and `src/server/services/training/preset-service.ts`.
- Batch 1 fixed the lint errors/warnings by deferring initial browser-only state sync, removing unused Training repository placeholder parameters, and removing unused Training preset wrapper functions. Final `npm run lint` passes.
- Initial `npm test` failed 34 tests. The largest failure cluster was environment/tooling drift: generated Prisma clients did not include `useTwoStageKSampler`, even though both Prisma schemas and migrations did. Batch 1 made Prisma generate scripts explicit for PostgreSQL and SQLite, regenerated both providers, and verified the affected service/write-path tests.
- `npm run prisma:generate`, `npm run prisma:generate:sqlite`, and `npm run prisma:generate:all` now pass and load `prisma/schema.prisma` plus `prisma/schema.sqlite.prisma` explicitly.
- Final Batch 1 `npm test` result: 958 tests discovered, 946 pass, 11 fail, 1 skipped. Remaining failures were deterministic assertions, not ABI failures.
- Batch 2 fixed the Next tracing source-contract test to validate the shared `runtimeTraceExcludes` owner, moved the Training project creation action into `PageHeader`, and verified `tests/test-runtime-data-path-source.test.ts` plus `tests/test-training-project-list-item.test.ts`.
- Final Batch 2 `npm test` result: 958 tests discovered, 949 pass, 8 fail, 1 skipped. Remaining failures are all in `tests/test-zero-redundancy-migration.test.ts`, around resolver mismatch / migration planning and verification assertions.
- Batch 3 fixed the zero-redundancy migration verifier by preserving the `useTwoStageKSampler` default in the legacy verification snapshot. Final `npm test` result: 958 tests discovered, 957 pass, 0 fail, 1 skipped.
- Targeted verification passed: `tests/test-agent-preset-variant-flow-service.test.ts`, `tests/test-zero-redundancy-write-paths.test.ts`, `tests/test-preset-cascade-picker-overlay.test.ts`, `tests/test-training-api-routes.test.ts`, `tests/test-prisma-generate-scripts.test.ts`, and `src/app/design-demos/shell/app-shell.test.mjs`.
- Inventory/docs classification added `docs/index.md`, generated `docs/repo-inventory.md`, and `scripts/docs/generate-repo-inventory.ts`. The inventory now covers all tracked files plus current inventory artifacts, has no `uncategorized` owner modules, and records one roadmap action per file.
- Inventory/docs classification verification passed: `node --import tsx --test tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 960 tests discovered, 959 pass, 0 fail, 1 skipped.
- Batch 3 slice 1 added `src/server/http/request-json.ts` as the shared route JSON parser and migrated `src/app/api/queue/resume-paused/route.ts` away from its local parser. Invalid JSON now returns the shared API error envelope before queue actions run.
- Batch 3 slice 1 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 964 tests discovered, 963 pass, 0 fail, 1 skipped.
- Batch 3 slice 2 migrated required-object parsing in `src/app/api/templates/route.ts`, `src/app/api/preset-library/folders/route.ts`, and `src/app/api/projects/[projectId]/save-as-template/route.ts` to `readJsonObject`.
- Batch 3 slice 2 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 966 tests discovered, 965 pass, 0 fail, 1 skipped.
- Batch 3 slice 3 migrated required-object parsing in `src/app/api/templates/[templateId]/route.ts` and `src/app/api/preset-library/folders/[folderId]/move/route.ts` to `readJsonObject`.
- Batch 3 slice 3 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 966 tests discovered, 965 pass, 0 fail, 1 skipped.
- Batch 4 slice 1 added `docs/prisma-provider-matrix.md` and linked it from `docs/index.md` so PostgreSQL, SQLite, and test-only DB commands have one current read-first source.
- Batch 4 slice 1 verification passed: `node --import tsx --test tests/test-prisma-provider-matrix-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 969 tests discovered, 968 pass, 0 fail, 1 skipped.
- Batch 4 slice 2 added generated `docs/prisma-schema-compatibility.md` plus `scripts/docs/generate-prisma-schema-compatibility.ts`, covering all 54 models shared by the PostgreSQL and SQLite Prisma schemas.
- Batch 4 slice 2 verification passed: `node --import tsx --test tests/test-prisma-schema-compatibility-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 971 tests discovered, 970 pass, 0 fail, 1 skipped.
- Batch 4 slice 3 clarified Prisma schema domain comments in both PostgreSQL and SQLite schemas without changing model fields, relations, indexes, or enums.
- Batch 4 slice 3 verification passed: `node --import tsx --test tests/test-prisma-schema-domain-comments.test.ts tests/test-prisma-schema-compatibility-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, `npm run prisma:generate:all`, and `npm test` with 972 tests discovered, 971 pass, 0 fail, 1 skipped.
- Batch 4 slice 4 added generated provider enum mapping documentation for PostgreSQL Prisma enums and the corresponding SQLite string fields/defaults.
- Batch 4 slice 4 verification passed: `node --import tsx --test tests/test-prisma-schema-compatibility-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, `npm run prisma:generate:all`, and `npm test` with 973 tests discovered, 972 pass, 0 fail, 1 skipped.
- Batch 4 slice 5 added generated relation scope and uniqueness documentation for preset binding, template binding, variant link, and manual LoRA relation models across both Prisma providers.
- Batch 4 slice 5 verification passed: `node --import tsx --test tests/test-prisma-schema-compatibility-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, `npm run prisma:generate:all`, and `npm test` with 974 tests discovered, 973 pass, 0 fail, 1 skipped.
- Batch 4 slice 6 added generated legacy compatibility field audit decisions for linked variant JSON, legacy section/template prompt storage, seed policy compatibility payloads, and training character LoRA prompt values.
- Batch 4 slice 6 verification passed: `node --import tsx --test tests/test-prisma-schema-compatibility-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, `npm run prisma:generate:all`, and `npm test` with 975 tests discovered, 974 pass, 0 fail, 1 skipped.
- Batch 4 slice 7 expanded the zero-redundancy migration CLI parser to expose `--source-db`, `--source-db-path`, `--provider`, `--verify`, and repeatable `--verifier-arg` options alongside existing dry-run/write/format arguments.
- Batch 4 slice 7 verification passed: `node --import tsx --test tests/test-zero-redundancy-migration.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 975 tests discovered, 974 pass, 0 fail, 1 skipped.
- Batch 4 slice 8 made the zero-redundancy verifier return machine-readable failure classes and composable nonzero exit codes for invalid JSON, invalid references, and resolver mismatches.
- Batch 4 slice 8 verification passed: `node --import tsx --test tests/test-zero-redundancy-migration.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 976 tests discovered, 975 pass, 0 fail, 1 skipped.
- Batch 4 slice 9 aligned `scripts/db/collapse-preset-group-bindings.ts` with the zero-redundancy scripts' dry-run and logging conventions: exported parser, `--format` support, write/dry-run conflict rejection, JSON formatting through the shared formatter, and retained `--json`/`--summary` aliases.
- Batch 4 slice 9 verification passed: `node --import tsx --test tests/test-collapse-preset-group-bindings.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 977 tests discovered, 976 pass, 0 fail, 1 skipped.
- Batch 4 slice 10 added `tests/fixtures/sqlite-db.ts` as the shared `better-sqlite3` setup helper for temp DB creation, `file:` URL exposure, open/close wrapping, setup SQL execution, and temp cleanup.
- Batch 4 slice 10 migrated the direct `better-sqlite3` setup in `tests/test-agent-preset-variant-flow-service.test.ts`, `tests/test-collapse-preset-group-bindings.test.ts`, `tests/test-preset-resource-scope.test.ts`, `tests/test-training-api-routes.test.ts`, `tests/test-training-preset-service-prisma-runtime.test.ts`, and `tests/test-zero-redundancy-write-paths.test.ts`; only `tests/fixtures/sqlite-db.ts` imports `better-sqlite3` now.
- Batch 4 slice 10 verification passed: `node --import tsx --test tests/test-agent-preset-variant-flow-service.test.ts tests/test-collapse-preset-group-bindings.test.ts tests/test-preset-resource-scope.test.ts tests/test-training-api-routes.test.ts tests/test-training-preset-service-prisma-runtime.test.ts tests/test-zero-redundancy-write-paths.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 977 tests discovered, 976 pass, 0 fail, 1 skipped.
- Batch 4 slice 11 confirmed `prisma/data/comfyui.db` is not tracked and is ignored by `.gitignore`'s `*.db` rule; `data/comfyui.db` remains ignored by `/data/`. `docs/prisma-provider-matrix.md` now classifies both paths as local runtime data, not fixtures, and says not to track them.
- Batch 4 slice 11 verification passed: `node --import tsx --test tests/test-prisma-provider-matrix-doc.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 978 tests discovered, 977 pass, 0 fail, 1 skipped.
- Batch 4 slice 12 added `tests/fixtures/prisma-schema-source.ts` as the shared Prisma schema source helper for cached schema reads, model blocks, model names, enum definitions, enum field references, and model directives.
- Batch 4 slice 12 migrated Prisma schema-text assertions in `tests/test-zero-redundancy-schema-shape.test.ts`, `tests/test-zero-redundancy-no-legacy-fields.test.ts`, `tests/test-latent-schema-cleanup.test.ts`, `tests/test-model-civitai-info-panel.test.ts`, `tests/test-prisma-schema-domain-comments.test.ts`, `tests/test-prisma-schema-compatibility-doc.test.ts`, and `tests/test-training-api-boundary.test.ts` to the shared helper.
- Batch 4 slice 12 verification passed: `node --import tsx --test tests/test-zero-redundancy-schema-shape.test.ts tests/test-zero-redundancy-no-legacy-fields.test.ts tests/test-latent-schema-cleanup.test.ts tests/test-model-civitai-info-panel.test.ts tests/test-prisma-schema-domain-comments.test.ts tests/test-prisma-schema-compatibility-doc.test.ts tests/test-training-api-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 978 tests discovered, 977 pass, 0 fail, 1 skipped.
- Phase 3 slice 1 added `docs/api/route-handler-template.md` as the explicit route-handler template and linked it from `docs/index.md`.
- Phase 3 slice 1 added `failFromError` to `src/lib/api-response.ts` and migrated the low-risk `request-json` adopters to shared caught-error mapping while preserving route-specific validation branches.
- Phase 3 slice 1 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 980 tests discovered, 979 pass, 0 fail, 1 skipped.
- Phase 3 slice 2 migrated `src/app/api/image-review/route.ts` to `readJsonObject` and `failFromError`, preserving the review API's shared error envelope and no-revalidation keep/trash behavior.
- Phase 3 slice 2 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts`, `npm run lint`, and `npm test` with 981 tests discovered, 980 pass, 0 fail, 1 skipped.
- Phase 3 slice 3 added `readJsonBody`, `flatFail`, and `okOnly` so `src/app/api/auth/verify/route.ts` can share parsing/formatting helpers while preserving its login-facing flat error payloads, `{ ok: true }` success body, cookie behavior, and no-token-logging rule.
- Phase 3 slice 3 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-proxy-dev-internal-paths.test.ts`, `npm run lint`, and `npm test` with 984 tests discovered, 983 pass, 0 fail, 1 skipped.
- Phase 3 slice 4 added `tests/test-global-api-routes.test.ts` to lock `/api/health` as a minimal public/local probe and `/api/mcp` as a thin transport adapter over `src/server/mcp/server.ts`.
- Phase 3 slice 4 verification passed: `node --import tsx --test tests/test-global-api-routes.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 986 tests discovered, 985 pass, 0 fail, 1 skipped.
- Phase 3 slice 5 migrated top-level generation project mutation parsing in `src/app/api/projects/route.ts`, `src/app/api/projects/[projectId]/route.ts`, and `src/app/api/project-folders/route.ts` to `readJsonBody`/`failFromError` while preserving project-service and project-folder-service mapping behavior.
- Phase 3 slice 5 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 988 tests discovered, 987 pass, 0 fail, 1 skipped.
- Phase 3 slice 6 migrated project-folder rename, move, and reorder mutation parsing in `src/app/api/project-folders/[folderId]/route.ts`, `src/app/api/project-folders/move/route.ts`, and `src/app/api/project-folders/reorder/route.ts` to `readJsonBody`/`failFromError`.
- Phase 3 slice 6 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 988 tests discovered, 987 pass, 0 fail, 1 skipped.
- Phase 3 slice 7 migrated generation section add, update, and reorder route parsing in `src/app/api/projects/[projectId]/sections/route.ts`, `src/app/api/projects/[projectId]/sections/[sectionId]/route.ts`, and `src/app/api/projects/[projectId]/sections/reorder/route.ts` to `readJsonBody`/`failFromError`.
- Phase 3 slice 7 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 988 tests discovered, 987 pass, 0 fail, 1 skipped.
- Phase 3 slice 8 migrated optional-body generation run trigger parsing in `src/app/api/projects/[projectId]/run/route.ts` and `src/app/api/projects/[projectId]/sections/[sectionId]/run/route.ts` to `readOptionalJsonObject`/`failFromError`, keeping `batchSize` optional while rejecting malformed JSON before service calls.
- Phase 3 slice 8 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 989 tests discovered, 988 pass, 0 fail, 1 skipped.
- Phase 3 slice 9 migrated generation section prompt-block create/reorder/update parsing in `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route.ts` and `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route.ts` to `readJsonBody`/`failFromError`, preserving prompt-block service error mapping.
- Phase 3 slice 9 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 989 tests discovered, 988 pass, 0 fail, 1 skipped.
- Phase 3 slice 10 migrated generation section preset/template action parsing in `src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route.ts`, `src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route.ts`, and `src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route.ts` to `readJsonBody`/`failFromError`.
- Phase 3 slice 10 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 989 tests discovered, 988 pass, 0 fail, 1 skipped.
- Phase 3 slice 11 migrated top-level generation project apply-param and preset-replacement mutation parsing in `src/app/api/projects/[projectId]/apply-param/route.ts` and `src/app/api/projects/[projectId]/preset-replacements/route.ts` to `readJsonBody`/`failFromError`.
- Phase 3 slice 11 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 989 tests discovered, 988 pass, 0 fail, 1 skipped.
- Phase 3 slice 12 migrated destructive generation section batch-delete parsing in `src/app/api/projects/[projectId]/sections/batch-delete/route.ts` to `readJsonBody`/`failFromError`, moved section ownership checks into `deleteProjectSections` in `src/server/services/project-service.ts`, and added service tests covering dedupe, project ownership, and no-delete-on-missing-section behavior.
- Phase 3 slice 12 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-project-section-delete-service.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 994 tests discovered, 993 pass, 0 fail, 1 skipped.
- Phase 3 slice 13 migrated generation template import, preset-replacement, and section PATCH parsing in `src/app/api/templates/[templateId]/import/route.ts`, `src/app/api/templates/[templateId]/preset-replacements/route.ts`, and `src/app/api/templates/[templateId]/sections/[sectionId]/route.ts` to `readJsonBody`/`failFromError`.
- Phase 3 slice 13 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 996 tests discovered, 995 pass, 0 fail, 1 skipped.
- Phase 3 slice 14 migrated preset-library category create/update/reorder/slot-template/sort-order/group-reorder parsing in `src/app/api/preset-library/categories/**/route.ts` to `readJsonBody`/`failFromError`, preserving route-level `ids` and `dimension` validation branches.
- Phase 3 slice 14 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 998 tests discovered, 997 pass, 0 fail, 1 skipped.
- Phase 3 slice 15 migrated preset-library folder rename/reorder and group create/update/member/reorder parsing in `src/app/api/preset-library/folders/**/route.ts` and `src/app/api/preset-library/groups/**/route.ts` to `readJsonBody`/`failFromError`, preserving route-level `categoryId` and `ids` validation branches.
- Phase 3 slice 15 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1000 tests discovered, 999 pass, 0 fail, 1 skipped.
- Phase 3 slice 16 migrated preset-library preset create/update/reorder and variant create/update/reorder parsing in `src/app/api/preset-library/presets/**/route.ts` and `src/app/api/preset-library/variants/[variantId]/route.ts` to `readJsonBody`/`failFromError`, preserving route-level `categoryId`, `ids`, and variant `action` validation branches.
- Phase 3 slice 16 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, `node --import tsx --test tests/test-auto-censor-runner.test.ts` after an initial non-reproducible timeout-harness failure, and `npm test` with 1002 tests discovered, 1001 pass, 0 fail, 1 skipped.
- Phase 3 slice 17 migrated review keep/trash and image cover route parsing in `src/app/api/runs/[runId]/review/**/route.ts` and `src/app/api/images/[imageId]/cover/route.ts` to `readJsonBody`/`readOptionalJsonObject` with `failFromError`, keeping review service errors mapped through `mapReviewError`.
- Phase 3 slice 17 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1004 tests discovered, 1003 pass, 0 fail, 1 skipped.
- Phase 3 slice 18 migrated Agent API review, project update, variant switch, and preset sync flow route parsing in `src/app/api/agent/**/route.ts` to `readJsonBody`/`failFromError`, preserving each route's existing Agent/service error mapper.
- Phase 3 slice 18 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1006 tests discovered, 1005 pass, 0 fail, 1 skipped.
- Phase 3 slice 19 migrated Training project create/update/reorder/profile/save-as-template route parsing in `src/app/api/training/projects/**/route.ts` to `readJsonBody`/`failFromError`, preserving each route's existing Training project error mapper.
- Phase 3 slice 19 verification passed: `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1008 tests discovered, 1007 pass, 0 fail, 1 skipped.
- Phase 3 slice 20 migrated Training section, block, detach, and section-run route parsing in `src/app/api/training/projects/[projectId]/sections/**/route.ts`, `src/app/api/training/sections/[sectionId]/**/route.ts`, and `src/app/api/training/blocks/[blockId]/**/route.ts` to `readJsonBody` or `readOptionalJsonObject` with `failFromError`, preserving each route's existing Training section/block error mapper.
- Phase 3 slice 20 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1010 tests discovered, 1009 pass, 0 fail, 1 skipped.
- Phase 3 slice 21 migrated Training preset create/update/sort-rules route parsing in `src/app/api/training/presets/**/route.ts` to `readJsonBody`/`failFromError`, preserving the existing Training preset error mapper.
- Phase 3 slice 21 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1012 tests discovered, 1011 pass, 0 fail, 1 skipped.
- Phase 3 slice 22 migrated Training scene-description category, folder, and preset cascade route parsing in `src/app/api/training/scene-description/**/route.ts` to `readJsonBody` or `readOptionalJsonObject` with `failFromError`, preserving the existing Training preset error mapper.
- Phase 3 slice 22 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, `node --import tsx --test tests/test-auto-censor-runner.test.ts` after an initial non-reproducible timeout-harness failure in full suite, and `npm test` with 1014 tests discovered, 1013 pass, 0 fail, 1 skipped.
- Phase 3 slice 23 migrated Training reference-image, image-result, caption, review, and generation-output apply route parsing in `src/app/api/training/reference-images/**/route.ts`, `src/app/api/training/image-results/**/route.ts`, and `src/app/api/training/generation-outputs/[outputId]/apply/route.ts` to `readJsonBody` or `readOptionalJsonObject` with `failFromError`, preserving each route's existing Training asset/result error mapper.
- Phase 3 slice 23 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1016 tests discovered, 1015 pass, 0 fail, 1 skipped.
- Phase 3 slice 24 migrated Training template create/update/reorder/project-copy/section/block route parsing in `src/app/api/training/templates/**/route.ts` to `readJsonBody` or `readOptionalJsonObject` with `failFromError`, preserving the existing Training template, template-block, and template-copy error mappers.
- Phase 3 slice 24 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1018 tests discovered, 1017 pass, 0 fail, 1 skipped.
- Phase 3 slice 25 migrated Training generation task draft/create/update/input/cancel and worker complete/fail route parsing in `src/app/api/training/projects/[projectId]/generation-tasks/route.ts`, `src/app/api/training/generation-tasks/**/route.ts`, and `src/app/api/training/worker/generation-tasks/**/route.ts` to `readJsonBody` or `readOptionalJsonObject` with `failFromError`, preserving the existing generation-task, run-mutation, and worker task error mappers.
- Phase 3 slice 25 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1020 tests discovered, 1019 pass, 0 fail, 1 skipped.
- Phase 3 slice 26 migrated Training section-run cancel, project training-run enqueue, training-run cancel/create-preset, and worker training-run callback route parsing in `src/app/api/training/section-runs/**/route.ts`, `src/app/api/training/projects/[projectId]/training-runs/route.ts`, `src/app/api/training/training-runs/**/route.ts`, and `src/app/api/training/worker/training-runs/**/route.ts` to `readOptionalJsonObject` with `failFromError`, preserving the existing generation-run, training-run, run-preset, and worker task error mappers.
- Phase 3 slice 26 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1022 tests discovered, 1021 pass, 0 fail, 1 skipped.
- Phase 3 slice 27 migrated Training project support route parsing for dataset freeze, text revisions, reference-image JSON registration, and caption generation in `src/app/api/training/projects/[projectId]/dataset-revisions/route.ts`, `src/app/api/training/projects/[projectId]/text-revisions/route.ts`, `src/app/api/training/projects/[projectId]/reference-images/route.ts`, and `src/app/api/training/projects/[projectId]/captions/generate/route.ts` to `readOptionalJsonObject` or `readJsonBody` with `failFromError`, preserving each route's existing Training project/action/caption/text error mapper and multipart reference-image upload path.
- Phase 3 slice 27 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1024 tests discovered, 1023 pass, 0 fail, 1 skipped.
- Phase 3 slice 28 migrated generic Training worker task heartbeat/complete/fail callback route parsing in `src/app/api/training/worker/tasks/[taskId]/heartbeat/route.ts`, `src/app/api/training/worker/tasks/[taskId]/complete/route.ts`, and `src/app/api/training/worker/tasks/[taskId]/fail/route.ts` to `readOptionalJsonObject` or `readJsonBody` with `failFromError`, preserving the existing worker task error mapper.
- Phase 3 slice 28 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1026 tests discovered, 1025 pass, 0 fail, 1 skipped.
- Phase 3 slice 29 migrated model and LoRA asset move/notes route parsing in `src/app/api/models/move/route.ts`, `src/app/api/models/notes/route.ts`, `src/app/api/loras/move/route.ts`, and `src/app/api/loras/notes/route.ts` to `readJsonBody` with `failFromError`, preserving each route's existing ModelAssetError mapper, fallback error response, and object/Zod validation branches.
- Phase 3 slice 29 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-model-civitai-info-panel.test.ts tests/test-training-api-routes.test.ts`, `npm run lint`, and `npm test` with 1028 tests discovered, 1027 pass, 0 fail, 1 skipped.
- Phase 3 slice 30 added a source-contract scan proving route-local JSON request-body parsing is gone across `src/app/api/**/route.ts`, with `src/app/api/logs/route.ts` documented as the only `JSON.parse` exception because it parses JSONL log-file lines rather than request bodies.
- Phase 3 slice 30 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `npm run lint`, and `npm test` with 1029 tests discovered, 1028 pass, 0 fail, 1 skipped.
- Phase 3 slice 31 moved `src/app/api/images/[...path]/route.ts` flat JSON error responses to `flatFail`, preserved its `new NextResponse(stream, ...)` file payload path, and documented `src/app/api/queue-data/route.ts` as the only direct `NextResponse.json(...)` raw response-shape exception.
- Phase 3 slice 31 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts tests/test-image-access-source.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 32 moved generation run workflow download lookup and payload/header assembly from `src/app/api/runs/[runId]/workflow/route.ts` into `src/server/services/run-workflow-service.ts`, preserving the generation project boundary and classifying the new service in `docs/repo-inventory.md`.
- Phase 3 slice 32 verification passed: red `node --import tsx --test tests/test-workflow-download-options-source.test.ts tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-workflow-download-options-source.test.ts tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-auto-censor-runner.test.ts` after an initial full-suite auto-censor timeout-harness failure, `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-workflow-download-options-source.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 33 moved generation worker status run aggregation from `src/app/api/worker/status/route.ts` into `src/server/worker/repository.ts#getGenerationWorkerRunStatus`, preserving ComfyUI reachability in the route and generation project boundary filtering below the route.
- Phase 3 slice 33 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 34 moved generation image cover mutation and manual-censor preflight lookup out of `src/app/api/images/[imageId]/**/route.ts`, delegating cover state changes through `review-service`/`review-repository` and manual censor ownership checks through `censoring-service`.
- Phase 3 slice 34 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-quick-censor-source.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 35 moved queue censoring progress/history reads from `src/app/queue/page.tsx` and `src/app/api/queue-data/route.ts` into `src/server/repositories/queue-data-repository.ts#getCensoringQueueData`, leaving the route-level direct DB scan clean except enum imports.
- Phase 3 slice 35 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, direct route DB scan, `node --import tsx --test tests/test-api-request-json.test.ts tests/test-queue-trash-restore.test.ts tests/test-queue-autopoll-no-router-refresh.test.ts tests/test-zero-redundancy-write-paths.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 36 moved featured/preview image marker mutations from `src/app/api/images/[imageId]/featured-helper.ts` into `review-service`/`review-repository` and switched the helper to shared `readJsonBody`/`failFromError` parsing.
- Phase 3 slice 36 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-project-results-review-counts.test.ts`, `npm run lint`, and `npm test` with 1030 tests discovered, 1029 pass, 0 fail, 1 skipped.
- Phase 3 slice 37 moved generation preset sort-rules category loading from `src/app/assets/presets/sort-rules/page.tsx` into `src/server/repositories/preset-view-repository.ts#listPresetSortRuleCategories`, preserving ordinary preset category scoping through the repository.
- Phase 3 slice 37 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, direct app DB scan, `node --import tsx --test tests/test-route-fallback.test.ts tests/test-preset-sortable-card-links.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, and `npm test` with 1031 tests discovered, 1030 pass, 0 fail, 1 skipped.
- Phase 3 slice 38 moved generation section edit page section/sibling/resolved-config reads into `src/server/repositories/project-view-repository/detail-view.ts#getProjectSectionEditData` and moved manual LoRA persistence into `src/server/services/section-lora-service.ts#saveSectionLoraConfig`, leaving the page without direct Prisma queries.
- Phase 3 slice 38 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, direct app DB scan, `node --import tsx --test tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/test-preset-section-replacement-entrypoints.test.ts tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1032 tests discovered, 1031 pass, 0 fail, 1 skipped.
- Phase 3 slice 39 moved generation section edit page data composition into `src/server/services/section-edit-page-service.ts#getProjectSectionEditPageData` and moved LoRA revalidation into the co-located `src/app/projects/[projectId]/sections/[sectionId]/actions.ts`, leaving the page without direct `@/server` imports.
- Phase 3 slice 39 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, section edit page server-import scan, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1032 tests discovered, 1031 pass, 0 fail, 1 skipped.
- Phase 3 slice 40 moved preset and section change-history type contracts into client-safe `src/lib/change-history-types.ts`, leaving `src/app/**` change-history UI surfaces free of type imports from server services while preserving server-service compatibility re-exports.
- Phase 3 slice 40 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, client change-history server-type import scan, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1033 tests discovered, 1032 pass, 0 fail, 1 skipped.
- Phase 3 slice 41 removed the unused `src/app/queue/[runId]/review-actions.ts` server action stub and added a source-contract guard so non-API app page containers keep `@/server` imports behind explicit API routes or action entrypoints.
- Phase 3 slice 41 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, app server-import scans, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1034 tests discovered, 1033 pass, 0 fail, 1 skipped.
- Phase 3 slice 42 moved Training route data loading from `src/features/training/load-route-data.ts` into `src/server/services/training/route-data-service.ts`, exposed it through the app-local `src/app/training/server-data.ts` facade, and added a source-contract guard keeping `src/features`, `src/components`, and `src/hooks` free of direct `@/server` imports.
- Phase 3 slice 42 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-training-api-boundary.test.ts tests/test-training-route-data-source.test.ts tests/test-training-route-data-loading.test.ts tests/test-work-mode-resource-boundary.test.ts`, feature/component/hook server-import scan, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-training-api-boundary.test.ts tests/test-training-route-data-source.test.ts tests/test-training-route-data-loading.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1035 tests discovered, 1034 pass, 0 fail, 1 skipped.
- Phase 6 slice 1 narrowed `src/app/queue/[runId]/review-grid.tsx` to import review server actions from `src/lib/actions/image-review.ts` instead of the full `src/lib/actions.ts` barrel, with a source-contract guard preventing that route from regressing.
- Phase 6 slice 1 verification passed: red `node --import tsx --test tests/test-review-lightbox-optimistic-navigation.test.ts`, then green `node --import tsx --test tests/test-review-lightbox-optimistic-navigation.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts`, and `npm test` with 1036 tests discovered, 1035 pass, 0 fail, 1 skipped.
- Phase 6 slice 2 narrowed `src/app/queue/queue-page-client.tsx` to import run lifecycle, run execution, image review, and censoring actions from focused action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 2 verification passed: red `node --import tsx --test tests/test-queue-control-progress-stream.test.ts`, then green `node --import tsx --test tests/test-queue-control-progress-stream.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-queue-control-progress-stream.test.ts`, and `npm test` with 1037 tests discovered, 1036 pass, 0 fail, 1 skipped.
- Phase 6 slice 3 narrowed project archive, delete, and create UI controls to import `createProject`, `createProjectFromExisting`, `deleteProject`, and `archiveProject` from `src/lib/actions/project.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 3 verification passed: red `node --import tsx --test tests/test-project-archive-ui-source.test.ts`, then green `node --import tsx --test tests/test-project-archive-ui-source.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-archive-ui-source.test.ts`, and `npm test` with 1038 tests discovered, 1037 pass, 0 fail, 1 skipped.
- Phase 6 slice 4 narrowed `src/app/assets/loras/lora-upload-form.tsx` to import `uploadLora` from `src/lib/actions/lora.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 4 verification passed: red `node --import tsx --test tests/test-lora-upload-action-boundary.test.ts`, then green `node --import tsx --test tests/test-lora-upload-action-boundary.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-lora-upload-action-boundary.test.ts`, and `npm test` with 1039 tests discovered, 1038 pass, 0 fail, 1 skipped.
- Phase 6 slice 5 narrowed `src/app/assets/presets/sort-rules/sort-rules-editor.tsx` to import `updateCategorySortOrders` from `src/lib/actions/preset-category.ts` instead of the full `src/lib/actions.ts` barrel, and added the missing repo-inventory row for the newly tracked LoRA upload source-contract test.
- Phase 6 slice 5 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-work-mode-resource-boundary.test.ts`, and `npm test` with 1039 tests discovered, 1038 pass, 0 fail, 1 skipped.
- Phase 6 slice 6 narrowed section results and project results image controls to import `censorImage`/`trashImages` from `src/lib/actions/image-review.ts` and `runSection` from `src/lib/actions/run-execution.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 6 verification passed: red `node --import tsx --test tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-project-results-lightbox-parity.test.ts`, then green `node --import tsx --test tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-project-results-lightbox-parity.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-project-results-lightbox-parity.test.ts`, and `npm test` with 1041 tests discovered, 1040 pass, 0 fail, 1 skipped.
- Phase 6 slice 7 narrowed project-detail run, rename, edit, and censor controls to import from `src/lib/actions/run-execution.ts`, `src/lib/actions/section.ts`, `src/lib/actions/project.ts`, and `src/lib/actions/censoring.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 7 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1042 tests discovered, 1041 pass, 0 fail, 1 skipped.
- Phase 6 slice 8 narrowed `src/components/prompt-block-editor.tsx` and `src/components/section-editor.tsx` to import `PromptBlockData` and prompt-block mutation actions from `src/lib/actions/prompt-block.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 8 verification passed: red `node --import tsx --test tests/test-section-preset-detail-links.test.ts`, then green `node --import tsx --test tests/test-section-preset-detail-links.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-section-preset-detail-links.test.ts`, and `npm test` with 1043 tests discovered, 1042 pass, 0 fail, 1 skipped.
- Phase 6 slice 9 narrowed `src/app/projects/projects-client.tsx` to import project folder actions from `src/lib/actions/project-folder.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 9 verification passed: red `node --import tsx --test tests/test-project-archive-ui-source.test.ts`, then green `node --import tsx --test tests/test-project-archive-ui-source.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-archive-ui-source.test.ts`, and `npm test` with 1044 tests discovered, 1043 pass, 0 fail, 1 skipped.
- Phase 6 slice 10 narrowed `src/app/projects/[projectId]/app-sidebar.tsx` to import `runProject` from `src/lib/actions/run-execution.ts` and `saveProjectAsTemplate` from `src/lib/actions/template-save.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 10 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1045 tests discovered, 1044 pass, 0 fail, 1 skipped.
- Phase 6 slice 11 narrowed `src/app/projects/[projectId]/project-detail-client.tsx` to import project section folder actions from `src/lib/actions/section-folder.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 11 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1046 tests discovered, 1045 pass, 0 fail, 1 skipped.
- Phase 6 slice 12 narrowed `src/app/projects/[projectId]/section-cards.tsx` to import section folder, section, and run execution actions from focused action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 12 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1047 tests discovered, 1046 pass, 0 fail, 1 skipped.
- Phase 6 slice 13 narrowed `src/app/projects/[projectId]/section-actions.tsx` and `src/app/projects/[projectId]/clear-sections-button.tsx` to import section and template actions from focused action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 13 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1048 tests discovered, 1047 pass, 0 fail, 1 skipped.
- Phase 6 slice 14 narrowed `src/app/projects/[projectId]/batch-create/batch-create-client.tsx` to import `createSectionFromTemplate` from `src/lib/actions/section.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 14 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, reran `node --import tsx --test --test-name-pattern "auto-censor runner rejects hung Python CLI after timeout" tests/test-auto-censor-runner.test.ts` after an initial full-suite auto-censor timeout-harness empty-stdout flake, and `npm test` with 1049 tests discovered, 1048 pass, 0 fail, 1 skipped.
- Phase 6 slice 15 narrowed `src/app/projects/[projectId]/sections/[sectionId]/page.tsx` to import `PromptBlockData` from `src/lib/actions/prompt-block.ts` and dynamically import `renameSection` from `src/lib/actions/section.ts` instead of the full `src/lib/actions.ts` barrel, leaving the `src/app/projects/[projectId]/**` exact barrel-import scan clean.
- Phase 6 slice 15 verification passed: red `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, then green `node --import tsx --test tests/test-project-detail-section-batch-size-save.test.ts`, exact barrel-import scan for `src/app/projects/[projectId]/**`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-project-detail-section-batch-size-save.test.ts`, and `npm test` with 1050 tests discovered, 1049 pass, 0 fail, 1 skipped.
- Phase 6 slice 16 narrowed `src/app/assets/presets/preset-manager.tsx` to import preset CRUD, preset sync/cascade, preset category, and preset folder actions from focused action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 16 verification passed: red `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, then green `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-preset-sortable-card-links.test.ts`, and `npm test` with 1051 tests discovered, 1050 pass, 0 fail, 1 skipped.
- Phase 6 slice 17 narrowed `src/app/assets/presets/group-list.tsx` and `src/app/assets/presets/sortable-group-card.tsx` to import preset group and preset folder actions from focused action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 17 verification passed: red `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, then green `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-preset-sortable-card-links.test.ts`, and `npm test` with 1052 tests discovered, 1051 pass, 0 fail, 1 skipped.
- Phase 6 slice 18 narrowed `src/app/assets/presets/preset-form.tsx` to import preset variant delete and reorder actions from `src/lib/actions/preset-variant-crud.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 18 verification passed: red `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, then green `node --import tsx --test tests/test-preset-sortable-card-links.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-preset-sortable-card-links.test.ts`, and `npm test` with 1053 tests discovered, 1052 pass, 0 fail, 1 skipped.
- Phase 6 slice 19 narrowed `src/app/assets/presets/[presetId]/preset-edit-client.tsx` to import preset and variant save actions from `src/lib/actions/preset-variant-crud.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 19 verification passed: red `node --import tsx --test tests/test-preset-variant-save-optimization.test.ts`, then green `node --import tsx --test tests/test-preset-variant-save-optimization.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-preset-variant-save-optimization.test.ts tests/test-preset-detail-neighbors.test.ts`, and `npm test` with 1054 tests discovered, 1053 pass, 0 fail, 1 skipped.
- Phase 6 slice 20 narrowed `src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx` to import preset group actions from `src/lib/actions/preset-group.ts` and slot-template category updates from `src/lib/actions/preset-category.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 20 verification passed: red `node --import tsx --test tests/test-preset-detail-neighbors.test.ts`, then green `node --import tsx --test tests/test-preset-detail-neighbors.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-preset-detail-neighbors.test.ts`, and `npm test` with 1055 tests discovered, 1054 pass, 0 fail, 1 skipped.
- Phase 6 slice 21 narrowed `src/app/assets/templates/templates-list-client.tsx` to import template deletion from `src/lib/actions/template-crud.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 21 verification passed: red `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, then green `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-template-ui-action-imports.test.ts`, and `npm test` with 1056 tests discovered, 1055 pass, 0 fail, 1 skipped.
- Phase 6 slice 22 narrowed `src/app/assets/templates/template-form-client.tsx` to import template CRUD actions from `src/lib/actions/template-crud.ts` and template section-folder actions from `src/lib/actions/section-folder.ts` instead of the full `src/lib/actions.ts` barrel; regenerated `docs/repo-inventory.md` so the tracked template UI import test is classified.
- Phase 6 slice 22 verification passed: red `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, then green `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, `npm run lint`, regenerated inventory with `npx tsx scripts/docs/generate-repo-inventory.ts`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-template-ui-action-imports.test.ts tests/test-preset-section-replacement-entrypoints.test.ts`, and `npm test` with 1057 tests discovered, 1056 pass, 0 fail, 1 skipped.
- Phase 6 slice 23 narrowed `src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx` to import template section save and preset-import resolution actions from `src/lib/actions/template-crud.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 23 verification passed: red `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, then green `node --import tsx --test tests/test-template-ui-action-imports.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-template-ui-action-imports.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/test-section-preset-detail-links.test.ts`, and `npm test` with 1058 tests discovered, 1057 pass, 0 fail, 1 skipped.
- Phase 6 slice 24 narrowed generation template API routes to import template CRUD, template import, and template save actions from focused action modules instead of the full `src/lib/actions.ts` barrel, after checking the local Next.js route-handler docs for handler and params conventions.
- Phase 6 slice 24 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-training-api-boundary.test.ts`, and `npm test` with 1059 tests discovered, 1058 pass, 0 fail, 1 skipped.
- Phase 6 slice 25 narrowed queue and run lifecycle API routes to import cancellation and clear actions from `src/lib/actions/run-lifecycle.ts` instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 25 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `npm run lint`, corrected a mistyped focused-test filename, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-api-request-json.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-clear-active-runs-responsiveness.test.ts tests/test-comfy-queue-cancellation.test.ts`, reran the known flaky auto-censor timeout test after one full-suite empty-stdout JSON parse failure, and `npm test` with 1060 tests discovered, 1059 pass, 0 fail, 1 skipped.
- Phase 6 slice 26 narrowed generation project and section API routes to import project, section, prompt-block, and image-review actions from focused modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 26 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-api-request-json.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-training-api-boundary.test.ts tests/test-zero-redundancy-write-paths.test.ts`, and `npm test` with 1061 tests discovered, 1060 pass, 0 fail, 1 skipped.
- Phase 6 slice 27 narrowed preset-library category and folder API routes to import category, folder, and category-group reorder actions from focused preset action modules instead of the full `src/lib/actions.ts` barrel.
- Phase 6 slice 27 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-api-request-json.test.ts tests/test-preset-sortable-card-links.test.ts tests/test-preset-detail-neighbors.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-training-api-boundary.test.ts`, and `npm test` with 1062 tests discovered, 1061 pass, 0 fail, 1 skipped.
- Phase 6 slice 28 narrowed preset-library group, preset, and variant API routes to import group actions, preset CRUD/reorder actions, sync/cascade/usage actions, and variant resolution from focused preset action modules instead of the full `src/lib/actions.ts` barrel; `src/app/api` no longer imports the full actions barrel.
- Phase 6 slice 28 verification passed: red `node --import tsx --test tests/test-api-request-json.test.ts`, then green `node --import tsx --test tests/test-api-request-json.test.ts`, clean `rg -n "from [\"']@/lib/actions[\"'];|import\\([\"']@/lib/actions[\"']\\)" src/app/api -g '*.ts' -g '*.tsx'`, `npm run lint`, staged `node --import tsx --test tests/test-repo-inventory.test.ts tests/test-api-request-json.test.ts tests/test-preset-sortable-card-links.test.ts tests/test-preset-detail-neighbors.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-training-api-boundary.test.ts`, and `npm test` with 1063 tests discovered, 1062 pass, 0 fail, 1 skipped.
- Phase 6 slice 29 narrowed `src/server/services/agent-preset-variant-service.ts` to import `switchBindingVariant` from `src/lib/actions/prompt-block.ts` instead of the full `src/lib/actions.ts` barrel; `src` no longer imports the full actions barrel outside the barrel module itself.
- Phase 6 slice 29 verification passed: red `node --import tsx --test tests/test-agent-preset-variant-flow-service.test.ts`, then green `node --import tsx --test tests/test-agent-preset-variant-flow-service.test.ts`, clean `rg -n "from [\"']@/lib/actions[\"'];|import\\([\"']@/lib/actions[\"']\\)" src -g '*.ts' -g '*.tsx'`, `npm run lint`, staged `node --import tsx --test tests/test-agent-preset-variant-flow-service.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, and `npm test` with 1064 tests discovered, 1063 pass, 0 fail, 1 skipped.
- Phase 6 slice 30 documented `src/lib/actions.ts` as a compatibility-only server action barrel while keeping focused `src/lib/actions/*` imports as the source-code path, and added a persistent source-contract guard that fails on new direct `@/lib/actions` imports under `src`.
- Phase 6 slice 30 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `npm run lint`, staged `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, and `npm test` with 1065 tests discovered, 1064 pass, 0 fail, 1 skipped.
- Phase 6 slice 31 moved preset resource-scope boundary helpers from `src/lib/actions/preset-resource-scope.ts` to shared `src/lib/preset-resource-scope.ts`, updated action, service, repository, and prompt resolver imports, and regenerated `docs/repo-inventory.md`.
- Phase 6 slice 31 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, staged `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts tests/test-preset-resource-scope.test.ts`, and `npm test` with 1066 tests discovered, 1065 pass, 0 fail, 1 skipped.
- Phase 6 slice 32 documented `src/lib/server-data.ts` as an RSC-only server data facade and added a source-contract guard that allows client layers to import its types only, keeping value imports in RSC pages, route handlers, and server-only services.
- Phase 6 slice 32 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, reran the known flaky auto-censor timeout subtest after one full-suite empty-stdout JSON parse failure, and clean `npm test` with 1067 tests discovered, 1066 pass, 0 fail, 1 skipped.
- Phase 6 slice 33 documented `src/lib/logger.ts` as a server-only logger module and added a source-contract guard keeping client-capable layers from value-importing the Node-backed logger.
- Phase 6 slice 33 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1068 tests discovered, 1067 pass, 0 fail, 1 skipped.
- Phase 6 slice 34 consolidated preset replacement and sync preset variant flow UI API error extraction through the shared client-safe `src/lib/api-error-message.ts` helper while preserving the feature-specific wrapper exports.
- Phase 6 slice 34 verification passed: red `node --import tsx --test tests/test-preset-section-replacement-ui.test.ts tests/test-sync-preset-variant-flow-ui.test.ts`, then green `node --import tsx --test tests/test-preset-section-replacement-ui.test.ts tests/test-sync-preset-variant-flow-ui.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `node --import tsx --test tests/test-preset-section-replacement-ui.test.ts tests/test-sync-preset-variant-flow-ui.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1070 tests discovered, 1069 pass, 0 fail, 1 skipped.
- Phase 6 slice 35 aligned route fallback behavior with work-mode route ownership by adding production Training route patterns to `src/lib/route-fallback.ts` and asserting fallback destinations remain in the inferred work mode.
- Phase 6 slice 35 verification passed: red `node --import tsx --test tests/test-route-fallback.test.ts`, then green `node --import tsx --test tests/test-route-fallback.test.ts`, `node --import tsx --test tests/test-route-fallback.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1071 tests discovered, 1070 pass, 0 fail, 1 skipped.
- Phase 6 slice 36 classified every shared lib listed in Phase 6 as `client-safe`, `server-only`, or `universal`, and added a roadmap source-contract test to keep the labels present for future shared-lib edits.
- Phase 6 slice 36 verification passed: red `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, then green `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts`, `node --import tsx --test tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1072 tests discovered, 1071 pass, 0 fail, 1 skipped.
- Phase 6 slice 37 kept the Character LoRA source-image compatibility helper active by routing training reference-image uploads through `normalizeSourceImageUploadRole`, so old role form fields are still accepted but stored as the ordinary `source` role.
- Phase 6 slice 37 verification passed: red `node --import tsx --test tests/test-character-lora-source-images.test.ts`, then green `node --import tsx --test tests/test-character-lora-source-images.test.ts`, `node --import tsx --test tests/test-character-lora-source-images.test.ts tests/test-training-api-routes.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `node --import tsx --test tests/test-character-lora-source-images.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1074 tests discovered, 1073 pass, 0 fail, 1 skipped.
- Phase 7 slice 38 clarified the root layout shell boundary after reading `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`, `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`, and `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`: standalone root surfaces now flow through `shouldSkipAppShell`, while `src/app/layout.tsx` stays limited to global providers, shell selection, metadata/fonts, and auth-safe header/cookie reads.
- Phase 7 slice 38 verification passed: red `node --import tsx --test tests/test-training-prod-route-shell.test.ts`, then green `node --import tsx --test tests/test-training-prod-route-shell.test.ts`, `node --import tsx --test tests/test-training-prod-route-shell.test.ts tests/test-next16-build-compat-source.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1075 tests discovered, 1074 pass, 0 fail, 1 skipped.
- Phase 7 slice 39 kept `src/proxy.ts` aligned with the local Next 16 Proxy docs after reading `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`: the file keeps the named `proxy` export, a static matcher, no runtime segment config, and a type-only `NextRequest` import.
- Phase 7 slice 39 verification passed: red `node --import tsx --test tests/test-proxy-dev-internal-paths.test.ts`, then green `node --import tsx --test tests/test-proxy-dev-internal-paths.test.ts`, `node --import tsx --test tests/test-proxy-dev-internal-paths.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1076 tests discovered, 1075 pass, 0 fail, 1 skipped.
- Phase 7 slice 40 documented the instrumentation runtime split after reading `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`, and the Node-only OpenTelemetry section of `node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md`: `src/instrumentation.ts` remains import-free and Node-gated, while `src/instrumentation.node.ts` owns Prisma, process hooks, queue recovery, and ComfyUI startup side effects.
- Phase 7 slice 40 verification passed: red `node --import tsx --test tests/test-instrumentation-boundary.test.ts`, then green `node --import tsx --test tests/test-instrumentation-boundary.test.ts`, `node --import tsx --test tests/test-instrumentation-boundary.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1078 tests discovered, 1077 pass, 0 fail, 1 skipped.
- Phase 7 slice 41 reviewed global CSS variables against `DESIGN.md` and `docs/frontend-design-guide.md`: active `globals.css` primitives now follow the current DESIGN light/dark canvas and text surfaces, while `src/app/design-system.css` keeps the legacy guide scaffold complete for spacing, display type, motion, easing, and breakpoint tokens.
- Phase 7 slice 41 verification passed: red `node --import tsx --test tests/test-global-css-design-tokens.test.ts`, then green `node --import tsx --test tests/test-global-css-design-tokens.test.ts`, `node --import tsx --test tests/test-global-css-design-tokens.test.ts tests/test-next16-build-compat-source.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1080 tests discovered, 1079 pass, 0 fail, 1 skipped.
- Phase 7 slice 42 defined project page route/container boundaries for list, create, detail, edit, batch-create, section edit, section results, and project results after inspecting the current route files and broad client modules. The boundary map records which files own data loading, search-param validation, state, rendering, lightbox/review behavior, and the later split checkpoints before project UI modules are moved.
- Phase 7 slice 42 verification passed: red `node --import tsx --test tests/test-project-page-boundaries.test.ts`, then green `node --import tsx --test tests/test-project-page-boundaries.test.ts`, `node --import tsx --test tests/test-project-page-boundaries.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1081 tests discovered, 1080 pass, 0 fail, 1 skipped.
- Phase 7 slice 43 moved project list filtering, archive visibility, folder breadcrumb derivation, and selection state into `src/app/projects/project-list-view-model.ts` and `src/app/projects/use-project-list-view-state.ts`. `src/app/projects/projects-client.tsx` now consumes the hook and keeps folder mutations/rendering local until the later project UI splits.
- Phase 7 slice 43 verification passed: red `node --import tsx --test tests/test-project-list-view-state.test.ts`, then green `node --import tsx --test tests/test-project-list-view-state.test.ts`, `node --import tsx --test tests/test-project-list-view-state.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1083 tests discovered, 1082 pass, 0 fail, 1 skipped.
- Phase 7 slice 44 moved project detail section card rendering into `src/app/projects/project-section-card-components.tsx` with typed `ProjectSectionCardData` props. `src/app/projects/[projectId]/section-cards.tsx` still owns selection, drag/reorder, batch run/delete, folder move mutations, and route-specific action slots.
- Phase 7 slice 44 verification passed: red `node --import tsx --test tests/test-project-section-card-components.test.ts`, then green `node --import tsx --test tests/test-project-section-card-components.test.ts`, `node --import tsx --test tests/test-project-section-card-components.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-run-submission-deferral.test.ts tests/test-project-detail-section-batch-size-save.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1084 tests discovered, 1083 pass, 0 fail, 1 skipped.
- Phase 7 slice 45 moved project results filtered lightbox cursor, previous-sequence replacement, and next/previous navigation state into `src/lib/use-review-lightbox-state.ts`. `src/app/projects/[projectId]/results/project-results-client.tsx` still owns image mutation state, marker undo, quick-censor mode, and route-specific keyboard actions.
- Phase 7 slice 45 verification passed: red `node --import tsx --test tests/test-project-results-lightbox-parity.test.ts`, then green `node --import tsx --test tests/test-project-results-lightbox-parity.test.ts`, `node --import tsx --test tests/test-project-results-lightbox-parity.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1085 tests discovered, 1084 pass, 0 fail, 1 skipped.
- Phase 7 slice 46 moved project results filter state, result counts, filtered section derivation, and image aggregation into `src/app/projects/[projectId]/results/use-project-results-filter-state.ts`. `src/app/projects/[projectId]/results/project-results-client.tsx` now consumes the hook while it still owns the toolbar rendering, section/gallery cards, lightbox shell, and mutation callbacks for the remaining split checkpoints.
- Phase 7 slice 46 verification passed: red `node --import tsx --test tests/test-project-results-client-split.test.ts`, then green `node --import tsx --test tests/test-project-results-client-split.test.ts`, `node --import tsx --test tests/test-auto-censor-runner.test.ts tests/test-project-results-review-counts.test.ts tests/test-project-results-client-split.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1086 tests discovered, 1085 pass, 0 fail, 1 skipped.
- Phase 7 slice 47 moved project results toolbar and filter-control rendering into `src/app/projects/[projectId]/results/project-results-toolbar.tsx`. The route now delegates the sticky header, marker filter buttons, censored-mode toggle, and trash-all trigger while it still owns gallery cards, the lightbox shell, and mutation callbacks.
- Phase 7 slice 47 verification passed: red `node --import tsx --test tests/test-project-results-client-split.test.ts`, then green `node --import tsx --test tests/test-project-results-client-split.test.ts`, `node --import tsx --test tests/test-project-results-client-split.test.ts tests/test-project-results-review-counts.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1087 tests discovered, 1086 pass, 0 fail, 1 skipped.
- Phase 7 slice 48 moved project results section/gallery rendering into `src/app/projects/[projectId]/results/project-results-gallery.tsx`. `project-results-client.tsx` now delegates result cards, per-section summary counts, collapse/expand rendering, and section-result links while it still owns empty-state routing, the lightbox shell, and mutation callbacks.
- Phase 7 slice 48 verification passed: red `node --import tsx --test tests/test-project-results-client-split.test.ts`, then green `node --import tsx --test tests/test-project-results-client-split.test.ts`, `node --import tsx --test tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-project-results-client-split.test.ts tests/test-project-results-review-counts.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1088 tests discovered, 1087 pass, 0 fail, 1 skipped.
- Phase 7 slice 49 moved project results lightbox shell rendering into `src/app/projects/[projectId]/results/project-results-lightbox.tsx`. `project-results-client.tsx` now passes route-owned review, marker, quick-censor, auto-censor, navigation, and close handlers into the lightbox component while keyboard shortcuts and mutation callbacks remain route-owned.
- Phase 7 slice 49 verification passed: red `node --import tsx --test tests/test-project-results-client-split.test.ts`, then green `node --import tsx --test tests/test-project-results-client-split.test.ts`, `node --import tsx --test tests/test-project-results-client-split.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-project-results-review-counts.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1089 tests discovered, 1088 pass, 0 fail, 1 skipped.
- Phase 7 slice 50 moved project results mutation behavior into `src/app/projects/[projectId]/results/use-project-results-mutations.ts`. `project-results-client.tsx` now owns route/view coordination, sidebar state, collapse state, keyboard shortcuts, and lightbox display mode while delegating marker, cover, review, manual/auto censor, trash-all, busy-state, undo-stack, and optimistic image updates to the adapter hook.
- Phase 7 slice 50 verification passed: red `node --import tsx --test tests/test-project-results-client-split.test.ts`, then green `node --import tsx --test tests/test-project-results-client-split.test.ts`, `node --import tsx --test tests/test-project-results-client-split.test.ts tests/test-project-results-lightbox-parity.test.ts tests/test-project-results-review-counts.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1090 tests discovered, 1089 pass, 0 fail, 1 skipped.
- Phase 7 slice 51 marked the project-page hard-navigation and G-shortcut coverage checkpoints complete after confirming `tests/test-hard-navigation-for-image-heavy-pages.test.ts` covers document navigation for image-heavy exits and visible next-pending links, while `tests/test-review-lightbox-optimistic-navigation.test.ts` covers lightbox G, page-level G, optimistic next-pending state, and empty-section availability.
- Phase 7 slice 51 verification passed: `node --import tsx --test tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts` with 33 tests discovered, 33 pass, 0 fail.
- Phase 7 slice 52 added `src/app/projects/project-loading-skeletons.tsx` as the shared project loading primitive module while keeping the four project route `loading.tsx` files colocated with their route segments. Project detail, project results, section edit, and section results loading states now compose shared action-bar, block, grid, and sidebar skeleton primitives.
- Phase 7 slice 52 verification passed: red `node --import tsx --test tests/test-project-loading-skeletons.test.ts`, then green `node --import tsx --test tests/test-project-loading-skeletons.test.ts`, `node --import tsx --test tests/test-project-loading-skeletons.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1091 tests discovered, 1090 pass, 0 fail, 1 skipped.
- Phase 7 slice 53 moved model/LoRA file-manager browse helpers into `src/app/assets/model-file-manager-shared.ts`. `model-file-manager.tsx` and the legacy `lora-file-manager.tsx` now share the browse item/result types, file-size formatter, and path-segment helper while keeping resource-specific API endpoints, metadata UI, and upload/move behavior in their own managers.
- Phase 7 slice 53 verification passed: red `node --import tsx --test tests/test-asset-file-manager-shared.test.ts`, then green `node --import tsx --test tests/test-asset-file-manager-shared.test.ts`, `node --import tsx --test tests/test-asset-file-manager-shared.test.ts tests/test-lora-model-navigation.test.ts tests/test-model-civitai-info-panel.test.ts tests/test-model-search-filter.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1092 tests discovered, 1091 pass, 0 fail, 1 skipped.
- Phase 7 slice 54 documented the asset page resource-type split in the Asset Page Boundary Map. Model files, LoRA files, preset library, preset groups, and templates now have explicit route/container boundaries, UI/state owners, and follow-up split checkpoints backed by `tests/test-asset-page-boundaries.test.ts`.
- Phase 7 slice 54 verification passed: red `node --import tsx --test tests/test-asset-page-boundaries.test.ts`, then green `node --import tsx --test tests/test-asset-page-boundaries.test.ts`, `node --import tsx --test tests/test-asset-page-boundaries.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1093 tests discovered, 1092 pass, 0 fail, 1 skipped.
- Phase 7 slice 55 moved `preset-form.tsx` autosave queue state into `src/app/assets/presets/use-preset-save-queue.ts`. The form still owns preset/variant field state and rendering, while the hook now owns save status, queued latest-payload behavior, explicit retry of failed payloads, and React 19-safe external-store subscription.
- Phase 7 slice 55 verification passed: red `node --import tsx --test tests/test-preset-save-queue.test.ts`, red `node --import tsx --test tests/test-repo-inventory.test.ts` for preset-owned queue inventory classification, then green `node --import tsx --test tests/test-preset-save-queue.test.ts tests/test-preset-variant-save-optimization.test.ts`, green `node --import tsx --test tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1098 tests discovered, 1097 pass, 0 fail, 1 skipped.
- Phase 7 slice 56 moved preset variant-list rendering, DnD wiring, sortable row rendering, and add/delete controls into `src/app/assets/presets/preset-variant-list.tsx`. `preset-form.tsx` now delegates the list surface while keeping selected-index updates, server reorder persistence, and variant editor fields in the form container.
- Phase 7 slice 56 verification passed: red `node --import tsx --test tests/test-preset-form-split.test.ts`, then green `node --import tsx --test tests/test-preset-form-split.test.ts tests/test-preset-save-queue.test.ts tests/test-preset-variant-save-optimization.test.ts`, `node --import tsx --test tests/test-preset-form-split.test.ts tests/test-preset-save-queue.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1100 tests discovered, 1099 pass, 0 fail, 1 skipped.
- Phase 7 slice 57 moved preset variant bulk apply copy logic into `src/app/assets/presets/preset-variant-bulk-apply.ts`. `preset-form.tsx` still owns button handlers and save coordination, while prompt copy, LoRA update/append, blank-path no-op, nested clone helpers, and incomplete LoRA detection are covered as pure utilities.
- Phase 7 slice 57 verification passed: red `node --import tsx --test tests/test-preset-variant-bulk-apply.test.ts`, then green `node --import tsx --test tests/test-preset-variant-bulk-apply.test.ts tests/test-preset-form-split.test.ts tests/test-preset-save-queue.test.ts`, `node --import tsx --test tests/test-preset-variant-bulk-apply.test.ts tests/test-preset-form-split.test.ts tests/test-preset-save-queue.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1105 tests discovered, 1104 pass, 0 fail, 1 skipped.
- Phase 7 slice 58 moved current preset variant field editing into `src/app/assets/presets/preset-variant-editor.tsx`. `preset-form.tsx` now delegates linked-variant picker rendering, prompt fields, LoRA editors, apply-to-all controls, and change history while keeping variant state mutations and save coordination in the form container.
- Phase 7 slice 58 verification passed: red `node --import tsx --test tests/test-preset-form-split.test.ts`, then green `node --import tsx --test tests/test-preset-form-split.test.ts`, green `node --import tsx --test tests/test-preset-form-split.test.ts tests/test-preset-variant-bulk-apply.test.ts tests/test-preset-save-queue.test.ts tests/test-preset-variant-save-optimization.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1106 tests discovered, 1105 pass, 0 fail, 1 skipped.
- Phase 7 slice 59 moved preset form autosave status rendering into `src/app/assets/presets/preset-form-action-footer.tsx`. `preset-form.tsx` now only decides when to show the status surface and passes save status, error text, and retry action into the focused component.
- Phase 7 slice 59 verification passed: red `node --import tsx --test tests/test-preset-form-split.test.ts`, then green `node --import tsx --test tests/test-preset-form-split.test.ts`, green `node --import tsx --test tests/test-preset-form-split.test.ts tests/test-preset-save-queue.test.ts tests/test-preset-variant-bulk-apply.test.ts tests/test-preset-variant-save-optimization.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1107 tests discovered, 1106 pass, 0 fail, 1 skipped.
- Phase 7 slice 60 marked preset group slot ordering as owned by category slot template logic after verifying `preset-group-edit-client.tsx` persists fixed-slot row reorders through `updateCategorySlotTemplate`, and `getSectionPresetBindingGroupName()` resolves display order from the group category `slotTemplate`.
- Phase 7 slice 60 verification passed: `node --import tsx --test tests/test-section-editor-binding-rules.test.ts tests/test-preset-group-member-replacement-source.test.ts tests/test-repo-inventory.test.ts` with 25 tests discovered, 25 pass, 0 fail.
- Phase 7 slice 61 moved template section prompt-block rendering into `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx`. The broad section detail client now delegates the `TemplatePromptBlockEditor` surface while keeping prompt-block state and save scheduling in the route client until the larger section-detail split continues.
- Phase 7 slice 61 verification passed: red `node --import tsx --test tests/test-template-section-detail-split.test.ts`, then green `node --import tsx --test tests/test-template-section-detail-split.test.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-template-ui-action-imports.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1108 tests discovered, 1107 pass, 0 fail, 1 skipped.
- Phase 7 slice 62 moved template section LoRA rendering into `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-lora-editor.tsx`. The broad section detail client now delegates both LoRA columns and standalone-delete wiring while keeping LoRA state mutation and save scheduling in the route client.
- Phase 7 slice 62 verification passed: red `node --import tsx --test tests/test-template-section-detail-split.test.ts`, then green `node --import tsx --test tests/test-template-section-detail-split.test.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-template-ui-action-imports.test.ts tests/test-lora-model-navigation.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1109 tests discovered, 1108 pass, 0 fail, 1 skipped.
- Phase 7 slice 63 moved template section preset-binding rendering into `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-preset-bindings.tsx`. The broad section detail client now delegates imported preset count, detail links, variant selector, import panel, use-name, standalone-delete, and cascade-delete rendering while keeping import/switch/delete behavior in the route client.
- Phase 7 slice 63 verification passed: red `node --import tsx --test tests/test-template-section-detail-split.test.ts`, then green `node --import tsx --test tests/test-template-section-detail-split.test.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-template-ui-action-imports.test.ts tests/test-section-preset-detail-links.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1110 tests discovered, 1109 pass, 0 fail, 1 skipped.
- Phase 7 slice 64 moved template section form rendering into `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-form.tsx`. The broad section detail client now delegates name, notes, checkpoint, aspect-ratio, batch-size, upscale, two-stage KSampler, and KSampler panel rendering while keeping state, autosave, and route navigation in the route client.
- Phase 7 slice 64 verification passed: red `node --import tsx --test tests/test-template-section-detail-split.test.ts`, then green `node --import tsx --test tests/test-template-section-detail-split.test.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-template-ui-action-imports.test.ts tests/test-section-preset-detail-links.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1111 tests discovered, 1110 pass, 0 fail, 1 skipped.
- Phase 7 slice 65 moved template section navigation rendering into `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-navigation.tsx`. `section-detail-client.tsx` now stays below the broad-client review threshold as the route/state orchestration container, and the template section route has no change-history surface to extract.
- Phase 7 slice 65 verification passed: red `node --import tsx --test tests/test-template-section-detail-split.test.ts`, then green `node --import tsx --test tests/test-template-section-detail-split.test.ts`, green `node --import tsx --test tests/test-template-section-detail-split.test.ts tests/test-template-ui-action-imports.test.ts tests/test-section-preset-detail-links.test.ts tests/test-shared-neighbor-navigation-usage.test.ts tests/text-editor-mobile-height.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1113 tests discovered, 1112 pass, 0 fail, 1 skipped.
- Phase 7 slice 66 locked the preset sort-rules boundary with a source contract: `src/app/assets/presets/sort-rules/sort-rules-editor.tsx` owns its local dimension order state and `updateCategorySortOrders`, while `preset-form.tsx` and `[presetId]/preset-edit-client.tsx` stay limited to preset/variant editing state.
- Phase 7 slice 66 verification passed: green `node --import tsx --test tests/test-preset-form-split.test.ts`, green `node --import tsx --test tests/test-preset-form-split.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1114 tests discovered, 1113 pass, 0 fail, 1 skipped.
- Phase 7 slice 67 moved pending queue review-group rendering and pagination links into `src/app/queue/queue-pending-tab.tsx`. `queue-page-client.tsx` still owns tab state, polling, running controls, censoring, failed runs, and trash/restore until the remaining queue split subchecks are handled.
- Phase 7 slice 67 verification passed: red `node --import tsx --test tests/test-queue-page-client-split.test.ts`, then green `node --import tsx --test tests/test-queue-page-client-split.test.ts`, green `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-autopoll-no-router-refresh.test.ts tests/test-queue-trash-restore.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-run-submission-deferral.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1115 tests discovered, 1114 pass, 0 fail, 1 skipped.
- Phase 7 slice 68 moved active running-run rendering, progress bars, and per-run/bulk control buttons into `src/app/queue/queue-running-tab.tsx`, with reusable censoring progress cards in `src/app/queue/queue-censoring-progress-card.tsx`. `queue-page-client.tsx` now passes queue-control callbacks into the focused running tab while keeping the actual API/action coordination local.
- Phase 7 slice 68 verification passed: red `node --import tsx --test tests/test-queue-page-client-split.test.ts`, then green `node --import tsx --test tests/test-queue-page-client-split.test.ts`, green `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-autopoll-no-router-refresh.test.ts tests/test-queue-trash-restore.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-run-submission-deferral.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1116 tests discovered, 1115 pass, 0 fail, 1 skipped.
- Phase 7 slice 69 moved queue trash tab rendering, restore buttons, clear action surface, and trash pagination controls into `src/app/queue/queue-trash-tab.tsx`. `queue-page-client.tsx` still owns trash state and restore/clear callbacks until the final trash-state hook split.
- Phase 7 slice 69 verification passed: red `node --import tsx --test tests/test-queue-page-client-split.test.ts`, then green `node --import tsx --test tests/test-queue-page-client-split.test.ts`, green `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-trash-restore.test.ts tests/test-queue-autopoll-no-router-refresh.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-run-submission-deferral.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1117 tests discovered, 1116 pass, 0 fail, 1 skipped.
- Phase 7 slice 70 moved queue trash local items, pagination, visible pages, restore, clear, and page-change callbacks into `src/app/queue/use-queue-trash-state.ts`. `queue-page-client.tsx` still owns queue-data refresh orchestration and passes refresh results into the trash hook through `applyTrashRefresh`.
- Phase 7 slice 70 verification passed: red `node --import tsx --test tests/test-queue-page-client-split.test.ts`, red `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-trash-restore.test.ts`, then green `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-trash-restore.test.ts`, green `node --import tsx --test tests/test-queue-page-client-split.test.ts tests/test-queue-trash-restore.test.ts tests/test-queue-autopoll-no-router-refresh.test.ts tests/test-queue-control-progress-stream.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-run-submission-deferral.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1118 tests discovered, 1117 pass, 0 fail, 1 skipped.
- Phase 7 slice 71 moved queue review image card rendering, label/status badges, and featured/preview/cover marker badges into `src/app/queue/[runId]/queue-review-image-card.tsx`. `review-grid.tsx` still owns selection state, keyboard shortcuts, and batch action coordination for the remaining review-grid split subchecks.
- Phase 7 slice 71 verification passed: red `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, then green `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, green `node --import tsx --test tests/test-queue-review-grid-split.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1119 tests discovered, 1118 pass, 0 fail, 1 skipped.
- Phase 7 slice 72 moved queue review selection toolbar rendering into `src/app/queue/[runId]/queue-review-selection-toolbar.tsx`. `review-grid.tsx` still owns the selected-id state and helpers until the selection-state hook split.
- Phase 7 slice 72 verification passed: red `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, then green `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, green `node --import tsx --test tests/test-queue-review-grid-split.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1120 tests discovered, 1119 pass, 0 fail, 1 skipped.
- Phase 7 slice 73 moved queue review selected-id state, selected-id derivations, select-all/pending helpers, and add/remove selected helpers into `src/app/queue/[runId]/use-queue-review-selection.ts`. `review-grid.tsx` still owns batch review actions and page-level keyboard shortcut wiring until the remaining review-grid split subchecks.
- Phase 7 slice 73 verification passed: red `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, then green `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, green `node --import tsx --test tests/test-queue-review-grid-split.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1121 tests discovered, 1120 pass, 0 fail, 1 skipped.
- Phase 7 slice 74 moved queue review batch keep/trash buttons, remaining-pending derivation, and handle-rest-next navigation actions into `src/app/queue/[runId]/queue-review-batch-actions.tsx`. `review-grid.tsx` still owns page-level keyboard shortcut wiring until the final review-grid split subcheck.
- Phase 7 slice 74 verification passed: red `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, then green `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, green `node --import tsx --test tests/test-queue-review-grid-split.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1122 tests discovered, 1121 pass, 0 fail, 1 skipped.
- Phase 7 slice 75 moved queue review page-level keyboard shortcut wiring into `src/app/queue/[runId]/use-queue-review-keyboard-shortcuts.ts`. The queue review grid split checkpoint is now complete: `review-grid.tsx` delegates image cards, selection toolbar, selection state, batch actions, and page-level keyboard shortcuts to focused modules.
- Phase 7 slice 75 verification passed: red `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, then green `node --import tsx --test tests/test-queue-review-grid-split.test.ts`, green `node --import tsx --test tests/test-queue-review-grid-split.test.ts tests/test-review-lightbox-optimistic-navigation.test.ts tests/test-hard-navigation-for-image-heavy-pages.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1123 tests discovered, 1122 pass, 0 fail, 1 skipped.
- Phase 7 slice 76 added `tests/test-settings-operational-dashboards.test.ts` to guard production settings pages as operational dashboards: the entry page stays limited to SFW/monitor/logs, settings pages avoid generation/training business imports, logs only poll `/api/logs`, and monitor only calls Comfy operational endpoints.
- Phase 7 slice 76 verification passed: green `node --import tsx --test tests/test-settings-operational-dashboards.test.ts`, green `node --import tsx --test tests/test-settings-operational-dashboards.test.ts tests/test-training-prod-route-shell.test.ts tests/test-work-mode-resource-boundary.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1127 tests discovered, 1126 pass, 0 fail, 1 skipped.
- Phase 8 slice 77 added `tests/test-training-feature-entry-boundaries.test.ts` to guard the Training frontend entry/runtime boundary: the app route page stays server-only and route-entry focused, `training-app-client.tsx` remains a thin re-export until it owns client state, `app.tsx` owns route matching and page dispatch, `routes.ts` resolves known production paths with runtime tests, `runtime.ts` exports only primitives, and `shell.tsx` keeps Training chrome while disabling inherited demo sidebar behavior.
- Phase 8 slice 77 verification passed: green `node --import tsx --test tests/test-training-feature-entry-boundaries.test.ts`, green `node --import tsx --test tests/test-training-feature-entry-boundaries.test.ts tests/test-training-prod-route-shell.test.ts tests/test-training-route-data-source.test.ts tests/test-training-route-data-loading.test.ts tests/test-training-list-layout.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1133 tests discovered, 1132 pass, 0 fail, 1 skipped.
- Phase 8 slice 78 moved the first batch of pure project-page helpers into `src/features/training/ui/project-page-utils.ts`: project/section route lookup, project-section state keys, scene block reordering and ID ordinals, seed-section copy ordinals, section copy/draft ordinals, project-create template query hints, production `/training` path detection, and project trigger token normalization. The broad `training-project-pages.tsx` now imports those helpers while page behavior remains unchanged.
- Phase 8 slice 78 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, then green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, `npm run lint`, and `npm test` with 1133 tests discovered, 1132 pass, 0 fail, 1 skipped.
- Phase 8 slice 79 moved the second batch of pure project-page helpers into `src/features/training/ui/project-page-utils.ts`: profile revision guards/config/formatters, review status labels and API mapping, reference kind labels, dataset caption/version helpers, local dataset revision construction, project-run status labels, and scene block preview text. `training-project-pages.tsx` now imports these display/data helpers while keeping component state and JSX local.
- Phase 8 slice 79 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, then green `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1134 tests discovered, 1133 pass, 0 fail, 1 skipped.
- Phase 8 slice 80 moved reference upload preview helpers into `src/features/training/ui/project-page-utils.ts`: reusable `ReferenceCandidate` and `SupplementalImageAttachment` types, local project-reference upload preview construction, uploaded reference-image mapping, and uploaded supplemental-image mapping. `training-project-pages.tsx` now imports these browser-safe mapping helpers while the form, profile upload, and generation compose state remain page-local.
- Phase 8 slice 80 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, then green `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1135 tests discovered, 1134 pass, 0 fail, 1 skipped.
- Phase 8 slice 81 moved `runPreviewImages` into `src/features/training/ui/project-page-utils.ts` and closed the pure-helper extraction checkpoint. `training-project-pages.tsx` now keeps page constants, state hooks, DOM/CSS-bound clipboard fallback, and JSX components local while pure route lookup, state-key, ordinal, review, dataset, upload, status, and run-preview helpers live in the utility module.
- Phase 8 slice 81 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, initial `npm test` found one stale source marker in `tests/test-training-image-thumbnail-contract.test.ts`, then green `node --import tsx --test tests/test-training-image-thumbnail-contract.test.ts tests/test-training-project-pages.test.ts`, `npm run lint`, and `npm test` with 1135 tests discovered, 1134 pass, 0 fail, 1 skipped.
- Phase 8 slice 82 moved `useUrlSearch` into `src/features/training/ui/use-url-search.ts` as the first focused hook split. `training-project-pages.tsx` now imports the hook while the Next `useSearchParams` dependency and query-string conversion live in the hook module; the remaining upload preview, section draft, reference picker, and result review hook/state splits stay open.
- Phase 8 slice 82 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1136 tests discovered, 1135 pass, 0 fail, 1 skipped.
- Phase 8 slice 83 moved new-project staged reference upload draft previews into `src/features/training/ui/use-project-reference-upload-drafts.ts`. The create page still owns the file input, toasts, selection, and create-project API flow, while the focused hook owns template-scoped upload draft state, duplicate filtering, and preview-reference construction.
- Phase 8 slice 83 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1137 tests discovered, 1136 pass, 0 fail, 1 skipped.
- Phase 8 slice 84 moved create-project reference picker state into `src/features/training/ui/use-project-reference-selection.ts`. The form now consumes active preview, selected IDs, and add/preview handlers from the hook, while the hook owns template-context fallback and selected-reference reset behavior; generation compose reference picker state remains local for a later slice.
- Phase 8 slice 84 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, then green `node --import tsx --test tests/test-training-project-pages.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1138 tests discovered, 1137 pass, 0 fail, 1 skipped.
- Phase 8 slice 85 moved section-detail draft storage into `src/features/training/ui/use-project-section-draft.ts`. `training-project-pages.tsx` still builds the section draft, owns the save/API flow, and renders the visible draft panel, while the hook owns keyed draft state and active draft lookup.
- Phase 8 slice 85 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, an expected stale `tests/test-training-section-workflow.test.ts` source-contract failure followed by updated hook-aware assertions, green `node --import tsx --test tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1139 tests discovered, 1138 pass, 0 fail, 1 skipped.
- Phase 8 slice 86 moved generation compose reference preview and selected-reference state into `src/features/training/ui/use-generation-compose-reference-selection.ts`. The compose page still owns reference source construction, selected-reference derivation, final input composition, supplemental images, and generation-task queueing, while the hook owns project-section-scoped preview/add/remove state.
- Phase 8 slice 86 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1140 tests discovered, 1139 pass, 0 fail, 1 skipped.
- Phase 8 slice 87 moved generation compose task type and supplemental prompt form state into `src/features/training/ui/use-generation-compose-form.ts`. The hook owns the default prompt, route-scoped form state, and update handler; the compose page still owns final input assembly, draft transport, supplemental images, and queue/run API behavior.
- Phase 8 slice 87 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1141 tests discovered, 1140 pass, 0 fail, 1 skipped.
- Phase 8 slice 88 moved generation compose supplemental image attachment state into `src/features/training/ui/use-generation-supplemental-images.ts`. The hook owns project-section-scoped attachment storage, duplicate filtering, local add, and local remove behavior; the compose page still owns upload/delete HTTP calls, toasts, supplemental candidate construction, final input assembly, and queue/run behavior.
- Phase 8 slice 88 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1142 tests discovered, 1141 pass, 0 fail, 1 skipped.
- Phase 8 slice 89 moved generation compose task draft visibility and draft task-id state into `src/features/training/ui/use-generation-task-draft.ts`. The hook owns the draft shape, project-section-scoped visible draft lookup, transport task-id storage, and explicit task-id remembering; the compose page still owns draft creation/update HTTP calls, final input construction, supplemental input posting, preview, run, toasts, and navigation.
- Phase 8 slice 89 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1143 tests discovered, 1142 pass, 0 fail, 1 skipped.
- Phase 8 slice 90 moved section-detail scene-block state into `src/features/training/ui/use-project-section-scene-blocks.ts`. The hook owns project-section-keyed block storage, route-scoped edit state, scene preview derivation, update/replace actions, and edit toggling; the section detail page still owns preset import UI, production scene-block HTTP mutations, save-section HTTP flow, result review state, toasts, and draft save calls.
- Phase 8 slice 90 verification passed: red `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts`, `npx tsx scripts/docs/generate-repo-inventory.ts`, green `node --import tsx --test tests/test-training-project-pages.test.ts tests/test-training-section-workflow.test.ts tests/test-repo-inventory.test.ts`, `npm run lint`, and `npm test` with 1144 tests discovered, 1143 pass, 0 fail, 1 skipped.

## Phase 1: Root Configuration And Tooling

**Purpose:** Make tooling encode repo boundaries so later refactors are safer.

**Files:**
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `eslint.config.mjs`
- `next.config.ts`
- `postcss.config.mjs`
- `prisma.config.ts`
- `components.json`
- `.gitignore`
- `.env.example`
- `docker-compose.yml`
- `start-server.bat`

- [ ] Split `package.json` scripts into groups: dev, build, test, prisma, db, quality, training workers, maintenance.
- [ ] Add explicit script names for targeted test classes if missing: pure unit, DB integration, route tests, source contract tests, design-demo tests.
- [ ] Decide whether `npm test` should remain `node --import tsx --test tests/*.test.ts` or become a meta-runner that excludes environment-dependent DB tests by default.
- [ ] Add a script for `typecheck` if the repo wants an explicit `tsc --noEmit` gate separate from `next build`.
- [ ] Keep `next.config.ts` `runtimeTraceExcludes` documented; move the `broadPatternIssuePaths` list into a named section with comments that point to the owning modules.
- [ ] Audit every entry in `next.config.ts` `broadPatternIssuePaths`; for each file, either reduce broad file patterns in that module or keep a documented exception.
- [ ] Review `tsconfig.json` `allowJs`, `skipLibCheck`, `include`, and runtime excludes; keep excludes aligned with `.gitignore` and `eslint.config.mjs`.
- [ ] Add explicit generated-code lint ignores for `src/generated/**` and any generated Prisma SQLite output if ESLint scans them.
- [ ] Review `.env.example` against `src/lib/env.ts`, `src/server/services/comfy-target.ts`, auto-censor settings, DB provider settings, and auth token requirements.
- [ ] Check `.gitignore` includes every runtime file named in `AGENTS.md`: `.deploy.lock/`, `server-dev-3000.log`, `server-dev-3000.err.log`, `server-prod-3001.log`, `server-prod-3001.err.log`, and `build-prod*.log`.
- [ ] Document `docker-compose.yml` as PostgreSQL-only and keep SQLite setup separate in README/local verification docs.
- [ ] Decide whether `start-server.bat` remains supported; if it remains, document exactly which port and environment it targets.

## Phase 2: Prisma, Database, And Data Model Governance

**Purpose:** Make PostgreSQL and SQLite schemas intentionally compatible and make migrations auditable.

**Files and directories:**
- `prisma/schema.prisma`
- `prisma/schema.sqlite.prisma`
- `prisma/migrations/**`
- `prisma/migrations-sqlite/**`
- `prisma/seed.ts`
- `prisma.config.ts`
- `scripts/db/migrate-zero-redundancy.ts`
- `scripts/db/verify-zero-redundancy.ts`
- `scripts/db/collapse-preset-group-bindings.ts`
- `tests/test-zero-redundancy-*.test.ts`
- `tests/test-collapse-preset-group-bindings.test.ts`
- `src/lib/prisma.ts`
- `src/lib/db.ts`
- `src/generated/prisma.ts`

- [x] Create a schema compatibility checklist for every model shared by `schema.prisma` and `schema.sqlite.prisma`.
- [x] Group schema models by domain in comments: preset library, training, generation project/template, run/image/trash, censoring, assets, audit, locks.
- [x] Verify all enums exist where provider support allows; where SQLite differs, document the mapping.
- [x] Ensure every relation model has documented uniqueness and parent scope: `SectionPresetBinding`, `TemplateSectionPresetBinding`, project/template preset bindings, linked variants, manual LoRA entries.
- [x] Audit legacy fields and compatibility fields: linked variant JSON, legacy prompt fields, deprecated seed policies, legacy character LoRA values.
- [x] Decide which legacy fields are read-only compatibility surfaces and which can be removed after migration.
- [x] Make `scripts/db/migrate-zero-redundancy.ts` expose dry-run, write, source DB path, provider, and verifier arguments consistently.
- [x] Make `scripts/db/verify-zero-redundancy.ts` return machine-readable nonzero exit codes for mismatch classes.
- [x] Make `scripts/db/collapse-preset-group-bindings.ts` use the same logging and dry-run conventions as zero-redundancy scripts.
- [x] Move DB test setup helpers into a reusable test fixture module so DB tests do not each hand-roll `better-sqlite3` setup.
- [x] Keep `prisma/data/comfyui.db` classified as local runtime data; confirm whether it should be removed from tracking or explicitly retained as a fixture.
- [x] Update tests that inspect schema text to use helper functions rather than repeated ad hoc `fs.readFileSync` scans.
- [x] Add a provider matrix to docs: commands for PostgreSQL generate/migrate, SQLite generate/db push, and test-only in-memory/file DB.

## Phase 3: API Route Handler Thin Layer

**Purpose:** Make every route handler a predictable adapter around auth, input parsing, service call, and response envelope.

**Global route files:**
- `src/app/api/health/route.ts`
- `src/app/api/auth/verify/route.ts`
- `src/app/api/logs/route.ts`
- `src/app/api/audit-logs/route.ts`
- `src/app/api/path-maps/route.ts`
- `src/app/api/mcp/route.ts`
- `src/app/api/image-review/route.ts`

- [x] Define a route-handler template: parse request, validate input, call service, return `ok(...)` or error envelope.
- [x] Move repeated response formatting into `src/lib/api-response.ts`.
- [x] Move repeated request parsing into route helpers under `src/server/http` or extend `src/server/services/validation-utils.ts`.
- [x] Keep `/api/auth/verify` compatible with UI auth verification and never log token values.
- [x] Keep `/api/health` minimal and safe for public/local probes.
- [x] Route `/api/mcp` through `src/server/mcp/server.ts` only; avoid duplicating Agent API behavior in the route.

**Generation project routes:**
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/projects/[projectId]/run/route.ts`
- `src/app/api/projects/[projectId]/cancel-runs/route.ts`
- `src/app/api/projects/[projectId]/copy/route.ts`
- `src/app/api/projects/[projectId]/archive/route.ts`
- `src/app/api/projects/[projectId]/export/route.ts`
- `src/app/api/projects/[projectId]/save-as-template/route.ts`
- `src/app/api/projects/[projectId]/apply-param/route.ts`
- `src/app/api/projects/[projectId]/preset-replacements/route.ts`
- `src/app/api/projects/[projectId]/results/trash/route.ts`
- `src/app/api/projects/[projectId]/sections/**/route.ts`
- `src/app/api/project-folders/**/route.ts`
- `src/app/api/project-create-options/route.ts`
- `src/app/api/sections/[sectionId]/trash/route.ts`

- [ ] Map each project route to `project-service`, `project-folder-service`, `project-export-service`, `project-archive-service`, `project-deletion-service`, `section-workflow-service`, or a new focused service.
- [ ] Ensure project routes do not directly build Prisma where clauses except through a repository/service boundary.
- [ ] Consolidate project folder move/reorder/delete/create validation into a single folder service API.
- [ ] Keep archive/delete cleanup separated from regular update flows.
- [ ] Add route tests for destructive actions before moving code.

**Preset library routes:**
- `src/app/api/preset-library/categories/**/route.ts`
- `src/app/api/preset-library/folders/**/route.ts`
- `src/app/api/preset-library/groups/**/route.ts`
- `src/app/api/preset-library/presets/**/route.ts`
- `src/app/api/preset-library/variants/[variantId]/route.ts`
- `src/app/api/presets/route.ts`
- `src/app/api/templates/**/route.ts`

- [ ] Map category routes to `src/lib/actions/preset-category.ts` or a new server service if they are API-only.
- [ ] Map preset/group/folder routes to `preset-query-service`, `preset-change-history-service`, `preset-section-replacement-service`, and repository modules.
- [ ] Keep category slot-template behavior owned by `PresetCategorySlot` logic and tests.
- [ ] Keep section/template preset replacement dry-run/apply behavior in one shared core.
- [ ] Remove route-level duplication between project preset replacements and template preset replacements.

**Queue, run, review, and image routes:**
- `src/app/api/queue/route.ts`
- `src/app/api/queue-data/route.ts`
- `src/app/api/queue/clear/route.ts`
- `src/app/api/queue/clear-active/route.ts`
- `src/app/api/queue/pause-active/route.ts`
- `src/app/api/queue/resume-paused/route.ts`
- `src/app/api/worker/status/route.ts`
- `src/app/api/runs/[runId]/**/route.ts`
- `src/app/api/images/[...path]/route.ts`
- `src/app/api/images/[imageId]/**/route.ts`

- [ ] Rename internal route concepts in code comments so `/api/queue` is always described as review queue.
- [ ] Keep active run control in `src/lib/actions/run-lifecycle.ts` or migrate it to a service with server action wrappers.
- [ ] Keep image path serving in a hardened file service; path traversal checks belong below the route.
- [ ] Keep review mutations in `review-service` and file movement in `image-file-service`.
- [ ] Add tests around pause/resume batch IDs, run IDs, and pre-existing paused work.

**Comfy and asset routes:**
- `src/app/api/comfy/**/route.ts`
- `src/app/api/models/**/route.ts`
- `src/app/api/loras/**/route.ts`

- [ ] Keep Comfy status/start/stop/restart in `comfy-process-manager`, `comfy-target`, `comfy-target-process`, and `comfy-gpu-watchdog`.
- [ ] Keep model and LoRA browse/move/notes/hash behavior in `model-asset-service`, `lora-upload-service`, and `lora-repository`.
- [ ] Ensure SSH and local target behavior is tested separately.
- [ ] Document which routes are safe in dev mode and which routes can affect live ComfyUI state.

**Agent API routes:**
- `src/app/api/agent/projects/**/route.ts`
- `src/app/api/agent/runs/**/route.ts`
- `src/app/api/agent/sections/**/route.ts`
- `src/app/api/agent/projects/sync-preset-variant-flow/route.ts`

- [ ] Keep Agent API behavior mapped to `agent-preset-variant-service`, `agent-preset-variant-flow-service`, `project-service`, `review-service`, and `prompt-block-service`.
- [ ] Keep docs synchronized with `docs/agent-api.md` and `src/server/mcp/server.ts`.
- [ ] Add contract tests for every Agent endpoint listed in docs.

**Training API routes:**
- `src/app/api/training/route.ts`
- `src/app/api/training/projects/**/route.ts`
- `src/app/api/training/templates/**/route.ts`
- `src/app/api/training/sections/**/route.ts`
- `src/app/api/training/blocks/**/route.ts`
- `src/app/api/training/presets/**/route.ts`
- `src/app/api/training/scene-description/**/route.ts`
- `src/app/api/training/generation-tasks/**/route.ts`
- `src/app/api/training/generation-inputs/**/route.ts`
- `src/app/api/training/generation-outputs/**/route.ts`
- `src/app/api/training/image-results/**/route.ts`
- `src/app/api/training/reference-images/**/route.ts`
- `src/app/api/training/dataset-revisions/**/route.ts`
- `src/app/api/training/training-runs/**/route.ts`
- `src/app/api/training/runs/route.ts`
- `src/app/api/training/section-runs/**/route.ts`
- `src/app/api/training/scheduler/**/route.ts`
- `src/app/api/training/worker/**/route.ts`

- [ ] Split `src/app/api/training/route.ts` manifest data into `src/features/training/api-manifest.ts` or `src/server/training/api-manifest.ts`.
- [ ] Keep resource boundary policy near `src/lib/work-mode-resources.ts` and import it from a single owner.
- [ ] Map project/profile/reference image routes to `training/project-actions-service`, `training/read-service`, and training repositories.
- [ ] Map template routes to `training/template-service`, `template-order-service`, and `template-scene-block-service`.
- [ ] Map project section/block routes to `project-section-service`, `project-scene-block-service`, and `template-scene-block-service`.
- [ ] Map preset and scene-description routes to `training/preset-service` and `scene-description-presets` repository.
- [ ] Map generation task routes to `generation-task-draft-service`, `generation-output-service`, and training worker APIs.
- [ ] Map dataset and training run routes to `snapshot-service`, `run-maintenance-service`, `run-preset-service`, and `run-visibility-service`.
- [ ] Map scheduler/worker routes to `src/server/worker/training/task-api.ts` and avoid route-level branching.
- [ ] Add route tests that seed the minimum required `TrainingProject`, `TrainingCharacterProfile`, `TrainingSection`, and `TrainingTemplate` rows.

## Phase 4: Server Repository Layer

**Purpose:** Repositories should fetch and persist data, not own business workflows.

**Files:**
- `src/server/repositories/generation-resource-boundary.ts`
- `src/server/repositories/lora-repository.ts`
- `src/server/repositories/preset-view-repository.ts`
- `src/server/repositories/project-repository.ts`
- `src/server/repositories/project-repository/enqueue.ts`
- `src/server/repositories/project-repository/helpers.ts`
- `src/server/repositories/project-view-repository.ts`
- `src/server/repositories/project-view-repository/index.ts`
- `src/server/repositories/project-view-repository/list-view.ts`
- `src/server/repositories/project-view-repository/detail-view.ts`
- `src/server/repositories/project-view-repository/form-view.ts`
- `src/server/repositories/prompt-block-repository.ts`
- `src/server/repositories/queue-data-repository.ts`
- `src/server/repositories/review-repository.ts`
- `src/server/repositories/template-view-repository.ts`
- `src/server/repositories/trash-repository.ts`
- `src/server/repositories/training/projects.ts`
- `src/server/repositories/training/generation-tasks.ts`
- `src/server/repositories/training/image-results.ts`
- `src/server/repositories/training/profile-text.ts`
- `src/server/repositories/training/scene-description-presets.ts`
- `src/server/repositories/training/snapshot.ts`
- `src/server/repositories/training/templates.ts`
- `src/server/repositories/training/helpers.ts`

- [ ] Move non-query project creation/update behavior out of `project-repository.ts` into services.
- [ ] Keep `project-repository/helpers.ts` for mapping and resolver helpers only if they are pure and well named.
- [ ] Split `src/server/repositories/training/projects.ts` into focused files: project CRUD, profile/reference images, sections, generation runs, dataset revisions, training runs, artifacts.
- [ ] Keep artifact file writing out of repository modules unless the repository name explicitly includes artifact storage.
- [ ] Make list repositories accept typed filter objects instead of `unknown` where possible.
- [ ] Remove unused placeholder parameters such as `_filters` and `_input` only after route/service callers are updated.
- [ ] Keep `generation-resource-boundary.ts` as the single owner of generation-vs-training resource filters.
- [ ] Keep `queue-data-repository.ts` naming honest: review queue list, active worker status, progress formatting, or split into separate files.
- [ ] Add repository-level tests for pagination, ordering, archived filtering, resource boundary filters, and visibility gates.
- [ ] Do not let repositories import service modules; fix existing inverse dependencies before adding more.

## Phase 5: Server Service Layer

**Purpose:** Services own business workflows, validation orchestration, external systems, and side effects.

**Generation and project services:**
- `src/server/services/project-service.ts`
- `src/server/services/project-folder-service.ts`
- `src/server/services/project-archive-service.ts`
- `src/server/services/project-deletion-service.ts`
- `src/server/services/project-export-service.ts`
- `src/server/services/project-file-cleanup-service.ts`
- `src/server/services/section-cleanup-service.ts`
- `src/server/services/section-workflow-service.ts`
- `src/server/services/section-change-history-service.ts`
- `src/server/services/prompt-block-service.ts`
- `src/server/services/preset-binding-service.ts`
- `src/server/services/preset-change-history-service.ts`
- `src/server/services/preset-query-service.ts`
- `src/server/services/preset-section-replacement-core.ts`
- `src/server/services/preset-section-replacement-service.ts`

- [ ] Give each service a one-line ownership comment at the top of the file.
- [ ] Split project lifecycle flows into create/update/archive/delete/copy/export/run service entrypoints.
- [ ] Keep audit recording close to service actions, not route handlers.
- [ ] Keep change-history diff and Prisma-compatible JSON conversion in shared utility modules.
- [ ] Ensure preset replacement core is UI-agnostic and shared by project/template callers.
- [ ] Keep prompt block mutation, preset detachment, and section resolver refresh in one service boundary.

**Run, queue, Comfy, image, and censoring services:**
- `src/server/services/run-executor.ts`
- `src/server/services/comfyui-service.ts`
- `src/server/services/comfy-target.ts`
- `src/server/services/comfy-target-process.ts`
- `src/server/services/comfy-process-manager.ts`
- `src/server/services/comfy-gpu-watchdog.ts`
- `src/server/services/comfy-progress-service.ts`
- `src/server/services/comfy-queue-cancellation.ts`
- `src/server/services/comfy-output-cleanup.ts`
- `src/server/services/comfy-remote-output-cleanup.ts`
- `src/server/services/comfy-remote-file-adapter.ts`
- `src/server/services/comfy-ssh.ts`
- `src/server/services/comfy-patch-manager.ts`
- `src/server/services/image-file-service.ts`
- `src/server/services/image-result-service.ts`
- `src/server/services/review-service.ts`
- `src/server/services/censoring-service.ts`
- `src/server/services/censoring-executor.ts`
- `src/server/services/auto-censor-runner.ts`
- `src/server/services/queue-control-stream.ts`
- `src/server/services/runtime-data-path.ts`

- [ ] Split `run-executor.ts` into submission, deferred submission recovery, polling/finalization, stale recovery, and audit mapping modules.
- [ ] Keep Comfy prompt building in `workflow-prompt-builder.ts` and worker payload builder, not inside executor flow.
- [ ] Make Comfy target resolution testable without network calls.
- [ ] Keep SSH command construction and execution isolated so quoting tests can cover Windows/remote behavior.
- [ ] Keep image file movement and DB image status updates separated but orchestrated by review/censoring services.
- [ ] Ensure auto-censor runner always strips parent Python environment as current tests expect.
- [ ] Add service-level tests for cancellation failure behavior, finalization markers, prompt polling, and recovery caps.

**Training services:**
- `src/server/services/training/caption-service.ts`
- `src/server/services/training/generation-output-service.ts`
- `src/server/services/training/generation-task-draft-service.ts`
- `src/server/services/training/preset-service.ts`
- `src/server/services/training/project-actions-service.ts`
- `src/server/services/training/project-order-service.ts`
- `src/server/services/training/project-scene-block-service.ts`
- `src/server/services/training/project-section-service.ts`
- `src/server/services/training/project-template-copy-service.ts`
- `src/server/services/training/project-visibility-service.ts`
- `src/server/services/training/read-service.ts`
- `src/server/services/training/run-maintenance-service.ts`
- `src/server/services/training/run-preset-service.ts`
- `src/server/services/training/run-preset-state-service.ts`
- `src/server/services/training/run-visibility-service.ts`
- `src/server/services/training/snapshot-service.ts`
- `src/server/services/training/template-order-service.ts`
- `src/server/services/training/template-scene-block-service.ts`
- `src/server/services/training/template-service.ts`
- `src/server/services/training/text-revision-service.ts`

- [ ] Define the training service dependency direction: read-service can compose repositories; action services can call read-service and repositories; UI types should not leak into persistence.
- [ ] Move any remaining production workflow code out of `src/server/repositories/training/projects.ts` into the matching service.
- [ ] Keep project/template/section scene-block logic symmetrical but not duplicated.
- [ ] Keep run visibility and project visibility logic as filters that can be tested with pure fixtures.
- [ ] Keep preset creation from completed training runs in `run-preset-service` with state transitions in `run-preset-state-service`.
- [ ] Add tests for every training service with Prisma runtime behavior: preset, template, generation task, image result, run maintenance, visibility, and snapshot.

**Quality, Agent, MCP, and validation services:**
- `src/server/services/agent-preset-variant-service.ts`
- `src/server/services/agent-preset-variant-flow-core.ts`
- `src/server/services/agent-preset-variant-flow-service.ts`
- `src/server/services/audit-service.ts`
- `src/server/services/change-history-utils.ts`
- `src/server/services/validation-utils.ts`
- `src/server/services/workflow-debug-download.ts`
- `src/server/services/workflow-prompt-builder.ts`
- `src/server/quality/csv-utils.ts`
- `src/server/quality/phase0-baseline.ts`
- `src/server/quality/phase1-offline-eval.ts`
- `src/server/quality/phase1-reviewer.ts`
- `src/server/mcp/server.ts`

- [ ] Keep Agent flow dry-run/apply logic independent from route handlers and UI dialog parsing.
- [ ] Keep MCP tools as wrappers around stable service contracts.
- [ ] Give quality scripts/services shared CSV and JSON parsing helpers.
- [ ] Document quality data inputs in `docs/plans/auto-review-analysis`.

## Phase 6: Server Actions And Shared Libs

**Purpose:** Turn `src/lib` from a mixed grab bag into clearly named client-safe, server-action, and shared-pure areas.

**Server action files:**
- `src/lib/actions.ts`
- `src/lib/actions/_helpers.ts`
- `src/lib/actions/project.ts`
- `src/lib/actions/project-folder.ts`
- `src/lib/actions/run.ts`
- `src/lib/actions/run-execution.ts`
- `src/lib/actions/run-lifecycle.ts`
- `src/lib/actions/cancellation-helpers.ts`
- `src/lib/actions/image-review.ts`
- `src/lib/actions/censoring.ts`
- `src/lib/actions/section.ts`
- `src/lib/actions/section-folder.ts`
- `src/lib/actions/section-folder-utils.ts`
- `src/lib/actions/prompt-block.ts`
- `src/lib/actions/template.ts`
- `src/lib/actions/template-crud.ts`
- `src/lib/actions/template-import.ts`
- `src/lib/actions/template-save.ts`
- `src/lib/actions/preset-category.ts`
- `src/lib/actions/preset-folder.ts`
- `src/lib/actions/preset-group.ts`
- `src/lib/actions/preset-group-sync.ts`
- `src/lib/actions/preset-sync.ts`
- `src/lib/actions/preset-variant.ts`
- `src/lib/actions/preset-variant-crud.ts`
- `src/lib/actions/preset-variant-resolve.ts`
- `src/lib/actions/lora.ts`

- [x] Decide whether `src/lib/actions.ts` remains a wildcard barrel or becomes explicit named exports.
- [ ] Move server-only actions into `src/server/actions` if a future implementation wants a clearer import boundary.
- [ ] Keep client-safe parsing helpers outside server action files.
- [ ] Keep queue lifecycle actions compatible with pause/resume deployment requirements.
- [ ] Split `run-lifecycle.ts` if cancellation, pause/resume, clear, and progress reporting remain hard to reason about.
- [x] Keep preset resource scope as a shared boundary helper but avoid importing action modules from repository modules.
- [ ] Add tests around every server action that wraps nontrivial service behavior.

**Shared pure and client-safe libs:**
- `src/lib/api-response.ts` (runtime: server-only)
- `src/lib/api-error-message.ts` (runtime: universal)
- `src/lib/aspect-ratio-utils.ts` (runtime: universal)
- `src/lib/character-lora-canonical-views.ts` (runtime: universal)
- `src/lib/character-lora-prompt-card-draft.ts` (runtime: universal)
- `src/lib/character-lora-source-images.ts` (runtime: universal)
- `src/lib/client-review-mutation.ts` (runtime: client-safe)
- `src/lib/db-enums.ts` (runtime: universal)
- `src/lib/env.ts` (runtime: server-only)
- `src/lib/folder-navigation.ts` (runtime: universal)
- `src/lib/image-url.ts` (runtime: universal)
- `src/lib/logger.ts` (runtime: server-only)
- `src/lib/lora-types.ts` (runtime: universal)
- `src/lib/model-asset-navigation.ts` (runtime: universal)
- `src/lib/model-constants.ts` (runtime: universal)
- `src/lib/preset-binding-utils.ts` (runtime: universal)
- `src/lib/preset-resource-scope.ts` (runtime: server-only)
- `src/lib/preset-group-slot-layout.ts` (runtime: universal)
- `src/lib/preset-section-replacement-ui.ts` (runtime: client-safe)
- `src/lib/queue-control-progress.ts` (runtime: universal)
- `src/lib/quick-censor-core.ts` (runtime: universal)
- `src/lib/review-lightbox-state.ts` (runtime: client-safe)
- `src/lib/review-undo-state.ts` (runtime: universal)
- `src/lib/route-fallback.ts` (runtime: universal)
- `src/lib/run-submission-toast.ts` (runtime: client-safe)
- `src/lib/scroll-container.ts` (runtime: client-safe)
- `src/lib/section-batch-run.ts` (runtime: universal)
- `src/lib/section-list-ordering.ts` (runtime: universal)
- `src/lib/server-data.ts` (runtime: server-only)
- `src/lib/sfw-mode.ts` (runtime: client-safe)
- `src/lib/sync-preset-variant-flow-ui.ts` (runtime: client-safe)
- `src/lib/types.ts` (runtime: universal)
- `src/lib/utils.ts` (runtime: universal)
- `src/lib/work-mode.ts` (runtime: universal)
- `src/lib/work-mode-resources.ts` (runtime: universal)
- `src/lib/training/provider-policy.ts` (runtime: universal)
- `src/lib/training/schemas.ts` (runtime: universal)

- [x] Mark each file as client-safe, server-only, or universal.
- [x] Move server-only re-export layer `server-data.ts` into a clearer server namespace or document it as RSC-only.
- [x] Keep `logger.ts` server-safe and avoid importing it into browser components.
- [x] Consolidate UI error extraction helpers for preset replacement and sync preset variant flow if their payload shape is the same.
- [x] Keep route fallback tests aligned with work-mode route behavior.
- [x] Keep character LoRA compatibility helpers until migration docs explicitly retire old forms/API clients.

## Phase 7: App Pages And Production UI Routes

**Purpose:** Convert route files and page clients into containers around focused components, hooks, and UI adapters.

**Global app files:**
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/not-found.tsx`
- `src/app/login/page.tsx`
- `src/app/globals.css`
- `src/app/design-system.css`
- `src/proxy.ts`
- `src/instrumentation.ts`
- `src/instrumentation.node.ts`

- [x] Keep `src/app/layout.tsx` responsible for providers, shell inclusion/exclusion, and auth-safe global layout only.
- [x] Keep `src/proxy.ts` aligned with Next 16 proxy conventions from local docs.
- [x] Keep instrumentation server-safe and documented.
- [x] Review global CSS variables against `DESIGN.md` and `docs/frontend-design-guide.md`.

**Project pages:**
- `src/app/projects/page.tsx`
- `src/app/projects/projects-client.tsx`
- `src/app/projects/actions.ts`
- `src/app/projects/actions-export.ts`
- `src/app/projects/action-types.ts`
- `src/app/projects/new/page.tsx`
- `src/app/projects/new/from-existing/page.tsx`
- `src/app/projects/[projectId]/page.tsx`
- `src/app/projects/[projectId]/project-detail-client.tsx`
- `src/app/projects/[projectId]/app-sidebar.tsx`
- `src/app/projects/[projectId]/project-detail-actions.tsx`
- `src/app/projects/[projectId]/section-actions.tsx`
- `src/app/projects/[projectId]/section-cards.tsx`
- `src/app/projects/[projectId]/censor-button.tsx`
- `src/app/projects/[projectId]/clear-sections-button.tsx`
- `src/app/projects/[projectId]/sync-preset-variant-flow-dialog.tsx`
- `src/app/projects/[projectId]/edit/page.tsx`
- `src/app/projects/[projectId]/edit/project-edit-form.tsx`
- `src/app/projects/[projectId]/edit/apply-param-response.ts`
- `src/app/projects/[projectId]/batch-create/page.tsx`
- `src/app/projects/[projectId]/batch-create/batch-create-client.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/page.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/section-name-editor.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/section-change-history.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/section-switch-navigation.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/results/results-gallery.tsx`
- `src/app/projects/[projectId]/sections/[sectionId]/results/results-route-prefetcher.tsx`
- `src/app/projects/[projectId]/results/page.tsx`
- `src/app/projects/[projectId]/results/project-results-client.tsx`
- All `loading.tsx` files under project routes.

### Project Page Boundary Map

| Surface | Route/container boundary | UI/state boundary | Follow-up split checkpoint |
| --- | --- | --- | --- |
| Project list | `src/app/projects/page.tsx` owns `folder` search param validation plus `listProjects()` and `listProjectFolders()` data loading. | `src/app/projects/projects-client.tsx` currently owns folder navigation, archive visibility, selection, drag sorting, folder mutations, and list rendering. | Extract filtering/sorting/folder state into hooks under a project UI module before changing list behavior. |
| Create project | `src/app/projects/new/page.tsx` owns create-form option loading; `src/app/projects/new/from-existing/page.tsx` also loads source projects and folders. | `src/app/projects/new/project-form.tsx` owns create/create-from-existing form state, preset selection, source-project selection, and submit behavior. | Keep new/from-existing route URLs stable; split form state only after create-action coverage is in place. |
| Project detail | `src/app/projects/[projectId]/page.tsx` owns project/preset-library loading, `sectionFolder` validation, and `notFound()`. | `src/app/projects/[projectId]/project-detail-client.tsx` owns section folder state, compact mode, scroll anchoring, sidebar state, dialogs, and delegates card rendering to `src/app/projects/[projectId]/section-cards.tsx`. | Move section card rendering into shared project components with typed props, then split folder/navigation state into hooks. |
| Edit project | `src/app/projects/[projectId]/edit/page.tsx` owns edit-data/form-options loading and missing-project handling. | `src/app/projects/[projectId]/edit/project-edit-form.tsx` owns editable fields, preset selections, KSampler defaults, apply-all calls, and save navigation. | Split form state, preset binding editor, default-parameter editor, and apply-all adapter before changing edit behavior. |
| Batch create | `src/app/projects/[projectId]/batch-create/page.tsx` owns preset-library/project loading and missing-project display. | `src/app/projects/[projectId]/batch-create/batch-create-client.tsx` owns import list, preset/group browsing, folder/search state, binding overrides, creation feedback, and submit behavior. | Split browser state, import list rendering, binding override logic, and create-section mutation adapter. |
| Section edit | `src/app/projects/[projectId]/sections/[sectionId]/page.tsx` owns edit-page data loading, sibling navigation, resolved-config mapping, return hrefs, and the server action bridge for LoRA config. | `src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx`, `section-name-editor.tsx`, `section-change-history.tsx`, and `section-switch-navigation.tsx` own focused UI islands around the route container. | Extract resolved prompt/parameter mapping out of the route before further UI edits; keep keyboard section switching covered. |
| Section results | `src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx` owns section-results loading, project/section guard, return/prefetch hrefs, and neighbor navigation. | `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx` owns review selection, quick run, trash/censor actions, keyboard shortcuts, and gallery handoff; `results-gallery.tsx` owns the lightbox provider. | Keep G shortcut and hard-navigation tests green while splitting review toolbar, image grid, and mutation adapters. |
| Project results | `src/app/projects/[projectId]/results/page.tsx` owns aggregate project-results loading and `notFound()`. | `src/app/projects/[projectId]/results/project-results-client.tsx` now owns sidebar/navigation coordination, collapsed-row state, keyboard shortcuts, and lightbox display mode while filter state, toolbar rendering, gallery rendering, lightbox shell, and mutation behavior live in focused project-results modules. | Later changes should keep these split boundaries stable unless a smaller owner module is added. |

Loading states remain colocated under their route segments for now; the later loading-state checkpoint should extract shared skeleton pieces without moving route-specific fallback ownership.

- [x] Define project page boundaries: list, create, detail, edit, batch-create, section edit, section results, project results.
- [x] Move project list filtering/sorting state into hooks under a project UI module.
- [x] Move section card rendering into shared project components with typed props.
- [x] Keep result lightbox state in `src/lib/review-lightbox-state.ts` or a focused hook.
- [x] Split `project-results-client.tsx` into route container, toolbar/filter state, gallery/list component, lightbox adapter, mutation adapter.
- [x] Keep image-heavy navigation hard-navigation behavior covered by `test-hard-navigation-for-image-heavy-pages.test.ts`.
- [x] Keep G shortcut behavior covered by section/results tests.
- [x] Keep loading states colocated with routes but share skeleton components.

**Asset pages:**
- `src/app/assets/models/page.tsx`
- `src/app/assets/models/model-file-manager.tsx`
- `src/app/assets/loras/page.tsx`
- `src/app/assets/loras/lora-file-manager.tsx`
- `src/app/assets/loras/lora-upload-form.tsx`
- `src/app/assets/presets/page.tsx`
- `src/app/assets/presets/preset-manager.tsx`
- `src/app/assets/presets/preset-form.tsx`
- `src/app/assets/presets/[presetId]/page.tsx`
- `src/app/assets/presets/[presetId]/preset-edit-client.tsx`
- `src/app/assets/presets/preset-types.ts`
- `src/app/assets/presets/category-components.tsx`
- `src/app/assets/presets/folder-components.tsx`
- `src/app/assets/presets/group-components.tsx`
- `src/app/assets/presets/group-list.tsx`
- `src/app/assets/presets/group-utils.ts`
- `src/app/assets/presets/group-create-form.tsx`
- `src/app/assets/presets/group-inline-editor.tsx`
- `src/app/assets/presets/add-group-member-form.tsx`
- `src/app/assets/presets/sortable-group-card.tsx`
- `src/app/assets/presets/change-history-panel.tsx`
- `src/app/assets/presets/preset-variant-bulk-edit-dialog.tsx`
- `src/app/assets/presets/preset-variant-bulk-text.ts`
- `src/app/assets/presets/sort-rules/page.tsx`
- `src/app/assets/presets/sort-rules/sort-rules-editor.tsx`
- `src/app/assets/preset-groups/[groupId]/page.tsx`
- `src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx`
- `src/app/assets/templates/page.tsx`
- `src/app/assets/templates/templates-list-client.tsx`
- `src/app/assets/templates/new/page.tsx`
- `src/app/assets/templates/[templateId]/edit/page.tsx`
- `src/app/assets/templates/template-form-client.tsx`
- `src/app/assets/templates/[templateId]/sections/[sectionIndex]/page.tsx`
- `src/app/assets/templates/[templateId]/sections/[sectionIndex]/section-detail-client.tsx`

### Asset Page Boundary Map

| Surface | Route/container boundary | UI/state boundary | Follow-up split checkpoint |
| --- | --- | --- | --- |
| Model files | `src/app/assets/models/page.tsx` owns `kind`/`path` search-param normalization and passes the selected model kind/path to `ModelFileManager`. | `src/app/assets/models/model-file-manager.tsx` owns the unified checkpoint/LoRA browser, search, selection, upload, move, notes, trigger words, and Civitai link UI. | Keep shared browse helpers in `src/app/assets/model-file-manager-shared.ts`; split the broad manager further only behind focused tests. |
| LoRA files | `src/app/assets/loras/page.tsx` redirects to `/assets/models` so LoRA browsing uses the unified model file manager. | `src/app/assets/loras/lora-file-manager.tsx` remains a legacy compatibility manager, while route ownership stays with the unified model assets page. | Do not reintroduce a separate LoRA page unless behavior intentionally diverges from model file management. |
| Preset library | `src/app/assets/presets/page.tsx` owns preset-category loading with `getPresetCategoriesWithPresets()`. | `src/app/assets/presets/preset-manager.tsx` and colocated preset/folder/group components own preset library browsing and editing state. | Split `preset-form.tsx` into variant list, variant editor, save queue hook, bulk apply utilities, and action footer. |
| Preset groups | `src/app/assets/preset-groups/[groupId]/page.tsx` owns group edit data loading, missing-group `notFound()`, and neighbor ordering. | `src/app/assets/preset-groups/[groupId]/preset-group-edit-client.tsx` owns preset-group edit UI state. | Keep slot ordering owned by category slot template logic. |
| Templates | `src/app/assets/templates/page.tsx` owns template listing data with `listProjectTemplates()`, while `new`, `edit`, and section-detail routes stay under `src/app/assets/templates/**`. | `templates-list-client.tsx`, `template-form-client.tsx`, and `section-detail-client.tsx` own template list, form, and section-detail UI state respectively. | Split template section detail client into route container, section form, preset binding editor, prompt blocks, LoRA editor, and change history. |

- [x] Split asset pages by resource type: model files, LoRA files, preset library, preset groups, templates.
- [x] Keep file manager code shared between models and LoRAs where behavior is actually the same.
- [x] Split `preset-form.tsx` into variant list, variant editor, save queue hook, bulk apply utilities, and action footer.
  - [x] Save queue hook extracted to `src/app/assets/presets/use-preset-save-queue.ts` and covered by `tests/test-preset-save-queue.test.ts`.
  - [x] Variant list and DnD surface extracted to `src/app/assets/presets/preset-variant-list.tsx` and covered by `tests/test-preset-form-split.test.ts`.
  - [x] Bulk apply utilities extracted to `src/app/assets/presets/preset-variant-bulk-apply.ts` and covered by `tests/test-preset-variant-bulk-apply.test.ts`.
  - [x] Variant editor extracted to `src/app/assets/presets/preset-variant-editor.tsx` and covered by `tests/test-preset-form-split.test.ts`.
  - [x] Action footer/status surface extracted to `src/app/assets/presets/preset-form-action-footer.tsx` and covered by `tests/test-preset-form-split.test.ts`.
- [x] Keep "apply to all variants" behavior tested for copy loop and save queue separately.
  - [x] Save queue behavior is tested separately for latest-payload coalescing, retry, handler refresh, and falsy payloads.
  - [x] Copy-loop/apply-to-all behavior is tested separately for prompt copy, LoRA update/append, blank-path no-op, incomplete LoRA detection, and nested clone helpers.
- [x] Keep preset group slot ordering owned by category slot template logic.
- [x] Split template section detail client into route container, section form, preset binding editor, prompt blocks, LoRA editor, and change history.
  - [x] Prompt block rendering extracted to `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-prompt-blocks.tsx` and covered by `tests/test-template-section-detail-split.test.ts`.
  - [x] LoRA editor rendering extracted to `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-lora-editor.tsx` and covered by `tests/test-template-section-detail-split.test.ts`.
  - [x] Preset binding editor rendering extracted to `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-preset-bindings.tsx` and covered by `tests/test-template-section-detail-split.test.ts`.
  - [x] Section form rendering extracted to `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-form.tsx` and covered by `tests/test-template-section-detail-split.test.ts`.
  - [x] Navigation/header rendering extracted to `src/app/assets/templates/[templateId]/sections/[sectionIndex]/template-section-navigation.tsx` and covered by `tests/test-template-section-detail-split.test.ts`.
  - [x] `section-detail-client.tsx` is now the route/state orchestration container; no template section change-history surface is present to extract.
- [x] Keep sort rules editor isolated from preset edit form state.

**Queue and settings pages:**
- `src/app/queue/page.tsx`
- `src/app/queue/queue-page-client.tsx`
- `src/app/queue/[runId]/page.tsx`
- `src/app/queue/[runId]/review-grid.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/logs/page.tsx`
- `src/app/settings/monitor/page.tsx`

- [x] Keep queue list, active progress, review group pagination, and trash/restore state separate.
  - [x] Pending review-group list and pagination extracted to `src/app/queue/queue-pending-tab.tsx` and covered by `tests/test-queue-page-client-split.test.ts`.
  - [x] Active run progress and controls extracted to `src/app/queue/queue-running-tab.tsx` and covered by `tests/test-queue-page-client-split.test.ts`.
  - [x] Trash/restore list and pagination rendering extracted to `src/app/queue/queue-trash-tab.tsx` and covered by `tests/test-queue-page-client-split.test.ts`.
  - [x] Trash/restore local state and callbacks extracted to `src/app/queue/use-queue-trash-state.ts` and covered by `tests/test-queue-page-client-split.test.ts` plus `tests/test-queue-trash-restore.test.ts`.
- [x] Keep queue page autopoll behavior from causing `router.refresh` loops.
- [x] Keep review grid selection, action strip, keyboard shortcuts, and image labeling split into focused components.
  - [x] Image card label, marker, and status rendering extracted to `src/app/queue/[runId]/queue-review-image-card.tsx` and covered by `tests/test-queue-review-grid-split.test.ts`.
  - [x] Selection toolbar rendering extracted to `src/app/queue/[runId]/queue-review-selection-toolbar.tsx` and covered by `tests/test-queue-review-grid-split.test.ts`.
  - [x] Selection-state helpers extracted to `src/app/queue/[runId]/use-queue-review-selection.ts` and covered by `tests/test-queue-review-grid-split.test.ts`.
  - [x] Batch action strip and handle-rest-next actions extracted to `src/app/queue/[runId]/queue-review-batch-actions.tsx` and covered by `tests/test-queue-review-grid-split.test.ts`.
  - [x] Page-level keyboard shortcuts extracted to `src/app/queue/[runId]/use-queue-review-keyboard-shortcuts.ts` and covered by `tests/test-queue-review-grid-split.test.ts`.
- [x] Keep settings pages as operational dashboards and avoid adding business logic there.

## Phase 8: Training Feature Frontend

**Purpose:** Turn `src/features/training` into a coherent product module with clear data, routing, shell, and UI boundaries.

**Files:**
- `src/app/training/[[...route]]/page.tsx`
- `src/app/training/training-app-client.tsx`
- `src/features/training/app.tsx`
- `src/features/training/build.ts`
- `src/features/training/data.ts`
- `src/features/training/routes.ts`
- `src/features/training/runtime.ts`
- `src/features/training/shell.tsx`
- `src/features/training/theme.ts`
- `src/features/training/types.ts`
- `src/features/training/header-action-slots.tsx`
- `src/features/training/header-specs.ts`
- `src/features/training/not-found-page.tsx`
- `src/features/training/not-found-page.module.css`
- `src/features/training/ui/index.ts`
- `src/features/training/ui/training-project-pages.tsx`
- `src/features/training/ui/training-project-pages.module.css`
- `src/features/training/ui/training-projects-page.tsx`
- `src/features/training/ui/training-projects-page.module.css`
- `src/features/training/ui/training-project-list-item.tsx`
- `src/features/training/ui/training-project-list-item.module.css`
- `src/features/training/ui/training-resource-pages.tsx`
- `src/features/training/ui/training-resource-pages.module.css`
- `src/features/training/ui/training-run-detail-page.tsx`
- `src/features/training/ui/training-run-detail-page.module.css`
- `src/features/training/ui/training-runs-page.tsx`
- `src/features/training/ui/training-runs-page.module.css`

- [x] Keep `src/app/training/[[...route]]/page.tsx` as the route entry only.
- [x] Keep `training-app-client.tsx` as the client hydration boundary only if it truly needs client state.
- [x] Keep `app.tsx` responsible for route matching to page components, not page internals.
- [x] Keep `routes.ts` and `runtime.ts` as routing primitives with tests for known paths.
- [x] Keep `shell.tsx` as the only training shell owner; do not reintroduce `DesignDemoShell` sidebar behavior.
- [ ] Split `training-project-pages.tsx` by page:
  - [ ] Project form page and upload reference image workflow.
  - [ ] Project detail overview.
  - [ ] Profile page and text revision UI.
  - [ ] Sections list page.
  - [ ] Section detail page.
  - [ ] Generation compose page.
  - [ ] Project results page.
  - [ ] Dataset page.
  - [ ] Dataset revision page.
  - [ ] Project-scoped runs page.
- [x] Move pure helpers from `training-project-pages.tsx` into `src/features/training/ui/project-page-utils.ts` or domain-specific files.
- [ ] Move hooks from `training-project-pages.tsx` into focused hook files: URL search, upload previews, section draft state, reference picker state, result review state.
- [ ] Split `training-resource-pages.tsx` into presets, templates, scene description categories/folders/presets, and shared resource list primitives.
- [ ] Keep `training-runs-page.tsx` and `training-run-detail-page.tsx` separate from project-scoped run rows unless shared components are extracted.
- [ ] Ensure every split preserves existing tests: `test-training-project-pages`, `test-training-resource-pages`, `test-training-run-detail-page`, `test-training-runs-page`, `test-training-list-layout`, and route-data tests.
- [ ] Keep mobile layout and bottom-nav work-mode behavior under regression tests.

## Phase 9: Shared Components And Design System

**Purpose:** Make shared UI components small, accessible, and consistent across production and design demos.

**Core production components:**
- `src/components/app-shell.tsx`
- `src/components/persistent-bottom-nav.tsx`
- `src/components/page-header.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/sfw-mode-provider.tsx`
- `src/components/sfw-mode-toggle.tsx`
- `src/components/hard-navigation-link.tsx`
- `src/components/neighbor-navigation.tsx`
- `src/components/section-card.tsx`
- `src/components/section-editor.tsx`
- `src/components/section-editor-binding-rules.ts`
- `src/components/section-folder-controls.tsx`
- `src/components/section-sidebar-nav.tsx`
- `src/components/prompt-block-editor.tsx`
- `src/components/template-prompt-block-editor.tsx`
- `src/components/lora-binding-editor.tsx`
- `src/components/lora-list-editor.tsx`
- `src/components/lora-cascade-picker.tsx`
- `src/components/checkpoint-cascade-picker.tsx`
- `src/components/preset-cascade-picker.tsx`
- `src/components/preset-group-cascade-picker.tsx`
- `src/components/project-cascade-picker.tsx`
- `src/components/preset-section-replacement-dialog.tsx`
- `src/components/quick-censor-canvas.tsx`
- `src/components/change-diff-view.tsx`
- `src/components/notification-copy-buttons.tsx`
- `src/components/workflow-download-menu.tsx`
- `src/components/ksampler-panel.tsx`
- `src/components/aspect-ratio-picker.tsx`
- `src/components/batch-size-quick-fill.tsx`
- `src/components/upscale-factor-quick-fill.tsx`
- `src/components/stat-chip.tsx`

- [ ] Split complex editors into primitives, hooks, and domain-specific adapters.
- [ ] Fix React hooks lint errors in `design-demo-shell/app-shell.tsx` and `preset-cascade-picker.tsx` before using lint as a gate.
- [ ] Ensure every dialog/cascade picker has accessible labels and stable portal handling.
- [ ] Keep section editor binding rules as pure functions with tests.
- [ ] Keep copy buttons and toast text behavior tested.
- [ ] Avoid moving production components into design-demo namespaces.

**UI primitives and design-demo component system:**
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/design-demo-shell/**`
- `src/components/design-demo-routing/**`
- `src/components/design-demo-ui/**`

- [ ] Decide which `components/ui` primitives are production-supported and which are shadcn-generated local copies.
- [ ] Keep `components/ui/sidebar.tsx` from leaking into training shell unless the module intentionally opts into it.
- [ ] Move design-demo-only primitives under `src/components/design-demo-ui` and document that they are not production defaults.
- [ ] Keep design-demo media accessibility tests green.
- [ ] Align design-demo shell React hook behavior with React 19 lint rules.

## Phase 10: Design Demos, Static Prototypes, And Visual Docs

**Purpose:** Define whether each visual artifact is a live prototype, legacy reference, or migration candidate.

**Next design-demo app:**
- `src/app/design-demos/**`
- `src/components/design-demo-*`
- `docs/design-demos-frontend-parity.md`
- `docs/design-system-migration.md`
- `docs/DESIGN_SYSTEM_SUMMARY.md`
- `DESIGN.md`

- [ ] Classify `src/app/design-demos` as either active component lab, visual reference, or migration staging area.
- [ ] Keep route registry and header specs as the source of truth for design-demo navigation.
- [ ] Make design-demo data loading explicit: SQLite source, fallback data, local image files, row shaping, selectors, SFW routes.
- [ ] Keep lora-training demo pages separate from production `src/features/training` unless components are intentionally shared.
- [ ] Add a parity checklist for every production page that has a design-demo counterpart.
- [ ] Remove or archive duplicated demo components only after parity is documented.

**Legacy static demos:**
- `design-demos/README.md`
- `design-demos/app.html`
- `design-demos/full-demo.html`
- `design-demos/index.html`
- `design-demos/router.js`
- `design-demos/design-system.css`
- `design-demos/components/components.css`
- `design-demos/v2-projects-page.html`
- `design-demos/v2-queue-page.html`
- `design-demos/v2-review-page.html`
- `design-demos/pages-checklist.md`
- `design-demos/style-audit-report.md`
- `design-demos/todo.txt`

- [ ] Mark each static file as active reference, superseded by Next design-demo, or archival.
- [ ] If archival, move to a documented archive directory in a later implementation batch.
- [ ] If active, document the exact production page it informs.
- [ ] Remove stale `todo.txt` only after its live tasks are copied into a maintained plan.

**HTML prototypes in docs:**
- `docs/prototypes/manager-lora-training-*.html`
- `docs/prototypes/assets/lora-training-shared.css`
- `docs/prototypes/assets/lora-training-shared.js`

- [ ] Treat `docs/prototypes` as source-of-truth only for training prototype intent, not production route behavior.
- [ ] Map each HTML prototype to a production training route.
- [ ] Keep shared prototype assets documented and avoid mixing them with production CSS.

## Phase 11: Worker, Scheduler, And External Process Boundaries

**Purpose:** Make background execution flows explicit and testable.

**Files:**
- `src/server/worker/types.ts`
- `src/server/worker/payload-builder.ts`
- `src/server/worker/repository.ts`
- `src/server/worker/fallback-prompt-builder.ts`
- `src/server/worker/training/task-api.ts`
- `scripts/training/worker-queue.ts`
- `scripts/training/worker-common.ts`
- `scripts/training/image-worker.ts`
- `scripts/training/dataset-freeze-worker.ts`
- `scripts/training/training-worker.ts`
- `tests/test-training-worker-entrypoints.test.ts`
- `tests/test-run-submission-deferral.test.ts`
- `tests/test-run-recovery-poller-cap.test.ts`
- `tests/test-comfy-queue-cancellation.test.ts`

- [ ] Split generation worker payload creation from run repository fetch/update behavior.
- [ ] Keep fallback prompt builder as last resort only; document when it is allowed.
- [ ] Split training `task-api.ts` into task ID parsing, target discovery, leasing, heartbeat, completion, failure mapping, and scheduler tick modules.
- [ ] Keep worker scripts as CLI entrypoints that call shared worker functions.
- [ ] Add dry-run or mock flags to worker scripts where tests need deterministic behavior.
- [ ] Ensure heartbeat, lease ownership, failure summary, and provider error payloads are schema-validated.
- [ ] Keep ComfyUI cancellation semantics strict: HTTP failures must fail current batch and stop later batches.

## Phase 12: Scripts, Quality Pipeline, And Maintenance Utilities

**Purpose:** Make scripts repeatable, documented, and safe.

**Files:**
- `scripts/auto-censor-mosaic.py`
- `scripts/cleanup-latent-artifacts.mjs`
- `scripts/fix-position-presets.py`
- `scripts/migrate-preset-variants.sql`
- `scripts/migrate-sqlite.sql`
- `scripts/db/*.ts`
- `scripts/quality/baseline.ts`
- `scripts/quality/evaluate.ts`
- `scripts/quality/review.ts`
- `scripts/quality/verify.ts`
- `src/server/quality/*.ts`
- `docs/plans/auto-review-analysis/**`

- [ ] Give every script a documented purpose, input, output, dry-run behavior, and exit code behavior.
- [ ] Keep Python scripts separate from Node scripts and document their required Python environment.
- [ ] Ensure auto-censor Python CLI can show help without loading heavy model dependencies.
- [ ] Make cleanup scripts print exactly what they will delete before deleting.
- [ ] Keep quality scripts using shared CSV utilities and typed result objects.
- [ ] Ensure quality analysis data files are either regenerated artifacts or checked-in benchmark fixtures with owners.

## Phase 13: Tests And Fixtures

**Purpose:** Turn the existing broad test suite into a reliable safety net for staged refactoring.

**Test groups:**
- Agent/API: `test-agent-*`, `test-training-api-*`, `test-project-folder-api`, `test-apply-param-response`.
- Queue/run/review/image: `test-queue-*`, `test-run-*`, `test-review-*`, `test-image-*`, `test-clear-active-runs-*`, `test-cancellation-*`.
- Preset/template/section/project: `test-preset-*`, `test-template-*`, `test-section-*`, `test-project-*`.
- Training frontend/backend: `test-training-*`.
- Prisma/data migrations: `test-zero-redundancy-*`, `test-collapse-preset-group-bindings`, `test-latent-*`.
- Comfy/worker/assets: `test-comfy-*`, `test-model-*`, `test-lora-*`, `test-workflow-*`, `test-two-stage-*`.
- UI/source contract: `test-*-source`, design-demo tests, component tests.
- Quality: `test-quality-*`.

- [ ] Create shared fixture builders for project, section, preset category, preset, preset group, template, run, image result, training project, training section, generation task, dataset revision, and training run.
- [ ] Create DB setup helpers for SQLite schema bootstrap and cleanup.
- [ ] Split tests that scan source text from tests that exercise runtime behavior.
- [ ] Keep source contract tests but annotate why they exist and what behavior they protect.
- [ ] Add a test README explaining which tests require regenerated native modules or local DB files.
- [ ] Make route tests import route modules only after test env vars are set.
- [ ] Avoid test order dependencies by creating fresh DB/file fixtures per test file.
- [ ] Keep visual/UI tests focused on rendered output or stable source contracts, not incidental CSS class order.

## Phase 14: Documentation And Agent Rules

**Purpose:** Replace scattered and stale documentation with a maintained documentation system that clearly separates current source-of-truth docs, runbooks, historical notes, product/design intent, prototypes, and generated artifacts.

**Root docs:**
- `README.md`
- `DESIGN.md`
- `CLAUDE.md`
- `AGENTS.md`
- `position_presets.md`

- [ ] Update README project structure after directory changes.
- [ ] Keep README feature list accurate for generation, training, review, export, Comfy runtime, Agent API, and MCP.
- [ ] Keep `DESIGN.md` as UI direction, not implementation inventory.
- [ ] Decide whether `position_presets.md` is active data/reference or historical note.
- [ ] Keep `CLAUDE.md` aligned with AGENTS or retire duplicated instructions if safe.
- [ ] Add a root-level documentation map that points to the maintained docs for setup, architecture, API, UI design, deployment, tests, training, queue/worker behavior, and troubleshooting.
- [ ] Remove or archive outdated top-level docs after their useful content is merged into current docs.

**Agent rule files:**
- `agent-rules/nextjs.md`
- `agent-rules/ui-auth.md`
- `agent-rules/subagents.md`
- `agent-rules/git.md`
- `agent-rules/dev-service.md`
- `agent-rules/mypc-powershell.md`
- `agent-rules/deploy/index.md`
- `agent-rules/deploy/lock.md`
- `agent-rules/deploy/queue.md`
- `agent-rules/deploy/prisma.md`
- `agent-rules/deploy/next-build.md`
- `agent-rules/deploy/service-restart.md`
- `agent-rules/deploy/verification.md`

- [ ] Make `AGENTS.md` generated or manually synchronized from `agent-rules/**`, but not divergent.
- [ ] Keep deploy lock, queue, Prisma, build, restart, and verification rules as separate maintainable docs.
- [ ] Keep dev-service exception separate from full production deployment rules.
- [ ] Keep `mypc` PowerShell quoting rules exact and include EncodedCommand examples.
- [ ] Add an agent-rule maintenance rule: if a workflow changes, update the source `agent-rules/**` file and the rendered `AGENTS.md` summary in the same documentation batch.

**Architecture and analysis docs:**
- `docs/handoff.md`
- `docs/local-verification.md`
- `docs/integration-test-plan.md`
- `docs/agent-api.md`
- `docs/workflow.api.json`
- `docs/quick-reference.md`
- `docs/analysis/**`
- `docs/analysis_comprehensive.md`
- `docs/WORKFLOW_SYSTEM_ANALYSIS.md`
- `docs/WORKFLOW_QUICK_REFERENCE.md`
- `docs/design-v0.1.md`
- `docs/design-v0.3-workflow-integration.md`
- `docs/development-progress.md`
- `docs/development-todo.md`
- `docs/frontend-design-guide.md`
- `docs/shadcn-design-guide.md`
- `docs/superpowers/**`
- `docs/plans/**`
- `docs/prd/**`

- [ ] Mark each doc as current, historical, prototype, runbook, generated, or superseded.
- [ ] Create an index that points agents to current docs first.
- [ ] Update `docs/agent-api.md` when Agent route contracts move.
- [ ] Keep `docs/workflow.api.json` synchronized with workflow routes and debug downloads.
- [ ] Archive old implementation plans only after their completed state is referenced from current docs.
- [ ] Keep PRD docs as product intent, not runtime truth.
- [ ] Keep local verification steps current for auth, dev service, production service, ComfyUI, and protected pages.
- [ ] Split the future documentation system into these maintained layers:
  - [ ] `README.md`: human entrypoint, setup, high-level feature map, and links to current docs.
  - [ ] `docs/architecture/`: current module boundaries, dependency rules, data flow, queue/worker semantics, and training/generation ownership.
  - [ ] `docs/runbooks/`: local development, deployment, `mypc`, ComfyUI, Prisma, auth verification, and incident triage.
  - [ ] `docs/api/`: Agent API, MCP, public route contracts, response envelopes, and workflow schema.
  - [ ] `docs/ui/`: design system, page patterns, shell/navigation rules, design-demo relationship, and accessibility/layout gates.
  - [ ] `docs/testing/`: test groups, fixture builders, DB bootstrap, known environment requirements, and verification matrix.
  - [ ] `docs/archive/`: historical plans, superseded handoffs, old PRDs, obsolete static demos, and retained rationale.
- [ ] Migrate or map existing docs into the new layers before declaring documentation cleanup complete.
- [ ] Merge duplicated docs when they describe the same behavior: README vs handoff, design docs vs frontend guides, workflow quick references vs API JSON, local verification vs deploy rules.
- [ ] Add supersession banners to retained historical docs with links to the maintained replacement.
- [ ] Delete docs that are stale, duplicated, and no longer useful after their replacement is in place.
- [ ] Delete or archive obsolete prototype files after confirming their current production/design-demo replacement.
- [ ] Keep `docs/superpowers/plans/**` as execution plans, not the permanent architecture source of truth; extract durable decisions into current architecture/runbook docs after implementation.
- [ ] Add a documentation review gate to final convergence: no unclassified docs, no stale task-note files, no duplicate conflicting instructions, and no active workflow documented only in old plans.

## Phase 15: Config, Public Assets, Runtime Data, And Generated Code

**Purpose:** Make non-code files governed rather than accidental.

**Files and directories:**
- `config/path-maps.json`
- `config/comfy-targets.example.json`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `src/generated/prisma.ts`
- `src/generated/**`
- Runtime-only local areas: `.next/**`, `data/**`, `logs/**`, `.tmp/**`, `server-dev-*.log`, `server-prod-*.log`, `build-prod*.log`, `.deploy.lock/**`.

- [ ] Document `config/path-maps.json` schema and owner.
- [ ] Document `config/comfy-targets.example.json` fields and relation to `COMFY_API_URL`, `MODEL_BASE_DIR`, `COMFY_LAUNCH_CMD`, and SSH targets.
- [ ] Remove unused default public SVGs only if no route references them.
- [ ] Keep generated Prisma exports out of manual refactor tasks.
- [ ] Ensure runtime-only directories are ignored and not used in tests except through explicit fixture setup.
- [ ] Decide whether any runtime local DB file should become a fixture or be removed from git.

## Phase 16: Final Convergence And Release Gates

**Purpose:** Finish the refactor with proof, not vibes.

- [ ] Run inventory again and confirm every tracked file has an owner and status.
- [ ] Run `npm run lint` and require zero errors; decide whether warnings are allowed.
- [ ] Run `npm test` and require zero unexpected failures.
- [ ] Run Prisma generate for PostgreSQL and SQLite.
- [ ] Run schema compatibility tests.
- [ ] Run targeted route tests for Agent API, training API, queue controls, project routes, preset library routes, and Comfy routes.
- [ ] Run targeted UI/source tests for project pages, queue pages, preset pages, training pages, design-demo routes, and shared components.
- [ ] Run `npx next build --webpack` when implementation reaches deployable runtime changes.
- [ ] Verify protected UI pages with auth token from `.env` without printing token values.
- [ ] If deploying later, follow `AGENTS.md`: acquire `.deploy.lock`, check queue state, pause only current active work when needed, build, restart only target `next start`, verify local/public routes, resume only this deployment's paused batch, then release lock.
- [ ] Update README, handoff, local verification, AGENTS/rules, and this roadmap to match the final structure.

## Recommended Batch Order

- [x] Batch 1: Baseline/tooling cleanup: fix `better-sqlite3` ABI, React hooks lint errors, unused warnings, and known migration assertions.
- [x] Batch 2: Inventory and docs classification: add owner/status table and doc index without moving runtime code.
- [x] Batch 3: API response/request helper standardization: `api-response`, validation helpers, route template applied to low-risk routes.
- [ ] Batch 4: Prisma/schema/test fixture governance: shared DB setup, provider matrix, schema compatibility checks.
- [ ] Batch 5: Queue/run/Comfy boundary split: protect deploy-sensitive semantics before broad UI work.
- [ ] Batch 6: Preset/project/template generation domain split: services, repositories, actions, and route handlers.
- [ ] Batch 7: Training backend split: routes, services, repositories, worker task API.
- [ ] Batch 8: Training frontend split: break large page files into pages, hooks, panels, and adapters.
- [ ] Batch 9: Production project/assets/queue UI split: large client pages and forms.
- [ ] Batch 10: Design-demo/prototype governance: classify, archive, or connect to production components.
- [ ] Batch 11: Scripts and quality pipeline: dry-run, logs, exit codes, fixture data ownership.
- [ ] Batch 12: Documentation convergence and final verification gates.

## Per-Batch Working Rules

- [ ] Start each batch from a clean or intentionally documented git state.
- [ ] Keep commits scoped to one module or one boundary migration.
- [ ] Write or update tests before changing behavior.
- [ ] For pure moves, run tests that import the moved modules before and after.
- [ ] For route changes, test the exact route module and at least one caller.
- [ ] For Prisma changes, test both `schema.prisma` and `schema.sqlite.prisma`.
- [ ] For UI changes, test desktop and mobile layout where the component participates in navigation, shell, lightbox, or editor flows.
- [ ] For docs-only batches, do not trigger deploy workflow unless explicitly requested.
- [ ] Never use `/api/queue` as the active-run source of truth during deploy or restart planning.

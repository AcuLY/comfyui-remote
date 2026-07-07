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
- [ ] Move repeated response formatting into `src/lib/api-response.ts`.
- [ ] Move repeated request parsing into route helpers under `src/server/http` or extend `src/server/services/validation-utils.ts`.
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
- `src/lib/actions/preset-resource-scope.ts`
- `src/lib/actions/preset-sync.ts`
- `src/lib/actions/preset-variant.ts`
- `src/lib/actions/preset-variant-crud.ts`
- `src/lib/actions/preset-variant-resolve.ts`
- `src/lib/actions/lora.ts`

- [ ] Decide whether `src/lib/actions.ts` remains a wildcard barrel or becomes explicit named exports.
- [ ] Move server-only actions into `src/server/actions` if a future implementation wants a clearer import boundary.
- [ ] Keep client-safe parsing helpers outside server action files.
- [ ] Keep queue lifecycle actions compatible with pause/resume deployment requirements.
- [ ] Split `run-lifecycle.ts` if cancellation, pause/resume, clear, and progress reporting remain hard to reason about.
- [ ] Keep preset resource scope as a shared boundary helper but avoid importing action modules from repository modules.
- [ ] Add tests around every server action that wraps nontrivial service behavior.

**Shared pure and client-safe libs:**
- `src/lib/api-response.ts`
- `src/lib/aspect-ratio-utils.ts`
- `src/lib/character-lora-canonical-views.ts`
- `src/lib/character-lora-prompt-card-draft.ts`
- `src/lib/character-lora-source-images.ts`
- `src/lib/client-review-mutation.ts`
- `src/lib/db-enums.ts`
- `src/lib/env.ts`
- `src/lib/folder-navigation.ts`
- `src/lib/image-url.ts`
- `src/lib/logger.ts`
- `src/lib/lora-types.ts`
- `src/lib/model-asset-navigation.ts`
- `src/lib/model-constants.ts`
- `src/lib/preset-binding-utils.ts`
- `src/lib/preset-group-slot-layout.ts`
- `src/lib/preset-section-replacement-ui.ts`
- `src/lib/queue-control-progress.ts`
- `src/lib/quick-censor-core.ts`
- `src/lib/review-lightbox-state.ts`
- `src/lib/review-undo-state.ts`
- `src/lib/route-fallback.ts`
- `src/lib/run-submission-toast.ts`
- `src/lib/scroll-container.ts`
- `src/lib/section-batch-run.ts`
- `src/lib/section-list-ordering.ts`
- `src/lib/server-data.ts`
- `src/lib/sfw-mode.ts`
- `src/lib/sync-preset-variant-flow-ui.ts`
- `src/lib/types.ts`
- `src/lib/utils.ts`
- `src/lib/work-mode.ts`
- `src/lib/work-mode-resources.ts`
- `src/lib/training/provider-policy.ts`
- `src/lib/training/schemas.ts`

- [ ] Mark each file as client-safe, server-only, or universal.
- [ ] Move server-only re-export layer `server-data.ts` into a clearer server namespace or document it as RSC-only.
- [ ] Keep `logger.ts` server-safe and avoid importing it into browser components.
- [ ] Consolidate UI error extraction helpers for preset replacement and sync preset variant flow if their payload shape is the same.
- [ ] Keep route fallback tests aligned with work-mode route behavior.
- [ ] Keep character LoRA compatibility helpers until migration docs explicitly retire old forms/API clients.

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

- [ ] Keep `src/app/layout.tsx` responsible for providers, shell inclusion/exclusion, and auth-safe global layout only.
- [ ] Keep `src/proxy.ts` aligned with Next 16 proxy conventions from local docs.
- [ ] Keep instrumentation server-safe and documented.
- [ ] Review global CSS variables against `DESIGN.md` and `docs/frontend-design-guide.md`.

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

- [ ] Define project page boundaries: list, create, detail, edit, batch-create, section edit, section results, project results.
- [ ] Move project list filtering/sorting state into hooks under a project UI module.
- [ ] Move section card rendering into shared project components with typed props.
- [ ] Keep result lightbox state in `src/lib/review-lightbox-state.ts` or a focused hook.
- [ ] Split `project-results-client.tsx` into route container, toolbar/filter state, gallery/list component, lightbox adapter, mutation adapter.
- [ ] Keep image-heavy navigation hard-navigation behavior covered by `test-hard-navigation-for-image-heavy-pages.test.ts`.
- [ ] Keep G shortcut behavior covered by section/results tests.
- [ ] Keep loading states colocated with routes but share skeleton components.

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

- [ ] Split asset pages by resource type: model files, LoRA files, preset library, preset groups, templates.
- [ ] Keep file manager code shared between models and LoRAs where behavior is actually the same.
- [ ] Split `preset-form.tsx` into variant list, variant editor, save queue hook, bulk apply utilities, and action footer.
- [ ] Keep "apply to all variants" behavior tested for copy loop and save queue separately.
- [ ] Keep preset group slot ordering owned by category slot template logic.
- [ ] Split template section detail client into route container, section form, preset binding editor, prompt blocks, LoRA editor, and change history.
- [ ] Keep sort rules editor isolated from preset edit form state.

**Queue and settings pages:**
- `src/app/queue/page.tsx`
- `src/app/queue/queue-page-client.tsx`
- `src/app/queue/[runId]/page.tsx`
- `src/app/queue/[runId]/review-grid.tsx`
- `src/app/settings/page.tsx`
- `src/app/settings/logs/page.tsx`
- `src/app/settings/monitor/page.tsx`

- [ ] Keep queue list, active progress, review group pagination, and trash/restore state separate.
- [ ] Keep queue page autopoll behavior from causing `router.refresh` loops.
- [ ] Keep review grid selection, action strip, keyboard shortcuts, and image labeling split into focused components.
- [ ] Keep settings pages as operational dashboards and avoid adding business logic there.

## Phase 8: Training Feature Frontend

**Purpose:** Turn `src/features/training` into a coherent product module with clear data, routing, shell, and UI boundaries.

**Files:**
- `src/app/training/[[...route]]/page.tsx`
- `src/app/training/training-app-client.tsx`
- `src/features/training/app.tsx`
- `src/features/training/build.ts`
- `src/features/training/data.ts`
- `src/features/training/load-route-data.ts`
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

- [ ] Keep `src/app/training/[[...route]]/page.tsx` as the route entry only.
- [ ] Keep `training-app-client.tsx` as the client hydration boundary only if it truly needs client state.
- [ ] Keep `app.tsx` responsible for route matching to page components, not page internals.
- [ ] Keep `routes.ts` and `runtime.ts` as routing primitives with tests for known paths.
- [ ] Keep `shell.tsx` as the only training shell owner; do not reintroduce `DesignDemoShell` sidebar behavior.
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
- [ ] Move pure helpers from `training-project-pages.tsx` into `src/features/training/ui/project-page-utils.ts` or domain-specific files.
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

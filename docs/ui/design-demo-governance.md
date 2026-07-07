# Design Demo Governance

Classification: active component lab and visual reference.

This document defines the maintained boundary for `/design-demos`. It is not a production runtime contract, and it must not become a second route registry.

## Current Role

`src/app/design-demos/**` is the routable design-demo app. It is used to review the shell, production-like page composition, demo-only visual primitives, and migration candidates before or beside production UI work.

Use it for:

- active component lab pages under `src/app/design-demos/showcase/**`;
- visual reference pages for generation, asset, settings, and training workflows;
- migration staging only when the production owner and parity checklist are documented.

Do not use it as the source of truth for production route behavior, API behavior, queue semantics, database shape, auth handling, deployment behavior, or worker state.

## Source Of Truth

`src/app/design-demos/routing/routes.ts` is the source of truth for design-demo navigation. Route additions, removals, work-mode links, sample route inventory, and `/design-demos` href mapping must start there.

`src/app/design-demos/routing/header-specs.ts` is the source of truth for route headers. Header titles, subtitles, meta rows, back links, and route-level actions should be changed there instead of copied into docs or page-local lists.

`src/app/design-demos/showcase/registry.ts`, `src/app/design-demos/showcase/preview-keys.ts`, and `src/app/design-demos/showcase/pages/component-previews.tsx` are the source of truth for component showcase coverage.

`src/app/design-demos/README.md` may explain route families and user-facing demo behavior, but any route list in that file is orientation only.

## Data Loading

`src/app/design-demos/data/load-demo-data.ts` owns design-demo data loading.

The loader boundary is intentionally explicit:

- `src/app/design-demos/data/sqlite-source.ts` resolves the optional local SQLite source from `DATABASE_URL` or the documented local fallback path.
- `src/app/design-demos/data/fallback-data.ts` provides static fallback records when SQLite is unavailable or fails.
- `src/app/design-demos/data/local-image-files.ts` decides which local image paths are renderable.
- `src/app/design-demos/data/fallback-images.ts` supplies local image fallback previews only through the documented image-root rules.
- `src/app/design-demos/data/row-shaping.ts` owns SQLite row shaping, JSON fallback parsing, and placeholder image projection.
- `src/app/design-demos/data/source-summary.ts` reports source labels to the shell so demo pages can show where data came from.
- `src/app/design-demos/routing/sfw.ts` owns design-demo theme and SFW local-storage/cookie state.

Do not make feature pages query Prisma, scan local files, or read environment variables directly when the design-demo data layer already owns the source.

## Training Demo Boundary

`src/app/design-demos/features/lora-training/**` is a compatibility surface for the training visual demo. It may re-export `src/features/training/**` components only when the reuse is intentionally shared and remains a narrow compatibility boundary.

When a training demo page uses production training UI:

- document the production owner as `src/features/training`;
- keep demo route wiring under `src/app/design-demos/routing/routes.ts`;
- keep production route wiring under `src/app/training/**`;
- avoid adding design-demo-only props or data aliases to production components unless the production feature also needs them.

## Parity Checklist

Every production page with a design-demo counterpart needs a parity checklist before old demo components are removed, archived, or declared migrated.

Record at least:

- production route;
- design-demo route;
- owner;
- status;
- verification;
- notes about intentionally shared components or demo-only differences.

Do not remove or archive duplicated demo components until parity is documented. A later cleanup batch can move archival files after the replacement route and verification path are named.

## Verification

Run the focused checks when this boundary changes:

```bash
node --import tsx --test tests/test-design-demo-governance.test.ts src/app/design-demos/routing/routes.test.ts src/app/design-demos/showcase/registry.test.ts src/app/design-demos/data/row-shaping.test.ts src/app/design-demos/data/fallback-images.test.ts
```

If files are added, removed, or moved, also run:

```bash
npx tsx scripts/docs/generate-repo-inventory.ts
node --import tsx --test tests/test-repo-inventory.test.ts
```

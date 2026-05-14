# Design Demos Code Cleanup Plan

This plan applies only to `src/app/design-demos/**`.

Goal: the design demo area should behave like an independently maintainable frontend sub-app. It must keep existing routes and interactions compatible while removing hidden styling dependencies, barrel import coupling, utility-class debt, oversized feature files, and unclear ownership.

## Hard Rules

- Demo code must not use Tailwind utility classes.
- Demo code must keep working after Tailwind, shadcn Tailwind CSS, `tailwind-merge`, and `cva` are removed from the project.
- Reusable demo primitives live in `ui/` and import their own CSS Module directly.
- Visual differences must be expressed through component props such as `tone`, `size`, `variant`, `shape`, `pressed`, and `disabled`.
- Feature files may own layout, but they must not reach into primitive internals.
- Do not edit `src/app/globals.css` for demo fixes.
- Do not add compatibility barrels or string-based class-name proxies.

## Current Baseline

Completed in this cleanup pass:

- The official architecture entrypoints are `routing/`, `shell/`, `data/`, `shared/`, `features/`, and `showcase/`, with no underscore prefix.
- Compatibility source folders such as `ui/`, `runs/`, `projects/`, `presets/`, `templates/`, `batch-create/`, `models/`, `system/`, and `section-editor/` still exist while migration continues.
- Demo pages import UI primitives from `ui/<component>` files directly.
- The legacy UI compatibility barrel was removed.
- The previous UI index barrel was removed.
- Tailwind-like icon utility strings were replaced with semantic CSS classes such as `.iconMd`, `.iconSm`, and `.iconSubtle`.
- The string-based style proxy was removed from runtime imports.
- The layout no longer imports a global demo style aggregate.
- Existing demo route styles now enter through explicit feature CSS Modules under `styles/`.
- The old monolithic route-level style module was removed.
- `component-showcase-page.tsx` was split by showcase route group.
- `section-editor-page.tsx` was split into page composition, params, results, history, lightbox, and import modules.
- `design-demo-data.ts` was split into data loading, fixtures, filesystem scanning, and shape transforms.
- `design-demo-utils.ts` was split into route mapping, navigation metadata, status helpers, image helpers, and preset-library helpers.
- Large feature pages were split into route facades plus folders for runs, projects, presets, templates, batch-create, models, system, and icon showcase.

## Phase 1: Baseline And Rules

Status: done for the active code path.

Checks:

```powershell
rg "compatibility barrel" src/app/design-demos -g '*.tsx'
rg -n 'className=.*(size-|opacity-|flex|grid|gap-|px-|py-|p-|m-|w-|h-|text-|bg-|border-|rounded|shadow|items-|justify-|min-|max-|overflow|translate|z-|fixed|absolute|relative)' src/app/design-demos -g '*.tsx'
rg -n 'tailwind|twMerge|cva\(|class-variance-authority|shadcn' src/app/design-demos -g '*.ts' -g '*.tsx' -g '*.css'
git diff -- src/app/globals.css
```

## Phase 2: Primitive Boundary

Status: done for the active import path.

Ongoing rule:

- Keep each primitive self-contained.
- Remove future `className`-driven primitive visual overrides in favor of component props.

## Phase 3: Tailwind Zero Dependency

Status: source utilities removed from `.tsx` code.

Follow-up:

- Keep the zero-match checks in CI or local pre-merge verification for demo changes.
- Do not introduce new Tailwind-style helper libraries in demo code.

## Phase 4: Feature CSS Modules

Status: done for the active code path.

Current modules have been migrated out of the legacy shared styles folder and are colocated with their owning feature files.

Ongoing rule:

- Import feature modules directly from the owning feature file.
- Keep shared tokens as custom properties on the shell/root demo surface.
- Do not add selectors that patch primitive internals from feature CSS.

## Phase 5: Large File Split

Status: done for the primary route and feature surfaces.

The split preserved route behavior, mock data shape, selected states, filters, lightboxes, and browser-visible UI.

## Phase 6: Dependency Removal Readiness

Status: ready for separate dependency-removal work after final build and route checks.

Required before removing dependencies:

```powershell
cmd /c npx tsc --noEmit --pretty false
cmd /c npm run lint -- src/app/design-demos
cmd /c npx next build
```

Routes to verify:

- `/design-demos/component-showcase`
- `/design-demos/component-showcase-controls`
- `/design-demos/component-showcase-surfaces`
- `/design-demos/component-showcase-unit-items`
- `/design-demos/component-showcase-folders`
- `/design-demos/component-showcase-batch-actions`
- `/design-demos/component-showcase-generation-params`
- `/design-demos/component-showcase-preset-prompt-lora`
- `/design-demos/component-showcase-taxonomy-history`
- `/design-demos/component-showcase-images`
- `/design-demos/component-showcase-runs`
- `/design-demos/component-showcase-system`
- `/design-demos/component-showcase-headers`
- `/design-demos/component-showcase-icons`
- `/design-demos/runs`
- `/design-demos/projects`
- `/design-demos/models`
- `/design-demos/presets`
- `/design-demos/settings`

## Commit Policy

- Keep dependency removal as a later standalone commit.
- Keep production pages outside this cleanup.
- Stage only demo cleanup files.
- Follow the project deployment guard before build, cache cleanup, or service restart.

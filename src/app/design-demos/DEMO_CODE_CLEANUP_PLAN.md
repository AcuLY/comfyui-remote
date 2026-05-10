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

- Demo pages import UI primitives from `ui/<component>` files directly.
- The legacy UI compatibility barrel was removed.
- The legacy `ui/index.ts` barrel was removed.
- Tailwind-like icon utility strings were replaced with semantic CSS classes such as `.iconMd`, `.iconSm`, and `.iconSubtle`.
- The string-based style proxy was removed from runtime imports.
- The layout no longer imports a global demo style aggregate.
- Existing demo route styles now enter through a scoped CSS Module.

Remaining cleanup debt:

- `design-demo.module.css` is intentionally a temporary compatibility module and is too large.
- `component-showcase-page.tsx` still needs to be split by showcase route group.
- `section-editor-page.tsx` still needs to be split into page composition, params, results, history, and import modules.
- `design-demo-data.ts` still needs to be split into fixtures, local database loading, filesystem scanning, and shape transforms.
- `design-demo-utils.ts` still needs to be split into route mapping, navigation metadata, status helpers, and image helpers.
- Feature CSS should move from the temporary compatibility module into feature-level CSS Modules.

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

Follow-up:

- Continue moving primitive-only style from the temporary compatibility module into `ui/ui.module.css`.
- Keep each primitive self-contained.
- Remove `className`-driven primitive visual overrides in favor of component props.

## Phase 3: Tailwind Zero Dependency

Status: source utilities removed from `.tsx` code.

Follow-up:

- Keep the zero-match checks in CI or local pre-merge verification for demo changes.
- Do not introduce new Tailwind-style helper libraries in demo code.

## Phase 4: Feature CSS Modules

Status: partially complete.

Next steps:

1. Split `design-demo.module.css` by feature:
   - shell
   - showcase
   - runs
   - projects
   - presets
   - templates
   - models
   - section editor
   - system/settings
2. Import feature modules directly from the owning feature file.
3. Keep shared tokens as custom properties on the shell/root demo surface.
4. Delete selectors that only existed to patch primitive internals.

## Phase 5: Large File Split

Status: pending.

Targets:

- `component-showcase-page.tsx`
- `section-editor-page.tsx`
- `design-demo-data.ts`
- `design-demo-utils.ts`
- large feature CSS modules after Phase 4

The split must preserve route behavior, mock data shape, selected states, filters, lightboxes, and browser-visible UI.

## Phase 6: Dependency Removal Readiness

Status: pending final proof.

Required before removing dependencies:

```powershell
cmd /c npx tsc --noEmit --pretty false
cmd /c npm run lint -- src/app/design-demos
cmd /c npx next build
```

Routes to verify:

- `/design-demos/component-showcase`
- `/design-demos/component-showcase-atoms`
- `/design-demos/component-showcase-mid`
- `/design-demos/component-showcase-images`
- `/design-demos/component-showcase-editor`
- `/design-demos/component-showcase-projects`
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

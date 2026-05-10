# Design Demos Frontend Rules

This document applies only to `src/app/design-demos/**`.

The design demo shell is a standalone frontend prototype area. It should be easier to change than the production app, but it must not become a mix of one-off styles, Tailwind utilities, global CSS, and component overrides.

## Scope

- These rules cover `/design-demos/**` pages, demo-only components, demo-only data, and demo-only styles.
- Do not use these rules to change production routes outside `src/app/design-demos/**`.
- Do not edit `src/app/globals.css` to fix demo visual issues.
- Do not introduce new global CSS for demo components.

## Styling Direction

- Prefer plain CSS and CSS Modules for demo code.
- Do not use Tailwind utility classes for new demo layout, spacing, typography, colors, borders, shadows, or component states.
- Existing tiny icon utilities such as `size-4` may remain temporarily, but new code should prefer CSS Module classes or component props.
- Do not introduce new `cva`, `tailwind-merge`, shadcn-style variants, or Tailwind-based primitive components inside `src/app/design-demos/**`.
- Use CSS custom properties for shared demo tokens, not Tailwind theme coupling.

## Component Layers

Use these layers and keep ownership clear:

1. `ui/`: reusable demo UI primitives.
2. `section-editor-*`, `project-*`, `runs-*`, `preset-*`: feature components.
3. `component-showcase-page.tsx`: showcase composition only.
4. `design-demo-styles/`: legacy route and feature CSS while migration is in progress.

New reusable controls belong in `ui/`, not inside a feature page.

## UI Primitive Rules

Files in `src/app/design-demos/ui/` must be self-contained.

- A UI primitive must not import `../design-demo-styles`.
- A UI primitive should use a colocated or shared UI CSS Module, currently `ui.module.css`.
- A UI primitive must expose visual differences through props such as `tone`, `size`, `variant`, `shape`, `pressed`, or `disabled`.
- A UI primitive must not require callers to pass external CSS to look correct.
- `className` is allowed only for layout integration, not for changing the primitive's internal visual anatomy.
- If a caller needs a new visual style, add a real prop or variant to the primitive instead of passing a feature CSS class.

Bad:

```tsx
<Button className={s.iconGhostBtn} icon={X} iconOnly />
```

Good:

```tsx
<Button icon={X} iconOnly tone="danger" size="sm" />
```

## Feature Component Rules

Feature components may own layout and local feature structure.

- Feature CSS may position primitives, define grids, define rows, and set feature-specific spacing.
- Feature CSS must not reach into primitive internals such as `.button`, `.switchThumb`, or generated CSS Module class names.
- Feature components should not pass old visual classes into primitives.
- If feature styling repeatedly modifies the same primitive, move that behavior into the primitive as a prop.

## CSS Module Rules

- Use CSS Modules for new reusable component styles.
- Keep module class names semantic: `.switchTrack`, `.buttonIconOnly`, `.imageThumbMedium`.
- Keep interactive states in the same module as the component: hover, focus-visible, disabled, selected, checked, pending.
- Prefer stable dimensions for controls: buttons, switches, segmented items, thumbnails, toolbars, and rows should not resize when state changes.
- Avoid nested card styling. Use rows, rails, panels, and continuous surfaces unless a real repeated card item is being shown.

## Tailwind Policy

Tailwind remains installed for the app, but `/design-demos` should not rely on it.

Allowed temporarily:

- Existing icon sizing utilities such as `size-3.5`, `size-4`, `opacity-40`.
- Existing legacy utilities while a file is not being touched.

Not allowed in new or refactored demo code:

- Layout utilities: `flex`, `grid`, `gap-*`, `items-*`, `justify-*`.
- Spacing utilities: `p-*`, `px-*`, `py-*`, `m-*`, `mt-*`.
- Visual utilities: `bg-*`, `text-*`, `border-*`, `rounded-*`, `shadow-*`.
- State utilities or long utility strings.

When touching a file, replace nearby Tailwind utilities if the replacement is small and local.

## Showcase Rules

The component showcase must demonstrate real reusable components, not custom showcase-only copies.

- Showcase pages import primitives directly from `./ui/<component>`.
- Showcase pages should not import the compatibility barrel `./design-demo-ui` for primitives.
- Showcase samples should avoid passing feature CSS classes into primitives.
- If a component cannot be displayed correctly without extra showcase CSS, the primitive is not reusable enough yet.

## Legacy CSS Rules

`design-demo-styles/` is legacy-compatible route and feature styling.

- It may continue to style existing page shells and feature layouts.
- It should not be used by new `ui/` primitives.
- Do not add new generic primitive classes there, such as `.button`, `.switch`, `.tabs`, or `.input`.
- Gradually move reusable primitive styling from `design-demo-styles/` into `ui/`.

## Refactor Checklist

Before finishing a demo frontend change, check:

- `rg "design-demo-styles" src/app/design-demos/ui` returns no matches.
- New demo primitives do not use Tailwind utility strings.
- Existing primitives are customized through props, not feature CSS classes.
- `component-showcase-page.tsx` imports primitives from `./ui/<component>`.
- `src/app/globals.css` has no diff.
- The touched route loads locally without a 500.

For visual changes, also verify the affected `/design-demos/component-showcase*` page in the browser.

## Migration Direction

The target state is:

- `ui/` owns reusable demo primitives and their CSS Module styles.
- Feature files own feature composition and layout only.
- `component-showcase-page.tsx` is split into smaller showcase modules.
- `design-demo-styles/` remains only for route shells and legacy feature surfaces until they are migrated.
- Tailwind utilities are removed from demo code over time, starting with touched files.

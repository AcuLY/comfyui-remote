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
- Do not use Tailwind utility classes anywhere in demo code.
- Demo code must keep working after Tailwind, shadcn Tailwind CSS, `tailwind-merge`, and Tailwind-related dependencies are removed from the project.
- Do not introduce new `cva`, `tailwind-merge`, shadcn-style variants, or Tailwind-based primitive components inside `src/app/design-demos/**`.
- Use CSS custom properties for shared demo tokens, not Tailwind theme coupling.

## Component Layers

Use these layers and keep ownership clear:

1. `_shared/primitives/`: reusable demo UI primitives.
2. `_shared/patterns/`: cross-domain slot-shell components such as unit rows, folder rows, workbench surfaces, batch bars, and rails.
3. `_shared/media/` and `_shared/feedback/`: image review surfaces and operation feedback.
4. `_features/`: business adapters grouped by the new IA: `runs`, `projects`, `presets`, `templates`, `models`, `settings`, and `auth`.
5. `_showcase/`: registry-driven functional-family showcase pages.
6. Existing folders such as `ui/`, `projects/`, `runs/`, and `presets/` remain compatibility sources while migration continues.

New reusable controls belong in `_shared/primitives/`; new cross-domain structures belong in `_shared/patterns/`, not inside a feature page.

See `COMPONENT_TAXONOMY.md` for detailed ownership, family boundaries, and migration status.

## UI Primitive Rules

Files in `src/app/design-demos/ui/` must be self-contained.

- A UI primitive must not import legacy route-level style proxies.
- A UI primitive should live in `ui/<component>/` and use its own colocated CSS Module, or a deliberately shared subdomain module such as the image surface CSS.
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
- Keep module class names semantic and component-owned: `.track`, `.iconOnly`, `.imageThumbMedium`, `.projectListCard`.
- Keep interactive states in the same module as the component: hover, focus-visible, disabled, selected, checked, pending.
- Prefer stable dimensions for controls: buttons, switches, segmented items, thumbnails, toolbars, and rows should not resize when state changes.
- Avoid nested card styling. Use rows, rails, panels, and continuous surfaces unless a real repeated card item is being shown.

## Tailwind Ban

Tailwind is forbidden in `/design-demos`.

Not allowed:

- Icon utilities: `size-*`, `opacity-*`, `text-*`.
- Layout utilities: `flex`, `grid`, `gap-*`, `items-*`, `justify-*`.
- Spacing utilities: `p-*`, `px-*`, `py-*`, `m-*`, `mt-*`.
- Sizing utilities: `w-*`, `h-*`, `min-*`, `max-*`.
- Visual utilities: `bg-*`, `border-*`, `rounded-*`, `shadow-*`.
- Position utilities: `fixed`, `absolute`, `relative`, `z-*`, `translate-*`.
- State utilities, arbitrary values, or long utility strings.
- `cn`, `twMerge`, `cva`, or shadcn/Tailwind-style variant composition for demo components.

Before `/design-demos` can be treated as production-ready, these checks must pass with zero code matches:

```powershell
rg -n 'className=.*(size-|opacity-|flex|grid|gap-|px-|py-|p-|m-|w-|h-|text-|bg-|border-|rounded|shadow|items-|justify-|min-|max-|overflow|translate|z-|fixed|absolute|relative)' src/app/design-demos -g '*.tsx'
rg -n 'tailwind|twMerge|cva\\(|class-variance-authority|shadcn' src/app/design-demos -g '*.ts' -g '*.tsx' -g '*.css'
```

## Showcase Rules

The component showcase must demonstrate real reusable components, not custom showcase-only copies.

- Showcase pages are registry-driven from `_showcase/registry.ts`.
- Each component entry must have a Chinese review name, English component name, description, paths, usage contexts, status, and family id.
- Showcase pages import shared components through `_shared/*` or feature adapters through `_features/*` where possible.
- Showcase pages should not import compatibility barrels for primitives.
- Showcase samples should avoid passing feature CSS classes into primitives.
- If a component cannot be displayed correctly without extra showcase CSS, the primitive is not reusable enough yet.

## Refactor Checklist

Before finishing a demo frontend change, check:

- No old compatibility barrels, global style proxies, or route-level monolithic style modules are imported.
- Touched demo files do not use Tailwind utility strings.
- Existing primitives are customized through props, not feature CSS classes.
- `component-showcase-page.tsx` routes through `_showcase` pages and `_showcase/registry.ts`.
- `src/app/globals.css` has no diff.
- The touched route loads locally without a 500.

For visual changes, also verify the affected `/design-demos/component-showcase*` page in the browser.

## Migration Direction

The target state is:

- `ui/` owns reusable demo primitives and their CSS Module styles.
- Feature files own feature composition and layout only.
- `component-showcase-page.tsx` is split into smaller showcase modules.
- Feature styles are split into explicit CSS Modules colocated with the owning feature/page.
- Tailwind utilities are fully removed from demo code before the demo shell is officially enabled.

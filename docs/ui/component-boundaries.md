# UI Component Boundaries

This document is the current ownership map for shared UI component layers. Update it when a component moves between `src/components/ui`, `src/components/design-demo-ui`, production feature UI, or design-demo-only UI.

## `src/components/ui`

These files are shadcn-style local copies that are production-supported only as low-level primitives. They should stay small, accessible, and free of feature-specific product language.

| File | Status | Owner | Use |
| --- | --- | --- | --- |
| `src/components/ui/button.tsx` | production-supported shadcn local copy | ui-primitives | generic production button primitive |
| `src/components/ui/input.tsx` | production-supported shadcn local copy | ui-primitives | generic production input primitive |
| `src/components/ui/select.tsx` | production-supported shadcn local copy | ui-primitives | generic production select primitive |
| `src/components/ui/separator.tsx` | production-supported shadcn local copy | ui-primitives | generic visual separator |
| `src/components/ui/sheet.tsx` | production-supported shadcn local copy | ui-primitives | generic sheet/dialog primitive |
| `src/components/ui/sidebar.tsx` | production-supported shadcn local copy | ui-primitives | generic sidebar primitive through wrapper owners |
| `src/components/ui/skeleton.tsx` | production-supported shadcn local copy | ui-primitives | generic loading placeholder |
| `src/components/ui/tooltip.tsx` | production-supported shadcn local copy | ui-primitives | generic tooltip primitive |

`src/components/ui/sidebar.tsx` is not a training shell dependency. Production surfaces that need the shadcn sidebar should go through an explicit owner wrapper such as `src/components/section-sidebar-nav.tsx`; training-owned shell files under `src/features/training/**` and `src/app/training/**` must not import `@/components/ui/sidebar` directly.

## `src/components/design-demo-ui`

`src/components/design-demo-ui/` is the design-demo component system. It contains route/demo primitives, media components, feedback affordances, and reusable patterns that mirror the visual demo language. It is not the default production primitive layer.

Current production training pages may temporarily import `src/components/design-demo-ui/` while the training frontend continues its migration from design demos. New shared production primitives should be added to `src/components/ui` or a focused `src/components/*` owner instead of expanding design-demo namespaces.

Design-demo-only primitives should remain under `src/components/design-demo-ui/`, with regression coverage from:

- `src/components/design-demo-ui/media/image-accessibility.test.ts`
- `src/components/design-demo-ui/primitives/controls-interaction.test.mjs`
- `src/components/design-demo-ui/primitives/field/field.test.ts`
- `src/components/design-demo-ui/feedback/provider-theme.test.mjs`

## Verification

- Run `node --import tsx --test tests/test-ui-component-boundaries.test.ts` after changing this document or UI import boundaries.
- Run the relevant design-demo primitive or media tests when touching `src/components/design-demo-ui/**`.
- Run `npm run lint` after React component boundary changes.

# Design Demos Tailwind Cleanup Plan

This plan applies only to `src/app/design-demos/**`.

Goal: `/design-demos` must have zero Tailwind dependency before it is officially enabled. The project should be able to remove Tailwind-related packages without breaking any demo page.

## Current State

Tailwind is still globally available in the app, but demo code should not depend on it.

Current demo usage is mostly icon utilities:

- `size-3`, `size-3.5`, `size-4`, `size-5`, `size-6`, `size-8`
- `opacity-20`, `opacity-40`, `opacity-60`
- one documentation example in `svg-icon.tsx`

Known affected demo areas:

- `design-demo-shell.tsx`
- `model-pages.tsx`
- `preset-pages.tsx`
- `runs-page.tsx`
- `section-editor-controls.tsx`
- `section-editor-header.tsx`
- `section-editor-lora-history.tsx`
- `section-editor-page.tsx`
- `section-editor-presets.tsx`
- `system-pages.tsx`
- `ui/image-preview-frame.tsx`
- `ui/image-thumb-medium.tsx`
- `ui/image-thumb-small.tsx`
- `ui/metric-card.tsx`
- `svg-icon.tsx` comment/example

## Target State

- No Tailwind utility classes in `src/app/design-demos/**/*.tsx`.
- No Tailwind-specific helpers or variant systems in demo code.
- No demo styling in `src/app/globals.css`.
- Demo UI primitives use CSS Modules and component props.
- Feature components use feature CSS for layout only.
- Demo routes still render correctly after Tailwind CSS imports are removed from the project.

## Cleanup Order

### Phase 1: UI Primitive Cleanup

Scope:

- `src/app/design-demos/ui/**`

Tasks:

- Replace icon utilities in UI primitives with CSS Module classes.
- Add semantic icon classes to `ui.module.css`, such as `.iconXs`, `.iconSm`, `.iconMd`, `.iconLg`, `.iconMuted`, `.iconFaint`.
- Remove `cx("size-*", ...)` patterns from primitives.
- Keep primitive visual differences behind props, not external classes.

Exit checks:

```powershell
rg -n 'className=.*(size-|opacity-|text-)' src/app/design-demos/ui -g '*.tsx'
rg -n 'design-demo-styles' src/app/design-demos/ui
cmd /c npx tsc --noEmit --pretty false
```

### Phase 2: Shell And Navigation Cleanup

Scope:

- `design-demo-shell.tsx`
- `system-pages.tsx`

Tasks:

- Replace all `size-*` icon classes with shell/system CSS classes.
- Add shell-level icon classes to the existing shell CSS or an appropriate CSS Module.
- Keep nav layout and mobile topbar behavior unchanged.

Exit checks:

```powershell
rg -n 'className=.*(size-|opacity-)' src/app/design-demos/design-demo-shell.tsx src/app/design-demos/system-pages.tsx
cmd /c npx tsc --noEmit --pretty false
```

### Phase 3: Model, Preset, Run, And Section Pages

Scope:

- `model-pages.tsx`
- `preset-pages.tsx`
- `runs-page.tsx`
- `section-editor-*.tsx`
- `section-editor-page.tsx`

Tasks:

- Replace icon utilities with semantic classes owned by the feature CSS.
- Replace opacity utilities with named classes such as `.iconMuted`, `.iconSubtle`, `.emptyIcon`.
- Remove Tailwind classes from inline Lucide icons.
- Preserve current visual size and opacity unless a deliberate design change is requested.

Exit checks:

```powershell
rg -n 'className=.*(size-|opacity-|text-|bg-|border-|rounded|shadow)' src/app/design-demos -g '*.tsx'
cmd /c npx tsc --noEmit --pretty false
```

### Phase 4: Showcase And Inventory Cleanup

Scope:

- `component-showcase-page.tsx`
- `COMPONENT_INVENTORY.md`
- `README.md`
- `FRONTEND_RULES.md`

Tasks:

- Ensure showcase samples do not use Tailwind classes.
- Update component inventory entries if CSS classes or props changed.
- Keep cleanup docs current with the actual remaining inventory.

Exit checks:

```powershell
rg -n 'className=.*(size-|opacity-|flex|grid|gap-|px-|py-|p-|m-|w-|h-|text-|bg-|border-|rounded|shadow|items-|justify-|min-|max-|overflow|translate|z-|fixed|absolute|relative)' src/app/design-demos -g '*.tsx'
```

### Phase 5: Dependency Removal Readiness

This phase does not remove dependencies by itself. It proves demo readiness before the project removes Tailwind.

Tasks:

- Temporarily verify that demo code has no Tailwind-specific source usage.
- Confirm `src/app/globals.css` is not needed by demo-specific styles.
- Confirm all demo routes still load through local HTTP.

Required zero-match checks:

```powershell
rg -n 'className=.*(size-|opacity-|flex|grid|gap-|px-|py-|p-|m-|w-|h-|text-|bg-|border-|rounded|shadow|items-|justify-|min-|max-|overflow|translate|z-|fixed|absolute|relative)' src/app/design-demos -g '*.tsx'
rg -n 'tailwind|twMerge|cva\\(|class-variance-authority|shadcn' src/app/design-demos -g '*.ts' -g '*.tsx' -g '*.css'
git diff -- src/app/globals.css
```

Required route checks:

```powershell
/design-demos/component-showcase
/design-demos/component-showcase-atoms
/design-demos/component-showcase-mid
/design-demos/component-showcase-images
/design-demos/component-showcase-editor
/design-demos/component-showcase-projects
/design-demos/runs
/design-demos/projects
/design-demos/models
/design-demos/presets
/design-demos/settings
```

## Acceptance Criteria

The cleanup is complete only when:

- The zero-match checks above return no demo code matches.
- `cmd /c npx tsc --noEmit --pretty false` passes.
- `cmd /c npx next build` passes.
- Local demo routes return non-500.
- Public root remains non-500 after the normal deployment flow.
- No changes are made to production route styling outside `src/app/design-demos/**`.
- `src/app/globals.css` has no demo-specific diff.

## Commit Strategy

Use small commits by cleanup phase:

1. `refactor: remove tailwind from demo ui primitives`
2. `refactor: remove tailwind from demo shell`
3. `refactor: remove tailwind from demo feature pages`
4. `docs: update demo tailwind cleanup inventory`

Do not mix dependency removal with demo code cleanup. Dependency removal should be a separate final commit after all checks pass.

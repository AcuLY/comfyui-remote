# Design Demos

This directory implements the routable `/design-demos` frontend shell.

## Files

- `[[...route]]/page.tsx`: optional catch-all route for every product page shell.
- `[[...route]]/loading.tsx`: local route skeleton that uses the same glass design system.
- `design-demo-data.ts`: server-side mock loader. It reads `.env`, opens the local SQLite database when available, scans `MODEL_BASE_DIR`, and returns browser-safe mock data.
- `design-demo-client.tsx`: client shell, navigation, route dispatch, and remaining page skeletons.
- `design-demo-ui.tsx`: reusable UI primitives, feedback toasts, image grids, and shared lightbox behavior.
- `design-demo-utils.ts`: route mapping, shared types, navigation metadata, and browser-safe data helpers.
- `runs-page.tsx`: task workbench and run review pages.
- `design-demo.module.css`: local design tokens and component styles for the demo.

## Route Mapping

The route `/design-demos/projects/[id]` renders the shell for the real product route `/projects/[id]`.
`/design-demos/projects/[id]/results` is kept as a deep-link alias for the same project shell in result-card mode.
The design shell also normalizes the old product paths: `/queue/**` is shown as `/design-demos/runs/**`, and `/assets/**` is shown without the assets prefix.

- `/design-demos/runs`
- `/design-demos/runs/[runId]`
- `/design-demos/projects`
- `/design-demos/projects/new`
- `/design-demos/projects/[projectId]`
- `/design-demos/projects/[projectId]/edit`
- `/design-demos/projects/[projectId]/results`
- `/design-demos/projects/[projectId]/batch-create`
- `/design-demos/projects/[projectId]/sections/[sectionId]`
- `/design-demos/projects/[projectId]/sections/[sectionId]/results`
- `/design-demos/models`
- `/design-demos/loras`
- `/design-demos/presets`
- `/design-demos/presets/categories/new`
- `/design-demos/presets/categories/[categoryId]/edit`
- `/design-demos/presets/[presetId]`
- `/design-demos/preset-groups/[groupId]`
- `/design-demos/presets/sort-rules`
- `/design-demos/templates`
- `/design-demos/templates/new`
- `/design-demos/templates/[templateId]/edit`
- `/design-demos/templates/[templateId]/sections/[sectionIndex]`
- `/design-demos/settings`
- `/design-demos/settings/logs`
- `/design-demos/settings/monitor`
- `/design-demos/login`

## Page-Internal Switching

The shell also covers non-routing UI states that the real pages expose:

- Run tabs: pending, running, failed, trash, including row lists, page-number pagination, and trash recovery actions.
- Result/review filters: all, pending, kept, featured, including selectable grids, batch actions, undo affordance, lightbox preview, and keyboard image navigation.
- Project workflow states: section rail sync, compact section list, batch selection, project/result card toggle, section result collapse, project action strip, run-group results, and image lightbox.
- Project batch-create states: preset/group browser, category switcher, folder breadcrumb, search, import list, variant override, section sizing, and recent-created links.
- Section editor states: sticky local header, previous/next section links, params, preset bindings, prompt blocks, LoRA, import preset, and history diff.
- Template editor states: right-side section rail, synchronized section list, create/edit mode split, metadata fields, and section row actions.
- Model manager states: LoRA/checkpoint switch, folder browser, upload location, file detail, notes, move-target sheet, loading/error/empty directory states.
- Preset library states: category rail, folder breadcrumb, folder rows, full-row preset/group links, batch selection bar, and move-target sheet; category create/edit lives on dedicated pages.
- Preset detail states: continuous edit surface with basic info, current variant rail, prompt fields, LoRA1/2 bindings, linked variants, cascade/delete guards, and history diff.
- Preset group states: group metadata, row-based member editing, variant selection, member removal affordance, flatten preview, delete return path, and history diff.
- Sort rule states: four independent order panels for positive prompt, negative prompt, LoRA1, and LoRA2 with drag handles and saved-state affordances.
- Preset/group/template history diff placeholders.
- Logs states: source tabs, level/module filters, monospaced viewer, tail/auto-scroll state, and empty filter state.
- Monitor states: managed/external branch switch, start/stop/restart/probe controls, Worker/API/task backlog status, probe result, and process log viewer.
- Global operation states: toast stack, disabled/pending button styling, inline operation strips, and route-level loading skeleton.

## Current Design Convergence

- Styling is scoped to `src/app/design-demos/**`; do not edit `src/app/globals.css` for this shell.
- The visual language follows `DESIGN.md`: pale gradients, frosted glass surfaces, compact typography, restrained green actions, and row-first workbench depth.
- Desktop keeps a fixed, collapsible global left navigation. Project, section editor, and section results pages keep the section navigator on the right; project detail and project results share one shell with a two-state card toggle.
- Template edit and template section pages follow the same right-side section navigator pattern so the global left navigation remains dedicated to product areas.
- Mobile keeps only the bottom `任务 / 项目 / 更多` navigation. Project-internal section navigation uses a narrow side rail instead of horizontal tabs.
- Mobile task metrics use a compact two-column stat strip, and the preset category manager becomes a horizontal rail so it does not squeeze the preset list.
- Back navigation is rendered as a low-emphasis header link; primary actions stay in the header action area.
- Task and review pages use row-based work surfaces and selectable result grids instead of nested summary cards.
- Project list, settings entries, log filters, monitor statuses, and metric summaries now use single-surface rows or stat strips instead of repeated standalone cards.
- Preset category create/edit is a standalone page with a single main surface, inline delete guard, and group slot editing when the category type is preset group.
- Preset library list pages use one continuous workbench instead of separate folder/batch tabs, matching the real file-browser workflow.
- Preset detail and preset group detail pages now use continuous editor surfaces instead of abstract tab pages.
- Preset sort rules use four DnD-like panels instead of a summary table.
- Logs use a terminal-like viewer instead of an audit table, and monitor uses a process-control workbench instead of a JSON state card.
- Project and section pages avoid nested cards: the main work area uses a single surface layer with rows, action strips, and compact state bars inside it.
- Project-level operations live in the page action strip; right-side section rail is reserved for navigation and scroll sync. Project results are the same section list in result-card mode, not a separate page layout.
- Project batch-create uses a real workbench structure instead of a generic batch-parameter form: browser on the left, import/configuration flow on the right.
- Template list and editor pages use row-based summaries and continuous editor surfaces instead of nested card panels.
- Model file management uses a single browser surface plus a right inspector; move target selection is handled by a modal sheet instead of nested target cards.

## Scope Guard

- Keep changes isolated to `src/app/design-demos/**` and `docs/design-demos-frontend-parity.md`.
- Do not use `src/app/globals.css` to fix this shell.
- Do not edit real frontend pages for route or style parity unless the task explicitly changes scope.

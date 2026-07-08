# Project Page Boundaries

This document is the maintained ownership map for generation project pages under `src/app/projects/**`. Update it when route containers, client state owners, or focused project UI modules move.

## Boundary Map

| Surface | Route/container boundary | UI/state boundary | Follow-up split checkpoint |
| --- | --- | --- | --- |
| Project list | `src/app/projects/page.tsx` owns `folder` search param validation plus `listProjects()` and `listProjectFolders()` data loading. | `src/app/projects/projects-client.tsx` owns folder navigation, archive visibility, selection, drag sorting, folder mutations, and list rendering. | Extract filtering, sorting, and folder state into hooks under a project UI module before changing list behavior. |
| Create project | `src/app/projects/new/page.tsx` owns create-form option loading; `src/app/projects/new/from-existing/page.tsx` also loads source projects and folders. | `src/app/projects/new/project-form.tsx` owns create/create-from-existing form state, preset selection, source-project selection, and submit behavior. | Keep new/from-existing route URLs stable; split form state only after create-action coverage is in place. |
| Project detail | `src/app/projects/[projectId]/page.tsx` owns project and preset-library loading, `sectionFolder` validation, and `notFound()`. | `src/app/projects/[projectId]/project-detail-client.tsx` owns section folder state, compact mode, scroll anchoring, sidebar state, dialogs, and delegates card rendering to `src/app/projects/[projectId]/section-cards.tsx`. | Move section card rendering into shared project components with typed props, then split folder/navigation state into hooks. |
| Edit project | `src/app/projects/[projectId]/edit/page.tsx` owns edit-data/form-options loading and missing-project handling. | `src/app/projects/[projectId]/edit/project-edit-form.tsx` owns editable fields, preset selections, KSampler defaults, apply-all calls, and save navigation. | Split form state, preset binding editor, default-parameter editor, and apply-all adapter before changing edit behavior. |
| Batch create | `src/app/projects/[projectId]/batch-create/page.tsx` owns preset-library/project loading and missing-project display. | `src/app/projects/[projectId]/batch-create/batch-create-client.tsx` owns import list, preset/group browsing, folder/search state, binding overrides, creation feedback, and submit behavior. | Split browser state, import list rendering, binding override logic, and create-section mutation adapter. |
| Section edit | `src/app/projects/[projectId]/sections/[sectionId]/page.tsx` owns edit-page data loading, sibling navigation, resolved-config mapping, return hrefs, and the server action bridge for LoRA config. | `src/app/projects/[projectId]/sections/[sectionId]/section-params-form.tsx`, `section-name-editor.tsx`, `section-change-history.tsx`, and `section-switch-navigation.tsx` own focused UI islands around the route container. | Extract resolved prompt/parameter mapping out of the route before further UI edits; keep keyboard section switching covered. |
| Section results | `src/app/projects/[projectId]/sections/[sectionId]/results/page.tsx` owns section-results loading, project/section guard, return/prefetch hrefs, and neighbor navigation. | `src/app/projects/[projectId]/sections/[sectionId]/results/results-grid.tsx` owns review selection, quick run, trash/censor actions, keyboard shortcuts, and gallery handoff; `results-gallery.tsx` owns the lightbox provider. | Keep G shortcut and hard-navigation tests green while splitting review toolbar, image grid, and mutation adapters. |
| Project results | `src/app/projects/[projectId]/results/page.tsx` owns aggregate project-results loading and `notFound()`. | `src/app/projects/[projectId]/results/project-results-client.tsx` owns sidebar/navigation coordination, collapsed-row state, keyboard shortcuts, and lightbox display mode while filter state, toolbar rendering, gallery rendering, lightbox shell, and mutation behavior live in focused project-results modules. | Later changes should keep these split boundaries stable unless a smaller owner module is added. |

Loading states remain colocated under their route segments for now. A later loading-state cleanup can extract shared skeleton pieces without moving route-specific fallback ownership.

## Verification

- Run the focused project page source tests for the surface being changed.
- Run `node --import tsx --test "tests/*.test.ts"` after boundary or route-container changes.
- Run `npm run lint` after React route or component changes.

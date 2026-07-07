# Legacy Static Design Demos

This document classifies the older static files under `design-demos/`. The maintained routable design-demo app now lives under `src/app/design-demos/**`; route parity and governance live in `docs/design-demos-frontend-parity.md` and `docs/ui/design-demo-governance.md`.

The future archive directory for retained static files is `docs/archive/design-demos/`. Do not move files there in a behavior or UI refactor batch; archive movement should be a later documentation cleanup batch with link updates.

## File Status

| file | status | replacement or current source | production page informed | next action |
| --- | --- | --- | --- | --- |
| `design-demos/README.md` | archival | `docs/ui/legacy-static-design-demos.md`, `docs/ui/design-demo-governance.md` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/app.html` | archival | `src/app/design-demos/[[...route]]/page.tsx`, `src/components/design-demo-shell/**` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/full-demo.html` | archival | `src/app/design-demos/[[...route]]/page.tsx`, `src/app/design-demos/routing/routes.ts` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/index.html` | archival | routable `/design-demos` app and `src/app/design-demos/README.md` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/router.js` | archival | `src/app/design-demos/routing/routes.ts`, `src/app/design-demos/routing/href.ts` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/design-system.css` | superseded by Next design-demo | `src/app/design-demos/**.module.css`, `src/components/design-demo-ui/**`, `docs/ui/component-boundaries.md` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/components/components.css` | superseded by Next design-demo | `src/components/design-demo-ui/**`, `src/components/design-demo-shell/**` | none | move to `docs/archive/design-demos/` in a later docs cleanup batch |
| `design-demos/v2-projects-page.html` | superseded by Next design-demo | `/design-demos/projects`, `src/app/design-demos/features/projects/**` | `/projects` | move to `docs/archive/design-demos/` after final screenshot/reference review |
| `design-demos/v2-queue-page.html` | superseded by Next design-demo | `/design-demos/runs`, `src/app/design-demos/features/runs/**` | `/queue` | move to `docs/archive/design-demos/` after final screenshot/reference review |
| `design-demos/v2-review-page.html` | superseded by Next design-demo | `/design-demos/runs/:runId`, `src/app/design-demos/features/runs/review-page.tsx` | `/queue/[runId]` | move to `docs/archive/design-demos/` after final screenshot/reference review |
| `design-demos/pages-checklist.md` | archival | `docs/design-demos-frontend-parity.md`, `docs/ui/design-demo-governance.md` | none | move to `docs/archive/design-demos/` after parity doc remains current |
| `design-demos/style-audit-report.md` | archival | carried-forward notes below, `docs/frontend-design-guide.md`, `docs/ui/component-boundaries.md` | none | move to `docs/archive/design-demos/` after design QA confirms no live issue remains only here |

## Carried-Forward Notes

The deleted `design-demos/todo.txt` contained live notes that should remain visible in maintained docs. Carry them forward here until each item is either fixed in the Next design-demo app or moved into a more specific UI issue.

- Redesign the `loading state page` for the routable demo shell before changing loading visuals.
- Review `ImageThumbMedium` selected checkbox contrast and status tag readability in light and dark themes.
- Ensure `ImagePreviewFrame` and `ImagePreviewLarge` use `object-fit: contain` for horizontal images and allow backdrop-click dismissal from empty preview space.
- Align `DimensionsReadout` height with `SegmentControl`.
- Fix `SegmentControl` styling when it visually merges with the following card or panel surface.
- On `/projects/:id/sections/:id`, remove the old header once the new header owns previous/next, workflow download, batch size selection, and run action ordering.

## Verification

Run the focused governance check after changing this document or deleting legacy static files:

```bash
node --import tsx --test tests/test-legacy-static-design-demos.test.ts tests/test-repo-inventory.test.ts
```

If tracked files are added, removed, renamed, or moved, regenerate the inventory:

```bash
npx tsx scripts/docs/generate-repo-inventory.ts
```

# Design Demos

This directory implements the routable `/design-demos` frontend shell.

## Files

- `[[...route]]/page.tsx`: optional catch-all route for every product page shell.
- `design-demo-data.ts`: server-side mock loader. It reads `.env`, opens the local SQLite database when available, scans `MODEL_BASE_DIR`, and returns browser-safe mock data.
- `design-demo-client.tsx`: client shell, navigation, page skeletons, and reusable UI primitives.
- `design-demo.module.css`: local design tokens and component styles for the demo.

## Route Mapping

The route `/design-demos/projects/[id]` renders the shell for the real product route `/projects/[id]`.
The same prefix rule applies to all existing pages:

- `/design-demos/queue`
- `/design-demos/queue/[runId]`
- `/design-demos/projects`
- `/design-demos/projects/new`
- `/design-demos/projects/[projectId]`
- `/design-demos/projects/[projectId]/edit`
- `/design-demos/projects/[projectId]/results`
- `/design-demos/projects/[projectId]/batch-create`
- `/design-demos/projects/[projectId]/sections/[sectionId]`
- `/design-demos/projects/[projectId]/sections/[sectionId]/results`
- `/design-demos/assets/models`
- `/design-demos/assets/loras`
- `/design-demos/assets/presets`
- `/design-demos/assets/presets/[presetId]`
- `/design-demos/assets/preset-groups/[groupId]`
- `/design-demos/assets/presets/sort-rules`
- `/design-demos/assets/templates`
- `/design-demos/assets/templates/new`
- `/design-demos/assets/templates/[templateId]/edit`
- `/design-demos/assets/templates/[templateId]/sections/[sectionIndex]`
- `/design-demos/settings`
- `/design-demos/settings/logs`
- `/design-demos/settings/monitor`
- `/design-demos/login`

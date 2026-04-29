# Agent HTTP API

This document is for automation agents that need to operate ComfyUI Manager through HTTP instead of Next.js server actions.

## Conventions

- Base URL: `https://comfy.bgmss.fun` in production, or the local Next.js origin during development.
- Most endpoints return:

```json
{ "ok": true, "data": {} }
```

or:

```json
{ "ok": false, "error": { "message": "Error message", "details": {} } }
```

- Agents can authenticate API requests with the configured `AUTH_TOKEN` in either `Authorization: Bearer <token>` or `x-api-token: <token>`. The proxy accepts this header-token mode for `/api/**` routes and skips the browser cookie check.
- Agents can also send the browser `auth_token` cookie when available. `src/proxy.ts` has an allowlist for several API namespaces, but root collection routes such as `GET/POST /api/projects` require either the cookie or the header token.
- Public allowlisted namespaces include `/api/agent`, `/api/queue`, `/api/runs`, `/api/images`, `/api/trash`, `/api/loras/`, `/api/comfy`, `/api/mcp`, `/api/health`, logs, audit logs, worker status, path maps, and nested `/api/projects/:projectId/...` routes.
- ComfyUI process write controls (`/api/comfy/start`, `/api/comfy/stop`, `/api/comfy/restart`) are limited to localhost by the route handler.
- The UI may still call server actions directly, but the user-facing backend operations have HTTP equivalents listed below.

## Coverage Check

| User operation | HTTP interface |
| --- | --- |
| Create, list, read, update, delete projects | `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:projectId` |
| Copy project | `POST /api/projects/:projectId/copy` |
| Run all project sections | `POST /api/projects/:projectId/run` |
| Cancel active project runs | `POST /api/projects/:projectId/cancel-runs` |
| Export kept project images | `POST /api/projects/:projectId/export` |
| Save project as template | `POST /api/projects/:projectId/save-as-template` |
| Add, update, rename, delete sections | `POST /api/projects/:projectId/sections`, `PATCH/DELETE /api/projects/:projectId/sections/:sectionId` |
| Batch delete sections | `POST /api/projects/:projectId/sections/batch-delete` |
| Reorder sections | `POST /api/projects/:projectId/sections/reorder` |
| Copy section | `POST /api/projects/:projectId/sections/:sectionId/copy` |
| Create section from template | `POST /api/projects/:projectId/sections/:sectionId/create-from-template` |
| Run one section | `POST /api/projects/:projectId/sections/:sectionId/run` |
| Import preset into section | `POST /api/projects/:projectId/sections/:sectionId/import-preset` |
| Switch a section binding variant | `POST /api/projects/:projectId/sections/:sectionId/switch-variant` |
| Manage prompt blocks | `GET/POST /api/projects/:projectId/sections/:sectionId/blocks`, `PATCH/DELETE /api/projects/:projectId/sections/:sectionId/blocks/:blockId` |
| List queue and clear finished runs | `GET /api/queue`, `POST /api/queue/clear` |
| Cancel a run | `POST /api/runs/:runId/cancel` |
| Read run detail and workflow | `GET /api/runs/:runId`, `GET /api/runs/:runId/workflow` |
| Keep or trash generated images | `POST /api/runs/:runId/review/keep`, `POST /api/runs/:runId/review/trash` |
| Restore trashed images | `POST /api/images/:imageId/restore` |
| Toggle featured image | `POST /api/images/:imageId/featured` |
| Read image files | `GET /api/images/:path...` |
| Manage templates | `GET/POST /api/templates`, `GET/PATCH/DELETE /api/templates/:templateId`, `POST /api/templates/:templateId/import` |
| Manage preset library | `/api/preset-library/**` endpoints listed below |
| Upload/list/move/annotate LoRAs | `GET/POST /api/loras`, `GET /api/loras/browse`, `POST /api/loras/move`, `GET/PUT /api/loras/notes` |
| Read logs, audit logs, health, worker status | `GET /api/logs`, `GET /api/audit-logs`, `GET /api/health`, `GET /api/worker/status` |
| MCP automation | `GET/POST/DELETE /api/mcp` |

No remaining user-facing backend operation gap is known after adding `queue/clear`, section `batch-delete`, project `export`, and `name/loraConfig` support on section PATCH.

## Projects

### `GET /api/projects`

Query parameters:

- `search?: string`
- `status?: "draft" | "queued" | "running" | "partial_done" | "done" | "failed"`
- `enabledOnly?: boolean`
- `hasPending?: boolean`

Returns the project list.

### `POST /api/projects`

Body:

```json
{ "title": "Project title", "notes": "optional notes" }
```

Creates a project and returns the created record.

### `GET /api/projects/:projectId`

Returns project detail with sections, runs, and image summaries.

### `PATCH /api/projects/:projectId`

Body supports:

```json
{ "aspectRatio": "2:3", "batchSize": 2 }
```

Use `null` to clear nullable fields where supported.

### `DELETE /api/projects/:projectId`

Deletes the project and cascaded data.

### Project Commands

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/api/projects/:projectId/copy` | none | creates a copied project |
| `POST` | `/api/projects/:projectId/run` | `{ "overrideBatchSize": 4 }` optional | enqueues and submits all enabled sections |
| `POST` | `/api/projects/:projectId/cancel-runs` | none | cancels queued/running runs for the project |
| `POST` | `/api/projects/:projectId/export` | none | exports kept images into `data/export` |
| `POST` | `/api/projects/:projectId/save-as-template` | template metadata | saves the current project as a reusable template |

## Sections

### `POST /api/projects/:projectId/sections`

Body:

```json
{ "name": "Section name" }
```

Creates a section and returns `{ "id": "..." }`.

### `PATCH /api/projects/:projectId/sections/:sectionId`

Body supports:

```json
{
  "name": "Section name",
  "positivePrompt": "positive prompt override",
  "negativePrompt": "negative prompt override",
  "aspectRatio": "2:3",
  "shortSidePx": 768,
  "batchSize": 2,
  "seedPolicy1": "random",
  "seedPolicy2": "fixed",
  "ksampler1": { "steps": 30, "cfg": 7 },
  "ksampler2": { "steps": 20, "cfg": 6 },
  "upscaleFactor": 2,
  "loraConfig": { "lora1": [], "lora2": [] }
}
```

All fields are optional, but at least one supported field must be present.

### Section Commands

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `DELETE` | `/api/projects/:projectId/sections/:sectionId` | none | deletes one section |
| `POST` | `/api/projects/:projectId/sections/batch-delete` | `{ "sectionIds": ["..."] }` | deletes multiple sections in the project |
| `POST` | `/api/projects/:projectId/sections/reorder` | `{ "sectionIds": ["id1", "id2"] }` | updates section order |
| `POST` | `/api/projects/:projectId/sections/:sectionId/copy` | none | copies a section |
| `POST` | `/api/projects/:projectId/sections/:sectionId/run` | `{ "overrideBatchSize": 2 }` optional | enqueues and submits one section |
| `POST` | `/api/projects/:projectId/sections/:sectionId/create-from-template` | template section creation payload | creates a section from a project template section |
| `POST` | `/api/projects/:projectId/sections/:sectionId/import-preset` | `{ "presetId": "...", "variantId": "...", "groupBindingId": "..." }` | imports a preset block into the section |
| `POST` | `/api/projects/:projectId/sections/:sectionId/switch-variant` | `{ "bindingId": "...", "newVariantId": "..." }` | switches the preset variant for an existing binding |

## Prompt Blocks

### `GET /api/projects/:projectId/sections/:sectionId/blocks`

Lists prompt blocks for a section.

### `POST /api/projects/:projectId/sections/:sectionId/blocks`

Creates a prompt block when the body is an object. Reorders blocks when the body is an array of block IDs.

Typical create body:

```json
{
  "type": "custom",
  "label": "Lighting",
  "positive": "soft light",
  "negative": "overexposed",
  "sortOrder": 10
}
```

### `PATCH /api/projects/:projectId/sections/:sectionId/blocks/:blockId`

Updates one prompt block.

### `DELETE /api/projects/:projectId/sections/:sectionId/blocks/:blockId`

Deletes one prompt block.

## Runs, Queue, And Review

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/queue` | none | queue summary |
| `GET` | `/api/queue-data` | none | queue page data; this route is a response-shape exception and may return raw JSON |
| `POST` | `/api/queue/clear` | none | deletes finished, failed, and cancelled run records |
| `GET` | `/api/runs/:runId` | none | run detail |
| `GET` | `/api/runs/:runId/workflow` | none | workflow data for the run |
| `POST` | `/api/runs/:runId/cancel` | none | cancels a queued/running run |
| `POST` | `/api/runs/:runId/review/keep` | `{ "imageIds": ["..."] }` | marks images kept |
| `POST` | `/api/runs/:runId/review/trash` | `{ "imageIds": ["..."], "reason": "optional" }` | trashes images |
| `GET` | `/api/trash` | none | lists trashed images |
| `POST` | `/api/images/:imageId/restore` | none | restores one trashed image |
| `POST` | `/api/images/:imageId/featured` | `{ "featured": true }` | toggles featured flag |
| `GET` | `/api/images/:path...` | none | serves image files |

## Templates

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/templates` | none | lists project templates |
| `POST` | `/api/templates` | template payload | creates a template |
| `GET` | `/api/templates/:templateId` | none | reads template detail |
| `PATCH` | `/api/templates/:templateId` | template patch payload | updates a template |
| `DELETE` | `/api/templates/:templateId` | none | deletes a template |
| `POST` | `/api/templates/:templateId/import` | `{ "projectId": "..." }` and options | imports a template into a project |

Template payloads follow `src/lib/actions/template.ts`: `name`, `description`, and `sections`.

## Preset Library

### Categories

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/preset-library/categories` | create category |
| `PATCH/DELETE` | `/api/preset-library/categories/:categoryId` | update or delete category |
| `POST` | `/api/preset-library/categories/reorder` | reorder categories |
| `POST` | `/api/preset-library/categories/:categoryId/sort-orders` | update category sort order dimensions |
| `POST` | `/api/preset-library/categories/:categoryId/slot-template` | update slot template |
| `POST` | `/api/preset-library/categories/:categoryId/groups/reorder` | reorder groups in a category |

### Folders

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/preset-library/folders` | create folder |
| `PATCH/DELETE` | `/api/preset-library/folders/:folderId` | rename or delete folder |
| `POST` | `/api/preset-library/folders/:folderId/move` | move presets/groups into a folder |
| `POST` | `/api/preset-library/folders/reorder` | reorder folders |

### Groups And Members

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/preset-library/groups` | create group |
| `PATCH/DELETE` | `/api/preset-library/groups/:groupId` | update or delete group |
| `POST` | `/api/preset-library/groups/:groupId/flatten` | flatten a group |
| `POST` | `/api/preset-library/groups/:groupId/members` | add group member |
| `DELETE` | `/api/preset-library/groups/:groupId/members/:memberId` | remove group member |
| `POST` | `/api/preset-library/groups/:groupId/members/reorder` | reorder members |

### Presets And Variants

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/preset-library/presets` | create preset |
| `PATCH/DELETE` | `/api/preset-library/presets/:presetId` | update or delete preset |
| `POST` | `/api/preset-library/presets/reorder` | reorder presets |
| `POST` | `/api/preset-library/presets/:presetId/cascade` | cascade delete/update behavior |
| `POST` | `/api/preset-library/presets/:presetId/sync` | sync preset edits to sections |
| `GET` | `/api/preset-library/presets/:presetId/usage` | read preset usage |
| `POST` | `/api/preset-library/presets/:presetId/variants` | create variant |
| `POST` | `/api/preset-library/presets/:presetId/variants/reorder` | reorder variants |
| `PATCH/DELETE` | `/api/preset-library/variants/:variantId` | update or delete variant |

## LoRA Assets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/loras` | list registered LoRA files |
| `POST` | `/api/loras` | upload a LoRA file with multipart form data |
| `GET` | `/api/loras/browse` | browse LoRA directories |
| `POST` | `/api/loras/move` | move a LoRA file |
| `GET/PUT` | `/api/loras/notes` | read or update notes |

## ComfyUI And System

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | application health |
| `GET` | `/api/comfy/status` | ComfyUI process/status snapshot |
| `POST` | `/api/comfy/health-probe` | active ComfyUI health probe |
| `POST` | `/api/comfy/start` | start ComfyUI, localhost only |
| `POST` | `/api/comfy/stop` | stop ComfyUI, localhost only |
| `POST` | `/api/comfy/restart` | restart ComfyUI, localhost only |
| `GET` | `/api/worker/status` | worker status |
| `GET` | `/api/logs` | application logs |
| `GET` | `/api/audit-logs` | audit logs |
| `GET` | `/api/path-maps` | configured path mappings |
| `GET/POST/DELETE` | `/api/mcp` | MCP streamable HTTP endpoint |

## Agent-Specific Endpoints

The `/api/agent/**` endpoints provide higher-level project/run context and review workflows for agents:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/agent/projects` | list projects with agent-friendly filters |
| `GET` | `/api/agent/projects/:projectId/context` | full project context |
| `POST` | `/api/agent/projects/:projectId/update` | batch update project and sections |
| `POST` | `/api/agent/projects/:projectId/run-all` | run all enabled sections |
| `POST` | `/api/agent/sections/:sectionId/run` | run one section |
| `GET` | `/api/agent/runs/:runId/context` | full run context |
| `POST` | `/api/agent/runs/:runId/review` | batch keep/trash images |

Use these endpoints when an agent needs a compact context-first workflow. Use the lower-level endpoints above when an operation is not exposed by `/api/agent/**`.

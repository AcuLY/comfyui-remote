# Agent HTTP API

This document is for automation agents that need to operate ComfyUI Manager through HTTP instead of Next.js server actions.

## Project Overview

ComfyUI Manager is a Next.js application that manages repeatable ComfyUI image-generation work. The app is organized around projects, reusable templates, a preset library, LoRA assets, a run queue, and review workflows for generated images. Agents normally use it to create or update projects, assemble prompt content from presets, run sections through ComfyUI, inspect queued/running/completed jobs, and keep or trash generated images.

Core workflow:

1. Create or find a project.
2. Add project sections directly, import a project template, or copy existing sections.
3. Add prompt blocks manually or import presets/preset groups from the preset library.
4. Adjust section runtime parameters such as aspect ratio, batch size, KSampler settings, upscale factor, seed policies, and LoRA configuration.
5. Run one section or all enabled sections.
6. Review generated image results, marking images as kept, trashed, restored, p站, 预览, or project cover.

Core terms:

- **Project**: A generation workspace. A project owns ordered sections, project-level metadata, runs, and generated image results.
- **Section**: One ordered generation unit inside a project. A section has runtime parameters, prompt blocks, LoRA configuration, enabled state, and its own run history.
- **Project Template**: A reusable ordered list of template sections. Templates can be imported into projects and can carry prompt blocks, preset bindings, LoRAs, and optional runtime defaults.
- **Preset Library**: The reusable prompt/LoRA library. It contains categories, folders, presets, variants, and preset groups.
- **Preset**: A named reusable prompt asset, usually under a category such as character, style, people, pose, place, or expression.
- **Variant**: A selectable version of a preset. Variants carry positive prompt text, optional negative prompt text, LoRA entries, and linked variants.
- **Preset Group**: A reusable bundle of presets/variants that can be imported together. Imported group members share a `groupBindingId`.
- **Prompt Block**: A positive/negative prompt fragment stored on a project section. Blocks may be `custom` or `preset` sourced. Preset-sourced blocks keep `sourceId`, `variantId`, `categoryId`, `bindingId`, and optional `groupBindingId`.
- **Binding**: The stable relationship between an imported preset and the section content it created. `bindingId` links prompt blocks and LoRA entries that came from the same imported preset. Agents should use bindings when switching variants or deleting imported content.
- **LoRA Config**: Section-level LoRA lists split into `lora1` and `lora2`. Preset-imported LoRAs can also carry binding metadata so they stay associated with their prompt blocks.
- **Run**: One execution record for a section. Runs move through states such as queued, running, done, failed, and cancelled, and can expose the submitted workflow JSON.
- **Queue**: The operational view of pending/running/completed runs. Clearing active queue items cancels queued/running work; clearing finished queue items deletes finished/failed/cancelled run records.
- **Image Result**: A generated image attached to a run. Images can be kept, trashed, restored, marked for p站, marked for 预览, or selected as the project cover.
- **ComfyUI**: The external generation engine. This app manages ComfyUI process status, submits workflows, downloads outputs, and stores generated files.

Agent guidance:

- Prefer stable IDs over names when mutating data. Names are useful for search and matching, but IDs should be used once discovered.
- Use dry-run endpoints where available before bulk-changing sections, variants, or template imports.
- Editing a preset-sourced prompt or LoRA turns that item into custom content. Clear preset identity metadata on locally customized content so future preset or project-level binding updates do not overwrite it.
- Category order matters for prompt and LoRA composition; imported presets and groups should keep the library/category ordering when possible.
- Use `/api/agent/**` endpoints for high-level context and batch operations, then fall back to lower-level project/template/preset routes for specific edits.

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
- Public allowlisted namespaces include `/api/agent`, `/api/queue`, `/api/runs`, `/api/images`, `/api/trash`, `/api/models`, `/api/loras`, `/api/comfy`, `/api/mcp`, `/api/health`, logs, audit logs, worker status, path maps, and nested `/api/projects/:projectId/...` routes.
- ComfyUI process write controls (`/api/comfy/start`, `/api/comfy/stop`, `/api/comfy/restart`) are limited to localhost by the route handler.
- The UI may still call server actions directly, but the user-facing backend operations have HTTP equivalents listed below.

## Coverage Check

| User operation | HTTP interface |
| --- | --- |
| Create, list, read, update, delete projects | `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:projectId` |
| Manage project folders and move projects between folders | `GET/POST /api/project-folders`, `GET/PATCH/DELETE /api/project-folders/:folderId`, `POST /api/project-folders/reorder`, `POST /api/project-folders/move`, or `PATCH /api/projects/:projectId` with `folderId` |
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
| Import/remove preset in section | `POST/DELETE /api/projects/:projectId/sections/:sectionId/import-preset` |
| Switch a section binding variant | `POST /api/projects/:projectId/sections/:sectionId/switch-variant` |
| Batch switch section binding variants | `POST /api/agent/projects/:projectId/switch-variants` |
| Sync preset variants from a reference project | `POST /api/agent/projects/:projectId/sync-preset-variants` |
| Discover projects by title and run the safe preset-variant sync flow | `POST /api/agent/projects/sync-preset-variant-flow` |
| Manage prompt blocks | `GET/POST /api/projects/:projectId/sections/:sectionId/blocks`, `PATCH/DELETE /api/projects/:projectId/sections/:sectionId/blocks/:blockId` |
| List queue, clear finished runs, clear active queue | `GET /api/queue`, `POST /api/queue/clear`, `POST /api/queue/clear-active` |
| Cancel a run | `POST /api/runs/:runId/cancel` |
| Read run detail and workflow | `GET /api/runs/:runId`, `GET /api/runs/:runId/workflow` |
| Keep or trash generated images | `POST /api/runs/:runId/review/keep`, `POST /api/runs/:runId/review/trash` |
| Restore trashed images | `POST /api/images/:imageId/restore` |
| Toggle p站 image | `POST /api/images/:imageId/featured` (enabling also marks the image kept) |
| Toggle 预览 image | `POST /api/images/:imageId/featured2` (enabling also marks the image kept) |
| Set project cover image | `POST /api/images/:imageId/cover` (also marks the image kept) |
| Read image files | `GET /api/images/:path...` |
| Manage templates | `GET/POST /api/templates`, `GET/PATCH/DELETE /api/templates/:templateId`, `GET/PATCH/DELETE /api/templates/:templateId/sections/:sectionId`, `POST /api/templates/:templateId/sections/:sectionId/copy`, `POST /api/templates/:templateId/import` |
| Manage preset library | `/api/preset-library/**` endpoints listed below |
| Search preset library for agent use | `GET /api/presets`, `GET /api/preset-library/presets`, `GET /api/preset-library/presets/:presetId` |
| Upload/list/move/hash/annotate models | `GET/POST /api/models?kind=lora|checkpoint`, `GET /api/models/browse`, `GET /api/models/hash`, `POST /api/models/move`, `GET/PUT /api/models/notes` |
| Manage Character LoRA training jobs and sections | `/api/character-lora-training/**` endpoints listed below |
| Read logs, audit logs, health, worker status | `GET /api/logs`, `GET /api/audit-logs`, `GET /api/health`, `GET /api/worker/status` |
| MCP automation | `GET/POST/DELETE /api/mcp` |

No remaining user-facing backend operation gap is known after adding project folder management, `queue/clear`, `queue/clear-active`, section `batch-delete`, project `export`, template import options, template section CRUD, preset import/removal, preset lookup, preset library category/folder/group reads, batch variant switching, title-based preset-variant sync flow, and `name/loraConfig` support on section PATCH.

## Projects

### `GET /api/projects`

Query parameters:

- `search?: string`
- `title?: string`
- `status?: "draft" | "queued" | "running" | "partial_done" | "done" | "failed"`
- `enabledOnly?: boolean`
- `hasPending?: boolean`

Returns the project list.

### `POST /api/projects`

Body:

```json
{
  "title": "Project title",
  "checkpointName": "oneObsession_v19Atypical.safetensors",
  "folderId": "optional-project-folder-id",
  "notes": "optional notes"
}
```

Creates a project and returns the created record.

### `GET /api/projects/:projectId`

Returns project detail with sections, runs, and image summaries.

### `PATCH /api/projects/:projectId`

Body supports:

```json
{
  "aspectRatio": "2:3",
  "batchSize": 2,
  "checkpointName": "oneObsession_v19Atypical.safetensors",
  "folderId": "project-folder-id-or-null"
}
```

Use `null` to clear nullable fields where supported.

### `DELETE /api/projects/:projectId`

Deletes the project and cascaded data.

## Project Folders

### `GET /api/project-folders`

Lists project folders. Add `?parentId=<folderId>` to list one parent folder's direct children, or `?parentId=` to list root folders.

### `POST /api/project-folders`

Body:

```json
{
  "name": "Folder name",
  "parentId": "optional-parent-folder-id"
}
```

Creates a project folder and returns the created folder.

### `GET /api/project-folders/:folderId`

Returns one project folder with `projectCount` and `childCount`.

### `PATCH /api/project-folders/:folderId`

Body:

```json
{ "name": "New folder name" }
```

Renames a project folder and returns the updated folder.

### `DELETE /api/project-folders/:folderId`

Deletes an empty project folder. Non-empty folders return a conflict error.

### `POST /api/project-folders/reorder`

Body:

```json
{
  "parentId": "optional-parent-folder-id",
  "ids": ["folder-id-1", "folder-id-2"]
}
```

Updates folder sort order within a parent.

### `POST /api/project-folders/move`

Body:

```json
{
  "projectId": "project-id",
  "folderId": "target-folder-id-or-null"
}
```

Moves a project to a folder. `PATCH /api/projects/:projectId` with `{ "folderId": "target-folder-id-or-null" }` is also supported.

### Project Commands

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `POST` | `/api/projects/:projectId/copy` | none | creates a copied project |
| `POST` | `/api/projects/:projectId/run` | `{ "overrideBatchSize": 4 }` optional | enqueues and submits all enabled sections |
| `POST` | `/api/projects/:projectId/cancel-runs` | none | cancels queued/running runs for the project |
| `POST` | `/api/projects/:projectId/export` | none | requires a project cover, exports kept images into `data/export`, writes `cover.jpg`, writes p站 images to `pixiv/`, and writes 预览 images to `preview/` |
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
  "checkpointName": "oneObsession_v19Atypical.safetensors",
  "loraConfig": { "lora1": [], "lora2": [] }
}
```

All fields are optional, but at least one supported field must be present. For generation, the effective checkpoint resolves as `section.checkpointName ?? project.checkpointName`.

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
| `DELETE` | `/api/projects/:projectId/sections/:sectionId/import-preset` | `{ "bindingId": "..." }` | removes an imported preset binding and matching preset LoRA entries |
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

Preset-sourced create bodies should preserve identity metadata:

```json
{
  "type": "preset",
  "sourceId": "preset-id",
  "variantId": "variant-id",
  "categoryId": "category-id",
  "bindingId": "binding-id",
  "groupBindingId": "optional-group-binding-id",
  "label": "Preset label",
  "positive": "prompt from preset",
  "negative": null,
  "sortOrder": 10
}
```

### `PATCH /api/projects/:projectId/sections/:sectionId/blocks/:blockId`

Updates one prompt block. Supported fields are `type`, `sourceId`, `variantId`, `categoryId`, `bindingId`, `groupBindingId`, `label`, `positive`, `negative`, and `sortOrder`. User/API content edits to preset-sourced blocks detach the block by converting it to `custom` and clearing preset identity fields; MCP agent tool behavior is intentionally unchanged for now.

### `DELETE /api/projects/:projectId/sections/:sectionId/blocks/:blockId`

Deletes one prompt block.

## Runs, Queue, And Review

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/queue` | none | queue summary |
| `GET` | `/api/queue-data` | none | queue page data; this route is a response-shape exception and may return raw JSON |
| `POST` | `/api/queue/clear` | none | deletes finished, failed, and cancelled run records |
| `POST` | `/api/queue/clear-active` | none | cancels queued/running runs and clears matching ComfyUI queue entries |
| `GET` | `/api/runs/:runId` | none | run detail |
| `GET` | `/api/runs/:runId/workflow` | none | workflow data for the run |
| `POST` | `/api/runs/:runId/cancel` | none | cancels a queued/running run |
| `POST` | `/api/runs/:runId/review/keep` | `{ "imageIds": ["..."] }` | marks images kept |
| `POST` | `/api/runs/:runId/review/trash` | `{ "imageIds": ["..."], "reason": "optional" }` | trashes images |
| `GET` | `/api/trash` | none | lists trashed images |
| `POST` | `/api/images/:imageId/restore` | none | restores one trashed image |
| `POST` | `/api/images/:imageId/featured` | `{ "featured": true }` | toggles p站 flag; enabling also returns `reviewStatus: "kept"` |
| `POST` | `/api/images/:imageId/featured2` | `{ "featured2": true }` | toggles 预览 flag; enabling also returns `reviewStatus: "kept"` |
| `POST` | `/api/images/:imageId/cover` | `{ "cover": true }` | sets the image as the project cover and returns `reviewStatus: "kept"`; selecting another image replaces the existing cover |
| `GET` | `/api/images/:path...` | none | serves image files |

## Templates

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| `GET` | `/api/templates?name=full` | none | lists project templates, optionally filtered by name |
| `POST` | `/api/templates` | template payload | creates a template |
| `GET` | `/api/templates/:templateId` | none | reads template detail |
| `PATCH` | `/api/templates/:templateId` | template patch payload | updates a template |
| `DELETE` | `/api/templates/:templateId` | none | deletes a template |
| `GET` | `/api/templates/:templateId/sections/:sectionId` | none | reads one template section |
| `PATCH` | `/api/templates/:templateId/sections/:sectionId` | section patch or `{ "section": { ... } }` | updates one template section without replacing sibling sections |
| `DELETE` | `/api/templates/:templateId/sections/:sectionId` | none | deletes one template section and compacts following sort orders |
| `POST` | `/api/templates/:templateId/sections/:sectionId/copy` | none | copies one template section |
| `POST` | `/api/templates/:templateId/import` | `{ "projectId": "...", "dryRun": true, "onExistingSections": "skip" }` | imports or previews a template import |

Template payloads follow `src/lib/actions/template.ts`: `name`, `description`, and `sections`.

Template section objects support the same optional runtime defaults as project sections:

```json
{
  "name": "Template section",
  "aspectRatio": "2:3",
  "shortSidePx": 768,
  "batchSize": 2,
  "seedPolicy1": "random",
  "seedPolicy2": "fixed",
  "ksampler1": { "steps": 30, "cfg": 7 },
  "ksampler2": { "steps": 20, "cfg": 6 },
  "upscaleFactor": 2,
  "checkpointName": "oneObsession_v19Atypical.safetensors",
  "loraConfig": { "lora1": [], "lora2": [] },
  "promptBlocks": []
}
```

`checkpointName` may be `null` on a template section to avoid overriding the target project during import. When a template section has a checkpoint, import writes it to the created project section.

`onExistingSections` supports `skip`, `replace`, `append`, and `error`. A dry run returns the section import plan without changing the project.

## Preset Library

### Categories

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/preset-library/categories` | list categories with active presets, active groups, folders, variants, and recent change history |
| `GET` | `/api/preset-library/categories/:categoryId` | read one category with active presets, active groups, folders, variants, and recent change history |
| `POST` | `/api/preset-library/categories` | create category |
| `PATCH/DELETE` | `/api/preset-library/categories/:categoryId` | update or delete category |
| `POST` | `/api/preset-library/categories/reorder` | reorder categories |
| `PATCH` | `/api/preset-library/categories/:categoryId/sort-orders` | update category sort order dimensions |
| `PATCH` | `/api/preset-library/categories/:categoryId/slot-template` | update slot template |
| `POST` | `/api/preset-library/categories/:categoryId/groups/reorder` | reorder groups in a category |

### Folders

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/preset-library/folders?categoryId=...&parentId=...` | list folders, optionally filtered by category or parent folder |
| `GET` | `/api/preset-library/folders/:folderId` | read one folder with child/preset/group counts |
| `POST` | `/api/preset-library/folders` | create folder |
| `PATCH/DELETE` | `/api/preset-library/folders/:folderId` | rename or delete folder |
| `POST` | `/api/preset-library/folders/:folderId/move` | move presets/groups into a folder |
| `POST` | `/api/preset-library/folders/reorder` | reorder folders |

### Groups And Members

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/preset-library/groups` | list active groups with ordered members and display names |
| `GET` | `/api/preset-library/groups/:groupId` | read one active group with ordered members and display names |
| `POST` | `/api/preset-library/groups` | create group |
| `PATCH/DELETE` | `/api/preset-library/groups/:groupId` | update or delete group |
| `POST` | `/api/preset-library/groups/:groupId/flatten` | flatten a group |
| `POST` | `/api/preset-library/groups/:groupId/members` | add group member |
| `DELETE` | `/api/preset-library/groups/:groupId/members/:memberId` | remove group member |
| `POST` | `/api/preset-library/groups/:groupId/members/reorder` | reorder members |

### Presets And Variants

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/preset-library/presets?name=达妮娅&category=角色&slug=...` | list presets with variants; filters support `name`, `slug`, `category`, `categoryId`, and `includeInactive=true` |
| `GET` | `/api/presets?name=洛茜&category=角色` | alias for preset lookup with variants |
| `GET` | `/api/preset-library/presets/:presetId` | read one preset with variants |
| `POST` | `/api/preset-library/presets` | create preset |
| `PATCH/DELETE` | `/api/preset-library/presets/:presetId` | update or delete preset |
| `POST` | `/api/preset-library/presets/reorder` | reorder presets |
| `POST` | `/api/preset-library/presets/:presetId/cascade` | cascade delete/update behavior |
| `POST` | `/api/preset-library/presets/:presetId/sync` | sync preset edits to sections |
| `GET` | `/api/preset-library/presets/:presetId/usage` | read preset usage |
| `POST` | `/api/preset-library/presets/:presetId/variants` | create variant |
| `POST` | `/api/preset-library/presets/:presetId/variants/reorder` | reorder variants |
| `PATCH/DELETE` | `/api/preset-library/variants/:variantId` | update or delete variant |

Preset create/update bodies support preset metadata only. `civitaiLinks` is available on presets, not preset groups. It accepts an array of `http`/`https` URLs; empty strings are ignored, duplicates are removed, and an empty array is stored as no links.

```json
{
  "categoryId": "category-id",
  "folderId": null,
  "name": "Preset name",
  "slug": "preset-slug",
  "notes": "Optional notes",
  "civitaiLinks": [
    "https://civitai.com/models/12345/example-model",
    "https://civitai.com/models/12345?modelVersionId=67890"
  ],
  "isActive": true
}
```

Preset list/detail responses include the normalized `civitaiLinks` array:

```json
{
  "id": "preset-id",
  "categoryId": "category-id",
  "name": "Preset name",
  "slug": "preset-slug",
  "notes": "Optional notes",
  "civitaiLinks": ["https://civitai.com/models/12345/example-model"],
  "folderId": null,
  "sortOrder": 0,
  "isActive": true,
  "variants": []
}
```

## Model Assets

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/models?kind=lora\|checkpoint` | list registered model files |
| `POST` | `/api/models?kind=lora\|checkpoint` | upload a model file with multipart form data |
| `GET` | `/api/models/browse?kind=lora\|checkpoint` | browse model directories |
| `GET` | `/api/models/hash?kind=lora\|checkpoint&path=<relative>` | compute sha256 for one allowed model file on demand |
| `POST` | `/api/models/move?kind=lora\|checkpoint` | move a model file |
| `GET/PUT` | `/api/models/notes?kind=lora\|checkpoint` | read or update notes |

`kind=checkpoint` is rooted at `MODEL_BASE_DIR/checkpoints`, only exposes `.safetensors` files, and stores notes only. `kind=lora` is rooted at `MODEL_BASE_DIR/loras` and supports notes plus trigger words.
`GET /api/models/hash` returns `{ "name": "...", "path": "...", "absolutePath": "...", "size": 123, "sha256": "..." }`, validates that `path` stays under the selected kind's base directory, validates the model extension, and hashes the file as a stream so browse calls do not scan large model contents. `path` is normalized relative to the selected kind's base directory; `absolutePath` is available for training jobs that need a directly stat-able checkpoint path.

## Character LoRA Training

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/character-lora-training/training-templates` | list active LoRA Training Templates / Recipes with defaults and owned section templates |
| `GET` | `/api/character-lora-training/section-templates` | list active section templates |
| `POST` | `/api/character-lora-training/section-templates` | copy an existing section template; copies inherit the source template's recipe ownership |
| `GET` | `/api/character-lora-training/jobs` | list Character LoRA training jobs |
| `POST` | `/api/character-lora-training/jobs` | create a training job |
| `GET/PATCH` | `/api/character-lora-training/jobs/:jobId` | read or update a job |
| `POST` | `/api/character-lora-training/jobs/:jobId/canonical/generate` | enqueue a canonical generation task |
| `POST` | `/api/character-lora-training/jobs/:jobId/canonical/manual` | register an uploaded `manual_canonical` source image as a new canonical candidate |
| `POST` | `/api/character-lora-training/jobs/:jobId/canonical/:versionId/select` | select a canonical version as current; rejected versions return `409` |
| `POST` | `/api/character-lora-training/jobs/:jobId/canonical/:versionId/reject` | reject a canonical candidate; current, selected, superseded, and already rejected versions return `409` |
| `GET` | `/api/character-lora-training/jobs/:jobId/sections` | list job sections with counts and run/image totals |
| `POST` | `/api/character-lora-training/jobs/:jobId/sections/instantiate` | create missing sections from active templates |
| `PATCH` | `/api/character-lora-training/sections/:sectionId` | pause or resume one job section with `{ "status": "paused" }`, `{ "status": "active" }`, `{ "action": "pause" }`, or `{ "action": "resume" }` |
| `POST` | `/api/character-lora-training/sections/:sectionId/runs` | enqueue section generation or rerun; paused sections return `409` |
| `POST` | `/api/character-lora-training/images/review` | update candidate image reviews and refresh section counts |

`POST /api/character-lora-training/jobs` accepts optional `trainingTemplateId`. When omitted, the service uses the default `character_identity_default` recipe. Created jobs store both the source `trainingTemplateId` and an immutable `trainingTemplateSnapshot`; the selected recipe's section templates are instantiated immediately. `captionStrategy` defaults from the recipe unless explicitly overridden. Recipe defaults do not remove the requirement to provide the job's concrete character identity, trigger token, training scope, and base checkpoint path/hash/family.

`POST /api/character-lora-training/jobs/:jobId/sections/instantiate` is scoped to the job's recipe when the job has `trainingTemplateId`. Re-instantiating existing section keys does not duplicate sections; it refreshes empty or stale `canonicalVersionId` / `promptCardVersionId` lineage to the job's current pointers when available.

Pausing a Character LoRA job section does not delete runs, images, or review counts. Count refreshes keep `paused` until an explicit resume. Resume derives the active status from current counts: `pending > 0` becomes `reviewing`, any kept/rejected images become `reviewed`, and empty sections become `draft`.

Canonical versions use `candidate`, `selected`, `rejected`, and `superseded`. Rejecting is only the `candidate -> rejected` transition. Rejected canonical versions stay visible in job reports for lineage/audit purposes, but cannot be selected as the current canonical and cannot be used as `canonicalVersionId` when creating or promoting Prompt Card versions; those requests return `409`.

`POST /api/character-lora-training/sections/:sectionId/runs` accepts `sourceImageIds`, explicit provider `inputImages`, `parentRunId`, and `previousCandidateImageIds`. `inputImages` remains a complete explicit provider input list and cannot be combined with `sourceImageIds` or `previousCandidateImageIds`. `previousCandidateImageIds` can be combined with `sourceImageIds` and `parentRunId`; each id must point to a candidate image from the same job section and is sent to the provider as role `previous_candidate` with artifact id, relative path, and sha256. When `parentRunId` is provided without explicit `inputImages` or `previousCandidateImageIds`, the service automatically adds that parent run's candidate images from the same section as `previous_candidate` references.

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
| `POST` | `/api/agent/projects/:projectId/switch-variants` | batch switch preset binding variants |
| `POST` | `/api/agent/projects/:projectId/sync-preset-variants` | dry-run or execute variant sync from a reference project |
| `POST` | `/api/agent/projects/sync-preset-variant-flow` | discover projects/presets by title/name and run dry-run/apply/verify sync flow |
| `POST` | `/api/agent/sections/:sectionId/run` | run one section |
| `GET` | `/api/agent/runs/:runId/context` | full run context |
| `POST` | `/api/agent/runs/:runId/review` | batch keep/trash images |

Use these endpoints when an agent needs a compact context-first workflow. Use the lower-level endpoints above when an operation is not exposed by `/api/agent/**`.

### Batch Variant Switch

`POST /api/agent/projects/:projectId/switch-variants`

```json
{
  "updates": [
    { "sectionId": "...", "bindingId": "...", "newVariantId": "..." }
  ]
}
```

Returns per-item success or failure results without aborting the whole batch for one bad item.

### Sync Preset Variants

`POST /api/agent/projects/:targetProjectId/sync-preset-variants`

```json
{
  "sourceProjectId": "...",
  "sourcePresetName": "达妮娅",
  "targetPresetName": "洛茜",
  "matchSectionsBy": "name",
  "matchVariantsBy": "name",
  "dryRun": true
}
```

Use `dryRun: true` first to inspect the plan, then `dryRun: false` to execute the planned switches.

### Sync Preset Variant Flow by Project Title

`POST /api/agent/projects/sync-preset-variant-flow`

```json
{
  "sourceProjectTitle": "西施",
  "targetProjectTitle": "尼可莱恩",
  "expectedSourceProjectId": "optional-source-project-id-from-dry-run",
  "expectedTargetProjectId": "optional-target-project-id-from-current-page-or-dry-run",
  "sourcePresetName": "西施",
  "targetPresetName": "尼可·莱恩",
  "matchSectionsBy": "name",
  "matchVariantsBy": "name",
  "dryRun": true,
  "sampleSectionNumbers": [1, 33, 65]
}
```

`sourcePresetName` and `targetPresetName` are optional. When omitted, the service infers the active character preset used most often in each project, preferring the role/character preset category. Without expected IDs, projects are resolved by the latest exact title. The UI sends `expectedTargetProjectId` from the current project page during preview, then sends the dry-run's resolved `expectedSourceProjectId` and `expectedTargetProjectId` during apply so duplicate titles or concurrent same-title updates cannot switch a different project than the previewed one. `dryRun: false` requires both expected project IDs and fails closed if either ID is missing or its title no longer matches. The flow always runs an initial dry-run. With `dryRun: false`, it applies the planned switches through the existing variant-switch service, then runs a verification dry-run and returns `verification` with `plannedUpdateCount`, `variantDistribution`, `loraConfig` coverage, and sampled prompt blocks.

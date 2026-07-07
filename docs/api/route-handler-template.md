# API Route Handler Template

This is the source pattern for new or migrated `src/app/api/**/route.ts` handlers.

## Template

1. Import response helpers from `src/lib/api-response.ts`.
2. Parse request bodies through `src/server/http/request-json.ts` helpers when the body must be JSON.
3. Validate route-level fields before invoking services or actions.
4. Call one focused service, repository-backed action, or server workflow function.
5. Return `ok(data, init?)` for success and `fail(...)` only for explicit local validation branches.
6. In `catch` blocks, return `failFromError(error, fallbackMessage?, fallbackStatus?)` so status-bearing parser and service errors keep their response envelope.

```ts
import { fail, failFromError, ok } from "@/lib/api-response";
import { readJsonObject } from "@/server/http/request-json";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const name = body.name;
    if (typeof name !== "string" || !name.trim()) {
      return fail("name is required", 400);
    }

    const result = await runServiceAction({ name });
    return ok(result, { status: 201 });
  } catch (error) {
    return failFromError(error);
  }
}
```

## Current Adopters

The source-contract tests in `tests/test-api-request-json.test.ts` verify the current low-risk adopters:

- `src/app/api/templates/route.ts`
- `src/app/api/templates/[templateId]/route.ts`
- `src/app/api/preset-library/folders/route.ts`
- `src/app/api/preset-library/folders/[folderId]/move/route.ts`
- `src/app/api/projects/[projectId]/save-as-template/route.ts`
- `src/app/api/queue/resume-paused/route.ts`
- `src/app/api/image-review/route.ts`
- `src/app/api/projects/route.ts`
- `src/app/api/projects/[projectId]/route.ts`
- `src/app/api/project-folders/route.ts`
- `src/app/api/project-folders/[folderId]/route.ts`
- `src/app/api/project-folders/move/route.ts`
- `src/app/api/project-folders/reorder/route.ts`
- `src/app/api/projects/[projectId]/sections/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/route.ts`
- `src/app/api/projects/[projectId]/sections/reorder/route.ts`
- `src/app/api/projects/[projectId]/run/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/run/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/blocks/[blockId]/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/import-preset/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/switch-variant/route.ts`
- `src/app/api/projects/[projectId]/sections/[sectionId]/create-from-template/route.ts`
- `src/app/api/projects/[projectId]/apply-param/route.ts`
- `src/app/api/projects/[projectId]/preset-replacements/route.ts`
- `src/app/api/projects/[projectId]/sections/batch-delete/route.ts`
- `src/app/api/templates/[templateId]/import/route.ts`
- `src/app/api/templates/[templateId]/preset-replacements/route.ts`
- `src/app/api/templates/[templateId]/sections/[sectionId]/route.ts`
- `src/app/api/preset-library/categories/route.ts`
- `src/app/api/preset-library/categories/[categoryId]/route.ts`
- `src/app/api/preset-library/categories/reorder/route.ts`
- `src/app/api/preset-library/categories/[categoryId]/slot-template/route.ts`
- `src/app/api/preset-library/categories/[categoryId]/sort-orders/route.ts`
- `src/app/api/preset-library/categories/[categoryId]/groups/reorder/route.ts`
- `src/app/api/preset-library/folders/[folderId]/route.ts`
- `src/app/api/preset-library/folders/reorder/route.ts`
- `src/app/api/preset-library/groups/route.ts`
- `src/app/api/preset-library/groups/[groupId]/route.ts`
- `src/app/api/preset-library/groups/[groupId]/members/route.ts`
- `src/app/api/preset-library/groups/[groupId]/members/reorder/route.ts`
- `src/app/api/preset-library/presets/route.ts`
- `src/app/api/preset-library/presets/reorder/route.ts`
- `src/app/api/preset-library/presets/[presetId]/route.ts`
- `src/app/api/preset-library/presets/[presetId]/variants/route.ts`
- `src/app/api/preset-library/presets/[presetId]/variants/reorder/route.ts`
- `src/app/api/preset-library/variants/[variantId]/route.ts`
- `src/app/api/runs/[runId]/review/keep/route.ts`
- `src/app/api/runs/[runId]/review/trash/route.ts`
- `src/app/api/images/[imageId]/cover/route.ts`
- `src/app/api/agent/runs/[runId]/review/route.ts`
- `src/app/api/agent/projects/[projectId]/switch-variants/route.ts`
- `src/app/api/agent/projects/[projectId]/sync-preset-variants/route.ts`
- `src/app/api/agent/projects/[projectId]/update/route.ts`
- `src/app/api/agent/projects/sync-preset-variant-flow/route.ts`
- `src/app/api/training/projects/route.ts`
- `src/app/api/training/projects/[projectId]/route.ts`
- `src/app/api/training/projects/reorder/route.ts`
- `src/app/api/training/projects/[projectId]/profile/route.ts`
- `src/app/api/training/projects/[projectId]/save-as-template/route.ts`
- `src/app/api/training/projects/[projectId]/sections/route.ts`
- `src/app/api/training/projects/[projectId]/sections/[sectionId]/route.ts`
- `src/app/api/training/projects/[projectId]/sections/reorder/route.ts`
- `src/app/api/training/sections/[sectionId]/route.ts`
- `src/app/api/training/sections/[sectionId]/blocks/route.ts`
- `src/app/api/training/sections/[sectionId]/blocks/reorder/route.ts`
- `src/app/api/training/sections/[sectionId]/runs/route.ts`
- `src/app/api/training/blocks/[blockId]/route.ts`
- `src/app/api/training/blocks/[blockId]/detach/route.ts`
- `src/app/api/training/presets/route.ts`
- `src/app/api/training/presets/[presetId]/route.ts`
- `src/app/api/training/presets/sort-rules/route.ts`
- `src/app/api/training/scene-description/categories/route.ts`
- `src/app/api/training/scene-description/categories/[categoryId]/route.ts`
- `src/app/api/training/scene-description/folders/route.ts`
- `src/app/api/training/scene-description/folders/[folderId]/route.ts`
- `src/app/api/training/scene-description/presets/[presetId]/cascade/route.ts`

## Compatibility Exceptions

Some routes have intentionally legacy response shapes. `src/app/api/auth/verify/route.ts` keeps flat `{ error: string }` failures and `{ ok: true }` success because `src/app/login/page.tsx` consumes that contract. It still parses via `readJsonBody` and formats through `flatFail`/`okOnly`.

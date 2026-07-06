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

## Compatibility Exceptions

Some routes have intentionally legacy response shapes. `src/app/api/auth/verify/route.ts` keeps flat `{ error: string }` failures and `{ ok: true }` success because `src/app/login/page.tsx` consumes that contract. It still parses via `readJsonBody` and formats through `flatFail`/`okOnly`.

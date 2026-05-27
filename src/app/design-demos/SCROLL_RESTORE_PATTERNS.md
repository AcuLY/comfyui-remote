# List → Detail → Back Scroll Restoration Patterns

Pages that follow the pattern: click item in a list → enter detail page → click back → should scroll to the original item.

## Implementation Mechanism

- **Detail page**: On mount, stores its entity ID in `sessionStorage` under a route-specific key
- **List page**: On mount, reads & clears sessionStorage; uses the ID to scroll to the target element via `useLayoutEffect` + `[data-xxx-id]` attribute
- **PageHeaderBack**: Uses `scroll={false}` on the Next.js Link to prevent framework scroll-to-top

## Implemented

| List Page | Detail Page | Back Target | Storage Key | Status |
|-----------|-------------|-------------|-------------|--------|
| `/runs` (QueuePage) | `/runs/:runId` (ReviewPage) | `/runs` | `demo-runs-from` | ✅ Done |
| `/templates` (TemplatesPage) | `/templates/:id/edit` (TemplateFormPage) | `/templates` | `demo-templates-from` | ✅ Done |
| `/templates/:id/edit` (TemplateFormPage) | `/templates/:id/sections/:index` (TemplateSectionPage) | `/templates/:id/edit` | `demo-template-sections-from` | ✅ Done |
| `/presets` (LibraryPage) | `/presets/:id` (PresetEditPage) | `/presets` | `demo-presets-from` | ✅ Done |
| `/presets` (LibraryPage) | `/preset-groups/:id` (GroupPage) | `/presets` | `demo-presets-from` | ✅ Done |
| `/presets` (LibraryPage) | `/presets/categories/:id/edit` (CategoryFormPage) | `/presets` | `demo-presets-from` | ✅ Done |
| `/projects` (ProjectListPage) | `/projects/:id` (ProjectDetailPage) | `/projects` | `demo-projects-from` | ✅ Done |
| `/projects/:id` (ProjectDetailPage) | `/projects/:id/sections/:sectionId` (SectionEditorPage) | `/projects/:id` | `demo-project-sections-from` | ✅ Done |

## Not Applicable

| Route | Reason |
|-------|--------|
| `/presets/sort-rules` | Not an item-level detail (no specific item to scroll to) |
| `/projects/:id/batch-create` | Goes back to project detail, not a list item |

## Files Reference

### List pages (need scroll-to logic on mount)
- `features/runs/queue-page.tsx` + `pending-review-groups.tsx` + `run-list.tsx` ✅
- `features/templates/template-list.tsx`
- `features/templates/template-form-page.tsx` (acts as list of sections)
- `features/presets/library-page.tsx`
- `features/projects/project-detail-page.tsx` (acts as list of sections)

### Detail pages (need sessionStorage write on mount)
- `features/runs/review-page.tsx` ✅
- `features/templates/template-form-page.tsx` (when mode="edit")
- `features/templates/template-section-page.tsx`
- `features/presets/preset-edit-page.tsx`
- `features/presets/group-page.tsx`
- `features/presets/category-form-page.tsx`
- `features/projects/batch/batch-create.tsx`

## Pattern Code Template

### Detail page (writes to sessionStorage)
```tsx
const SCROLL_KEY = "demo-xxx-from";

useEffect(() => {
  try { sessionStorage.setItem(SCROLL_KEY, entityId); } catch {}
}, [entityId]);
```

### List page (reads, scrolls)
```tsx
import { useLayoutEffect } from "react";

const SCROLL_KEY = "demo-xxx-from";

function readAndClear() {
  try {
    const v = sessionStorage.getItem(SCROLL_KEY);
    if (v) { sessionStorage.removeItem(SCROLL_KEY); return v; }
  } catch {}
}

// In component:
const [fromId] = useState(readAndClear);

useLayoutEffect(() => {
  if (!fromId) return;
  const el = containerRef.current?.querySelector(`[data-item-id="${fromId}"]`);
  if (el) {
    el.scrollIntoView({ block: "center", behavior: "instant" });
  } else {
    const t = setTimeout(() => {
      containerRef.current?.querySelector(`[data-item-id="${fromId}"]`)
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    }, 100);
    return () => clearTimeout(t);
  }
}, []);
```

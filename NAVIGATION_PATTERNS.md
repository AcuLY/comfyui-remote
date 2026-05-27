# Navigation Patterns: "List → Detail → Back to List" in Design Demos

## Executive Summary

Found **7 major navigation pattern pairs** where a list page links to detail pages that have back buttons returning to the list. Plus several tertiary patterns.

---

## Pattern 1: Tasks Queue (Runs)

### List Page: `/runs`
**File:** `src/app/design-demos/features/runs/queue-page.tsx`

- Contains `<PendingReviewGroups>` and `<RunList>` components
- `RunList` renders individual runs with `<Link href={demoHref(\`/runs/${run.id}\`)}>`
- Located around line 215 in `run-list.tsx`

### Detail Page: `/runs/:runId`
**File:** `src/app/design-demos/features/runs/review-page.tsx`

- `<PageHeader back={{ href: "/runs", label: "返回任务" }}>`
- Line 45
- Displays run review details and images
- Has session storage integration to restore scroll position

### Route Pattern
```
/runs                  → list of pending/running/failed tasks
└── /runs/:runId       → review page with back to /runs
```

---

## Pattern 2: Templates (Edit & Section Detail)

### List Page: `/templates`
**File:** `src/app/design-demos/features/templates/template-list.tsx`

- Displays all templates with sections
- Links to template edit: `<Link href={demoHref(\`/templates/${template.id}/edit\`)}>`
- Line 28
- Also links to individual sections: `<Link href={demoHref(\`/templates/${template.id}/sections/${index}\`)}>`
- Line 36

### Detail Page (Edit): `/templates/:templateId/edit`
**File:** `src/app/design-demos/features/templates/template-form-page.tsx`

- `<PageHeader back={{ href: "/templates", label: "返回模板列表" }}>`
- Line 78 and 96
- Allows editing template info and sections
- Mode can be "new" or "edit"

### Detail Page (Section): `/templates/:templateId/sections/:sectionIndex`
**File:** `src/app/design-demos/features/templates/template-section-page.tsx`

- `<PageHeader back={{ href: \`/templates/${template.id}/edit\`, label: "返回模板" }}>`
- Line 40
- Allows editing individual template sections
- Links back to template edit page (NOT directly to list)

### Route Pattern
```
/templates                              → list of templates
├── /templates/:templateId/edit         → edit template with back to /templates
│   └── /templates/:templateId/sections/:index  → edit section with back to edit
└── /templates/new                      → create new template (back to /templates)
```

---

## Pattern 3: Presets Library (Comprehensive)

### List Page: `/presets`
**File:** `src/app/design-demos/features/presets/library-page.tsx`

- Complex hierarchical preset browser
- Displays presets and groups with categories
- Line 291, 302, 310: Multiple `<Link>` with `href={openHref}` 
- openHref constructed from preset/group IDs at line 245: `demoHref(href)`
- Links to preset edit: `openHref` (computed dynamically)
- Links to group edit: `openHref` (computed dynamically)

### Detail Page (Preset Edit): `/presets?category=X&folder=Y&preset=Z` (detail view)
**File:** `src/app/design-demos/features/presets/preset-edit-page.tsx`

- `<PageHeader back={{ href: \`/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}\`, label: "返回预设库" }}>`
- Line 254
- Edit variants, LoRA, prompt blocks
- Back button preserves query params for scroll restoration

### Detail Page (Group Edit): `/presets?category=X&folder=Y&group=Z` (detail view)
**File:** `src/app/design-demos/features/presets/group-page.tsx`

- `<PageHeader back={{ href: \`/presets?category=${group.categoryId}&folder=${group.folderId ?? ""}&group=${group.id}\`, label: "返回预设库" }}>`
- Line 61
- Edit preset group members
- Back button preserves category, folder, and group context

### Detail Page (Sort Rules): `/presets/sort-rules`
**File:** `src/app/design-demos/features/presets/sort-rules-page.tsx`

- `<PageHeader back={{ href: "/presets", label: "返回预设库" }}>`
- Line 26
- Accessible from list via `<ButtonLink href="/presets/sort-rules">`
- Line 446 in library-page.tsx

### Detail Page (Category Edit): `/presets/categories/:categoryId/edit`
**File:** `src/app/design-demos/features/presets/category-form-page.tsx`

- `<PageHeader back={{ href: "/presets", label: "返回预设库" }}>`
- Line 131
- Edit preset categories
- Accessible from library-page.tsx line 640

### Route Pattern
```
/presets                                           → list/browser with categories
├── /presets?category=X&preset=Y                  → preset detail (back to /presets)
├── /presets?category=X&group=Z                   → group detail (back to /presets)
├── /presets/sort-rules                           → sort rules (back to /presets)
└── /presets/categories/:categoryId/edit          → edit category (back to /presets)
```

---

## Pattern 4: Projects (List & Detail)

### List Page: `/projects`
**File:** `src/app/design-demos/features/projects/project-list-page.tsx`

- Displays project cards/compact list
- Links to project detail: `<Link href={demoHref(\`/projects/${project.id}\`)}>`
- Line 78, 97 in `project-list-item.tsx`

### Detail Page: `/projects/:projectId`
**File:** `src/app/design-demos/features/projects/project-detail-page.tsx`

- Shows project sections and results
- Note: Uses `ProjectSectionShell` with mode "detail" or "project-results"
- Does NOT have a direct `back=` prop in PageHeader
- Navigation back is implicit through project rail/shell

### Batch Create Page: `/projects/:projectId/batch` (tertiary)
**File:** `src/app/design-demos/features/projects/batch/batch-create.tsx`

- `<PageHeader back={{ href: \`/projects/${activeProject.id}\`, label: "返回项目" }}>`
- Line 76
- Accessed from project detail
- Batch create new sections by importing presets

### Route Pattern
```
/projects                     → list of projects (implicit back via shell)
├── /projects/:projectId      → project detail view
│   └── /projects/:projectId/batch  → batch create sections (back to project)
└── /projects/new             → create project (project-form-page.tsx)
```

**Note:** Project detail pages (`/projects/:projectId/sections/:sectionId`) appear to be inline navigation within the detail page, not separate route destinations (they render as anchor-scrolling within the project detail shell).

---

## Pattern 5: Section Rail Navigation

The `/projects/:projectId/sections/:sectionId` route exists but functions as:
- **Navigation target:** Can link to specific sections via URL
- **In-page scroll:** ProjectSectionShell syncs scroll between content and rail
- **Not a separate page:** Content renders within project-detail-page structure

### Files Involved:
- `project-section-shell.tsx` - manages scroll sync
- `section-rail.tsx` - side rail with section list
- Line 53 in section-rail.tsx: `href={sectionNavHref(project, section, mode)}`

---

## Pattern 6: Project Form Pages (New/Edit)

### Detail Page: `/projects/new` and `/projects/:projectId/edit`
**File:** `src/app/design-demos/features/projects/project-form-page.tsx`

- Has `back=` prop (line 23 shows button with feedback, not PageHeader)
- No explicit PageHeader `back=` shown in current file
- Creates/edits project metadata

---

## Summary Table

| List Page | Detail Page(s) | Back Navigation | Files |
|-----------|----------------|-----------------|-------|
| `/runs` | `/runs/:runId` | ✅ `/runs` | queue-page.tsx → review-page.tsx |
| `/templates` | `/templates/:id/edit`<br/>`/templates/:id/sections/:idx` | ✅ `/templates`<br/>✅ `/templates/:id/edit` | template-list.tsx → template-form-page.tsx → template-section-page.tsx |
| `/presets` | `/presets?...&preset=X`<br/>`/presets?...&group=Y`<br/>`/presets/sort-rules`<br/>`/presets/categories/:id/edit` | ✅ `/presets` (all) | library-page.tsx → preset-edit-page.tsx, group-page.tsx, sort-rules-page.tsx, category-form-page.tsx |
| `/projects` | `/projects/:id`<br/>`/projects/:id/batch` | implicit<br/>✅ `/projects/:id` | project-list-page.tsx → project-detail-page.tsx → batch-create.tsx |

---

## Key Implementation Details

### Back Button Pattern
All detail pages use consistent `PageHeader` prop:
```tsx
<PageHeader back={{ href: "/list-route", label: "返回列表" }} />
```

### Scroll Restoration
- **Runs:** Session storage in `SCROLL_RESTORE_KEY = "demo-runs-from"`
  - Detail page sets: `sessionStorage.setItem(SCROLL_RESTORE_KEY, run.id)`
  - List page reads and clears on mount
  
- **Presets:** Query parameters preserved in back button
  - Example: `/presets?category=cat-1&folder=folder-2&preset=preset-3`
  
- **Projects:** Section rail scroll sync via `ProjectSectionShell`

### Dynamic Href Construction
- Templates use: `demoHref(\`/templates/${id}/sections/${index}\`)`
- Presets use: `demoHref(href)` with computed href
- Projects use: `demoHref(\`/projects/${id}\`)`
- Runs use: `demoHref(\`/runs/${id}\`)` with optional query params

---

## Navigation Command Usage

The `demoHref()` helper (from `src/app/design-demos/routing/href.ts`) wraps all navigation hrefs to ensure proper design-demo routing context.

Example usage across all patterns:
```tsx
import Link from "next/link";
import { demoHref } from "../../routing";

<Link href={demoHref(`/runs/${run.id}`)}>Open run</Link>
<PageHeader back={{ href: "/runs", label: "Back to runs" }} />
```

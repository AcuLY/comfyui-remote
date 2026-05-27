# Quick Reference: List → Detail Navigation Patterns

## 🎯 All Navigation Pairs at a Glance

### 1. **Runs/Tasks Queue**
| Component | Route | File | Feature |
|-----------|-------|------|---------|
| List | `/runs` | `queue-page.tsx` | Task dashboard with pending/running/failed tabs |
| Detail | `/runs/:runId` | `review-page.tsx` | Review images, download workflow |
| Back | → `/runs` | Line 45 | Includes scroll restoration via sessionStorage |

---

### 2. **Templates**
| Component | Route | File | Feature |
|-----------|-------|------|---------|
| List | `/templates` | `template-list.tsx` | Browse all templates with section previews |
| Edit | `/templates/:id/edit` | `template-form-page.tsx` | Edit template metadata and manage sections |
| Section | `/templates/:id/sections/:idx` | `template-section-page.tsx` | Edit individual section params, bindings, LoRA |
| Back (Edit) | → `/templates` | Line 78 | From template edit page |
| Back (Section) | → `/templates/:id/edit` | Line 40 | From template section to edit page |

---

### 3. **Presets Library** (Most Complex)
| Component | Route | File | Feature |
|-----------|-------|------|---------|
| List | `/presets` | `library-page.tsx` | Browser with categories, folders, items |
| Preset Edit | `/presets?category=X&folder=Y&preset=Z` | `preset-edit-page.tsx` | Edit variants, LoRA, prompt blocks |
| Group Edit | `/presets?category=X&folder=Y&group=Z` | `group-page.tsx` | Edit preset group members |
| Sort Rules | `/presets/sort-rules` | `sort-rules-page.tsx` | Configure sort ordering for categories |
| Category Edit | `/presets/categories/:id/edit` | `category-form-page.tsx` | Edit preset category metadata |
| All Back To | → `/presets` (or with params) | Varies | Query params preserved for scroll restoration |

**Key:** Presets use query strings (`?category=...&preset=...`) to maintain context when navigating back.

---

### 4. **Projects** (Partial Pattern)
| Component | Route | File | Feature |
|-----------|-------|------|---------|
| List | `/projects` | `project-list-page.tsx` | Browse projects with sections count |
| Detail | `/projects/:id` | `project-detail-page.tsx` | View sections and results |
| Batch Create | `/projects/:id/batch` | `batch-create.tsx` | Import presets and batch create sections |
| Section Detail | `/projects/:id/sections/:id` | (in project-detail-page) | Inline scroll sync, not separate page |
| Back (Batch) | → `/projects/:id` | Line 76 | From batch page to project |
| Back (Project) | — | — | **No explicit back button** - uses project rail shell |

**Note:** Projects don't have a direct back button in the detail page. Navigation is implicit through the section rail.

---

## 🔄 Back Button Implementation Pattern

### Standard Pattern (Most Used)
```tsx
<PageHeader
  back={{ 
    href: "/list-route",           // ← Simple href
    label: "返回列表"               // ← Chinese label
  }}
  title="Detail Page Title"
/>
```

### With Query Parameters (Presets)
```tsx
<PageHeader
  back={{ 
    href: `/presets?category=${preset.categoryId}&folder=${preset.folderId}&preset=${preset.id}`,
    label: "返回预设库"
  }}
/>
```

### Scroll Restoration (Runs)
```tsx
// In detail page:
useEffect(() => {
  sessionStorage.setItem(SCROLL_RESTORE_KEY, run.id);
}, [run]);

// In list page:
const [fromRunId] = useState(() => {
  const value = sessionStorage.getItem(SCROLL_RESTORE_KEY);
  sessionStorage.removeItem(SCROLL_RESTORE_KEY);
  return value;
});
```

---

## 📍 Link Construction Pattern

### Using `demoHref()` Helper
All navigation links use the `demoHref()` wrapper to ensure proper routing context:

```tsx
import { demoHref } from "../../routing";

// Simple route
<Link href={demoHref(`/runs/${run.id}`)}>
  {run.sectionName}
</Link>

// With query params
<Link href={demoHref(constructedHref)}>
  Preset: {preset.name}
</Link>

// Using ButtonLink
<ButtonLink href={demoHref(`/templates/${template.id}/edit`)}>
  Edit
</ButtonLink>
```

---

## 🗂️ File Structure

```
src/app/design-demos/features/
├── runs/
│   ├── queue-page.tsx          ✓ List (back implicit)
│   ├── run-list.tsx            (renders links)
│   ├── review-page.tsx         ✓ Detail (back to /runs)
│   └── ...
├── templates/
│   ├── template-list.tsx       ✓ List (back implicit)
│   ├── template-form-page.tsx  ✓ Edit Detail (back to /templates)
│   ├── template-section-page.tsx ✓ Section Detail (back to edit)
│   └── ...
├── presets/
│   ├── library-page.tsx        ✓ List (back implicit)
│   ├── preset-edit-page.tsx    ✓ Detail (back with params)
│   ├── group-page.tsx          ✓ Detail (back with params)
│   ├── sort-rules-page.tsx     ✓ Detail (back to /presets)
│   ├── category-form-page.tsx  ✓ Detail (back to /presets)
│   └── ...
└── projects/
    ├── project-list-page.tsx   ✓ List (back implicit)
    ├── project-detail-page.tsx ✓ Detail (no back button)
    ├── batch/
    │   └── batch-create.tsx    ✓ Tertiary (back to /projects/:id)
    └── ...
```

---

## 💡 Key Insights

1. **Back Button Consistency**: All detail pages except projects use `<PageHeader back={...}>`
2. **Query Params**: Only presets use query parameters to preserve navigation context
3. **Scroll Restoration**: 
   - **Runs**: Via sessionStorage
   - **Presets**: Via URL query parameters
   - **Projects**: Via section rail scroll sync
4. **Nested Navigation**: Only templates have a 3-level depth (list → edit → section detail)
5. **Implicit Navigation**: Projects use implicit shell-based navigation without explicit back buttons

---

## 🔍 Search Tips

Find all back buttons:
```bash
grep -r "back=" src/app/design-demos/features --include="*.tsx"
```

Find all navigation links:
```bash
grep -r "href={demoHref" src/app/design-demos/features --include="*.tsx"
```

Find specific pages:
```bash
grep -r "href=.*\[A-Z\][a-zA-Z]*Id\|href=.*\${" src/app/design-demos/features --include="*.tsx"
```

# Navigation Flow Diagrams

## Pattern 1: Runs (Simple 2-Level)

```
┌─────────────────────────────────────────┐
│ /runs (QueuePage)                       │
│ - PendingReviewGroups                   │
│ - RunList with runs                     │
│   └─ Link to /runs/:runId               │
└─────────────────────────────────────────┘
                    ↓
        (sessionStorage: run.id)
                    ↓
┌─────────────────────────────────────────┐
│ /runs/:runId (ReviewPage)               │
│ - back: { href: "/runs" }               │
│ - Review images                         │
│ - Download workflow                     │
│                                         │
│ On back: scroll to runId position       │
└─────────────────────────────────────────┘
```

**Files:** 
- List: `queue-page.tsx` (line 215: run-list.tsx)
- Detail: `review-page.tsx` (line 45 back, line 45 navigation)

---

## Pattern 2: Templates (3-Level Nesting)

```
┌──────────────────────────────────────────────┐
│ /templates (TemplateListPage)                │
│ - List all templates                         │
│ - Link to /templates/:id/edit                │
│ - Link to /templates/:id/sections/:idx       │
│ - Link to /templates/new                     │
└──────────────────────────────────────────────┘
         ↓ (id/edit)                ↓ (new)
         │                          │
         ├─────────────────────────┤
         ↓                         ↓
┌──────────────────────────────────────────────┐
│ /templates/:id/edit (TemplateFormPage)      │
│ - back: { href: "/templates" }              │
│ - Edit template metadata                    │
│ - Manage sections with preview              │
│ - Link to /templates/:id/sections/:idx      │
└──────────────────────────────────────────────┘
         ↓ (section index)
         ↓
┌──────────────────────────────────────────────┐
│ /templates/:id/sections/:idx                 │
│ (TemplateSectionPage)                        │
│ - back: { href: "/templates/:id/edit" }     │
│ - Edit section params                       │
│ - Configure preset bindings                 │
│ - Manage LoRA & prompt blocks                │
└──────────────────────────────────────────────┘
```

**Files:**
- Level 1 (List): `template-list.tsx` (line 28, 36)
- Level 2 (Edit): `template-form-page.tsx` (line 78, 96)
- Level 3 (Section): `template-section-page.tsx` (line 40)

---

## Pattern 3: Presets Library (Complex Network)

```
                    ┌─────────────────────────────────────────────┐
                    │ /presets (PresetLibraryPage)                │
                    │ - Preset browser with categories/folders    │
                    │ - Link to preset detail                     │
                    │ - Link to group detail                      │
                    │ - Link to sort-rules                        │
                    │ - Link to category edit                     │
                    └─────────────────────────────────────────────┘
         ┌──────────────┬─────────────────┬──────────────┐
         ↓              ↓                 ↓              ↓
    (preset param) (group param)    (sort-rules) (category edit)
         ↓              ↓                 ↓              ↓
   ┌──────────────────────────────┐ ┌──────────────┐ ┌───────────────┐
   │ /presets?...&preset=:id      │ │ /presets/    │ │ /presets/     │
   │ (PresetEditPage)             │ │ sort-rules   │ │ categories/:id│
   │ back: params preserved       │ │ (SortRules)  │ │ /edit         │
   │ - Edit variants              │ │              │ │ (CategoryForm)│
   │ - Edit LoRA                  │ │ back: /      │ │               │
   │ - Edit prompt blocks         │ │ presets      │ │ back: /presets│
   └──────────────────────────────┘ └──────────────┘ └───────────────┘
   
   ┌──────────────────────────────┐
   │ /presets?...&group=:id       │
   │ (PresetGroupPage)            │
   │ back: params preserved       │
   │ - Edit group members         │
   │ - Add/remove presets         │
   └──────────────────────────────┘
```

**Key Points:**
- All detail pages back to `/presets` (with or without query params)
- Query params structure: `?category={X}&folder={Y}&[preset={Z}|group={Z}]`
- Query params preserved in back button for scroll restoration

**Files:**
- List: `library-page.tsx` (line 291, 302, 310, 446, 640)
- Preset: `preset-edit-page.tsx` (line 254)
- Group: `group-page.tsx` (line 61)
- Sort Rules: `sort-rules-page.tsx` (line 26)
- Category: `category-form-page.tsx` (line 131)

---

## Pattern 4: Projects (Partial + Implicit)

```
┌────────────────────────────────────────────────┐
│ /projects (ProjectListPage)                    │
│ - Browse projects with sections count          │
│ - Link to /projects/:id                        │
│ - Link to /projects/new                        │
└────────────────────────────────────────────────┘
         ↓ (:id) ↓ (/new)
         │       │
         ├───────┤
         ↓       ↓
    ┌────────────────────────────────┐
    │ /projects/:id                  │
    │ (ProjectDetailPage)            │
    │ NO EXPLICIT back button        │
    │ - Uses ProjectSectionShell     │
    │ - Section rail navigation      │
    │ - Can link to batch create:    │
    │   /projects/:id/batch          │
    └────────────────────────────────┘
         ↓
    ┌────────────────────────────────┐
    │ /projects/:id/batch            │
    │ (BatchCreatePage)              │
    │ back: /projects/:id            │
    │ - Import presets               │
    │ - Batch create sections        │
    └────────────────────────────────┘

SECTION DETAIL (INLINE):
    /projects/:id/sections/:sectionId
    └─ Not a separate page
    └─ Triggers scroll sync in ProjectSectionShell
    └─ Renders in same detail view
```

**Special Navigation:**
- Projects detail page uses **implicit navigation** (no `back={...}`)
- Sections are inline, not separate pages
- Uses `ProjectSectionShell` for synchronized scroll between rail and content

**Files:**
- List: `project-list-page.tsx` (line 78, 97 in list-item.tsx)
- Detail: `project-detail-page.tsx` (NO back button)
- Batch: `batch/batch-create.tsx` (line 76)
- Shell: `project-section-shell.tsx` (manages section scroll sync)

---

## Query Parameter Flow (Presets Deep Dive)

```
User browses presets library
        ↓
Clicks on a preset
        ↓
URL: /presets?category=cat-1&folder=folder-2&preset=preset-3
Library component deactivates, route changes to detail page
        ↓
PresetEditPage loads with back button containing SAME query params
        ↓
User clicks back button with href="/presets?category=cat-1&folder=folder-2&preset=preset-3"
        ↓
Library page reloads and automatically:
1. Navigates to category-1
2. Opens folder-2
3. Scrolls to preset-3 position
        ↓
Perfect UX: User returns to exact same view state
```

**Implementation:**
```tsx
// In library-page.tsx
const openHref = demoHref(href);  // href includes query params

// In preset-edit-page.tsx
back={{ 
  href: `/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}`,
  label: "返回预设库" 
}}
```

---

## Session Storage Flow (Runs)

```
User at /runs list page
        ↓
Clicks on run (Link to /runs/:runId)
        ↓
ReviewPage mounts
        ↓
useEffect stores in sessionStorage:
  sessionStorage.setItem("demo-runs-from", run.id)
        ↓
User reviews images, clicks back
        ↓
Back button navigates to /runs
        ↓
QueuePage mounts
        ↓
useState hook reads sessionStorage:
  const fromRunId = sessionStorage.getItem("demo-runs-from")
  sessionStorage.removeItem("demo-runs-from")
        ↓
useEffect expands group and scrolls to runId element:
  element.scrollIntoView({ block: "center" })
        ↓
Perfect UX: User returns to same run in same scroll position
```

**Implementation:**
```tsx
// In review-page.tsx
const SCROLL_RESTORE_KEY = "demo-runs-from";

useEffect(() => {
  if (run) {
    try { 
      sessionStorage.setItem(SCROLL_RESTORE_KEY, run.id); 
    } catch {}
  }
}, [run]);

// In queue-page.tsx
const [fromRunId] = useState(readAndClearScrollRestore);

function readAndClearScrollRestore(): string | undefined {
  try {
    const value = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (value) {
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      return value;
    }
  } catch {}
  return undefined;
}
```

---

## Section Rail Scroll Sync (Projects)

```
ProjectDetailPage loads with ProjectSectionShell
        ↓
ProjectSectionShell setup:
- contentRef: main content area
- railRef: side rail with section list
        ↓
User scrolls main content
        ↓
handleContentScroll triggered:
  1. Find currently visible section cards
  2. Calculate which card is closest to viewport top
  3. Sync railRef scroll position to match progress
  4. Update activeSectionState
        ↓
URL updates: /projects/:id/sections/:sectionId
        ↓
URL structure allows direct linking to sections:
  /projects/proj-1/sections/section-2
  └─ Opens project and scrolls to section-2
```

**Implementation:**
```tsx
// In project-section-shell.tsx
const syncScroll = useCallback((source: "content" | "rail", targetTop: number) => {
  syncSourceRef.current = source;
  const target = source === "content" ? railRef.current : contentRef.current;
  if (target) target.scrollTop = targetTop;
}, []);

// Find closest card to viewport
const cards = Array.from(contentNode.querySelectorAll("[data-section-card]"));
for (const card of cards) {
  const distance = Math.abs(card.getBoundingClientRect().top - containerTop - 8);
  if (distance < bestDistance) {
    bestDistance = distance;
    nextId = card.dataset.sectionCard ?? nextId;
  }
}
setActiveSectionState({ projectId: project.id, sectionId: nextId });
```

---

## Legend

```
┌─────────────────────┐
│ Component/Page      │  = Route + Page Component
└─────────────────────┘

     ↓ (id/param)
     │                = Navigation link/transition
     
back: { href }       = Back button configuration
```

---

## Summary: Navigation Context Preservation Methods

| Pattern | Method | Implementation |
|---------|--------|-----------------|
| Runs | sessionStorage | Store ID on detail page, retrieve on list mount |
| Templates | URL path | Each level has different path structure |
| Presets | Query params | Encode context in URL query string |
| Projects | Implicit shell | Section rail sync, no explicit back |


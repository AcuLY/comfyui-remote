# Files and Locations Quick Reference

## 🎯 Navigation Files

### 1. Card Navigation Trigger
**Path:** `src/app/design-demos/features/runs/pending-review-groups.tsx`

```tsx
// Line 66: The actual Link component
<Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id}>
  {/* Card content */}
</Link>

// Line 4: Import of demoHref
import { cx, demoHref } from "../../routing";
```

**What to modify:** If you want to change how cards navigate, this is where you'd modify the `href`.

---

### 2. Route Definition & Helpers
**Path:** `src/app/design-demos/routing/routes.ts`

```tsx
// Line 62: Route definition
{ key: "queue-review", pattern: "/runs/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 }

// Lines 106-110: demoHref helper
export function demoHref(route: string) {
  const normalized = normalizeProductRoute(route);
  if (normalized === "/") return "/design-demos";
  return `/design-demos${normalized}`;
}

// Lines 112-118: normalizeProductRoute helper
export function normalizeProductRoute(route: string) {
  if (route === "/queue") return "/runs";
  if (route.startsWith("/queue/")) return `/runs/${route.slice("/queue/".length)}`;
  if (route === "/assets") return "/";
  if (route.startsWith("/assets/")) return route.slice("/assets".length);
  return route;
}

// Lines 128-144: matchPattern function (extracts :runId from URL)
export function matchPattern(pattern: string, route: string): Record<string, string> | null {
  // ... implementation
}

// Lines 146-153: matchRoute function (finds matching route)
export function matchRoute(route: string): Match {
  // ... implementation
}
```

**What to modify:** Route definitions (add new patterns), pattern matching logic, or route helpers.

---

### 3. Routing Module Exports
**Path:** `src/app/design-demos/routing/index.ts`

```tsx
export * from "./types";
export * from "./routes";
export * from "./showcase-routes";
export * from "./sfw";
export * from "../data/selectors";
export * from "../shared/media/image-status";
export * from "../shared/media/asset-paths";
export { cx } from "../shared/primitives/classnames";
```

**What to modify:** If you need to export new routing functions.

---

## 📄 Review Detail Page Files

### 1. Main Review Page Component
**Path:** `src/app/design-demos/features/runs/review-page.tsx`

```tsx
// Line 17: Component definition
export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined })

// Line 24: Empty state if run not found
if (!run) return <EmptyPage title="没有可审核运行" />;

// Lines 32-47: PageHeader with back button
<PageHeader
  back={{ href: "/runs", label: "返回任务" }}
  // ...
/>

// Lines 48-50: Parameters section
{section ? (
  <ReviewMetaCard run={run} meta={executionMeta} />
) : null}

// Lines 52-66: Filter tabs
<SegmentedControl
  items={[
    { value: "all", label: "全部", count: runImages.length },
    // ... 5 more filters
  ]}
/>

// Lines 67-72: Image review board
<ReviewImageBoard images={images} onImagesChange={...} />
```

**What to modify:**
- Back button destination (line 34)
- Parameters section visibility (line 48)
- Filter tabs (lines 52-66)
- Image board behavior (lines 67-72)

---

### 2. Parameters/Meta Card Component
**Path:** `src/app/design-demos/features/runs/review-meta-card.tsx`

```tsx
// Lines 11-29: Data merging function (section defaults + run metadata)
export function mergeExecutionMeta(run: DemoRun, section: ...)

// Lines 31-35: Get metadata value helper
function metaText(meta: Record<string, unknown>, key: string, fallback = "未记录")

// Lines 37-39: Convert BREAK to newlines in prompts
function promptTextWithBreakLines(value: string)

// Lines 41-43: Extract LoRA name from file path
function loraName(path: string)

// Lines 45-64: Convert LoRA array entries to display format
function loraEntries(value: unknown)

// Lines 66-91: KSampler 1 & 2 display blocks
function SamplerMetaBlock({ meta, stage }: { meta: Record<string, unknown>; stage: 1 | 2 })

// Lines 93-99: Stat display component
function MetaStat({ label, value }: { label: string; value: ReactNode })

// Lines 102-152: Main parameters display
function ReviewExecutionMeta({ meta }: { meta: Record<string, unknown> })

// Lines 154-181: Collapsible meta card container
export function ReviewMetaCard({ run, meta }: ...)
// Line 161: ⭐ INITIAL OPEN STATE (currently collapsed by default)
const [open, setOpen] = useState(false);
```

**What to modify:**
- Line 161: Change `useState(false)` to `useState(true)` for expanded by default
- Lines 11-29: Modify data merging logic
- Lines 102-152: Add or remove parameter display fields
- Lines 66-91: Modify KSampler display format

---

### 3. Review Page Styles
**Path:** `src/app/design-demos/features/runs/review-page.runs.module.css`

**Modifiable sections:**
- `.reviewPageHeader` - Page header styling
- `.reviewFilterTabs` - Filter tabs styling
- `.reviewSurface` - Surface containing filters and images

---

### 4. Meta Card Styles
**Path:** `src/app/design-demos/features/runs/review-meta-card.runs.module.css`

**Modifiable sections:**
- `.reviewMetaSurface` - Container for parameters
- `.reviewMetaHeader` - Header with expand button
- `.reviewMetaBody` - Expanded content area
- `.reviewSamplerGrid` - KSampler display grid
- `.reviewSamplerBlock` - Individual KSampler block
- `.reviewLoraGrid` - LoRA files grid
- `.reviewPromptGrid` - Prompt display grid

---

## 🗂️ Data Structure Files

### 1. Data Types
**Path:** `src/app/design-demos/data/types.ts`

Defines:
- `DemoData` - Main application data structure
- `DemoRun` - Individual run data
- `DemoSection` - Section configuration
- Related types used in navigation and parameter display

### 2. Data Selectors
**Path:** `src/app/design-demos/data/selectors.ts`

Functions for:
- `findProject(data, projectId)` - Find project by ID
- `findSection(project, sectionId)` - Find section by ID
- Other data lookup functions

---

## 📦 Component Dependencies

```
pending-review-groups.tsx
├─ Link (from "next/link")
├─ demoHref (from "../../routing")
├─ Button (from "../../shared/primitives/button")
├─ EmptyRows (from "../../shared/primitives/empty-rows")
├─ ImageListSmall (from "../../shared/media/image-list-small")
└─ DemoPager (from "./demo-pager")

review-page.tsx
├─ PageHeader (from "../../shared/primitives/page-header")
├─ EmptyPage (from "../../shared/primitives/empty-page")
├─ SegmentedControl (from "../../shared/primitives/segmented-control")
├─ ReviewImageBoard (from "../../shared/media/review-image-board")
├─ ReviewMetaCard (from "./review-meta-card")
└─ Helpers from "../../routing"

review-meta-card.tsx
├─ ReviewImageBoard (from "../../shared/media/review-image-board")
└─ CSS Module (from "./review-meta-card.runs.module.css")
```

---

## 🔍 Key Lines by Purpose

### Navigation Related
| Purpose | File | Line(s) |
|---------|------|---------|
| Card click navigation | pending-review-groups.tsx | 66 |
| Route pattern definition | routes.ts | 62 |
| Route pattern matching | routes.ts | 128-144 |
| Route finding | routes.ts | 146-153 |
| href normalization | routes.ts | 106-118 |

### Review Page Related
| Purpose | File | Line(s) |
|---------|------|---------|
| Page component | review-page.tsx | 17 |
| Empty state | review-page.tsx | 24 |
| Page header | review-page.tsx | 32-47 |
| Parameters section | review-page.tsx | 48-50 |
| Filter tabs | review-page.tsx | 52-66 |
| Image board | review-page.tsx | 67-72 |

### Parameters Related
| Purpose | File | Line(s) |
|---------|------|---------|
| Data merging | review-meta-card.tsx | 11-29 |
| Meta container | review-meta-card.tsx | 154-181 |
| Initial open state | review-meta-card.tsx | 161 |
| Parameters display | review-meta-card.tsx | 102-152 |
| KSampler display | review-meta-card.tsx | 66-91 |
| Helper functions | review-meta-card.tsx | 31-64 |

---

## 📝 Related Shared Components

These components are used in the review flow but defined elsewhere:

### Page Primitives
- **PageHeader** - `src/app/design-demos/shared/primitives/page-header.tsx`
  - Used in review-page.tsx for page header with back button
  
- **EmptyPage** - `src/app/design-demos/shared/primitives/empty-page.tsx`
  - Used in review-page.tsx when run not found
  
- **SegmentedControl** - `src/app/design-demos/shared/primitives/segmented-control.tsx`
  - Used in review-page.tsx for filter tabs

### Media Components
- **ReviewImageBoard** - `src/app/design-demos/shared/media/review-image-board.tsx`
  - Used in review-page.tsx for image grid
  - Used in review-meta-card.tsx (potentially)
  
- **ImageListSmall** - `src/app/design-demos/shared/media/image-list-small.tsx`
  - Used in pending-review-groups.tsx for card thumbnails

---

## 🚀 How to Find Things

### "I need to change how cards navigate"
→ Open `src/app/design-demos/features/runs/pending-review-groups.tsx` at line 66

### "I need to change the route pattern"
→ Open `src/app/design-demos/routing/routes.ts` at line 62

### "I need to make parameters expand by default"
→ Open `src/app/design-demos/features/runs/review-meta-card.tsx` at line 161

### "I need to add a new filter tab"
→ Open `src/app/design-demos/features/runs/review-page.tsx` at lines 52-66

### "I need to change what parameters are displayed"
→ Open `src/app/design-demos/features/runs/review-meta-card.tsx` at lines 102-152

### "I need to change the back button"
→ Open `src/app/design-demos/features/runs/review-page.tsx` at line 34

### "I need to understand data flow"
→ Open `src/app/design-demos/features/runs/review-meta-card.tsx` at lines 11-29

---

## ✅ File Modification Checklist

- [ ] Added to version control? (git add)
- [ ] Tested changes? (npm run dev)
- [ ] Updated related files? (styles, types, etc.)
- [ ] Verified navigation works?
- [ ] Checked TypeScript errors?
- [ ] Reviewed styling changes?

---

Generated: 2026-05-26
Project: `/Users/luca/dev/comfyui-remote`

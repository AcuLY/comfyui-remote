# Navigation Flow: "待审核" (Pending Review) Card → /runs/:id Detail Page

## Overview
This document explains how users navigate from the pending review list to the detail page for individual runs in the ComfyUI Remote application.

---

## 1. Navigation Entry Point: pending-review-groups.tsx

**File:** `src/app/design-demos/features/runs/pending-review-groups.tsx`

### How Cards Navigate
Each card in the pending review list is wrapped in a **Next.js `<Link>` component** (line 66):

```tsx
<Link className={s.queueRunRow} href={demoHref(`/runs/${row.run.id}`)} key={row.run.id}>
  <div className={s.queueRunMain}>
    <strong>{row.run.sectionName}</strong>
    <span>run {row.run.runIndex}</span>
    <span className={s.queueRunDate}>生成于 {row.run.createdAt}</span>
  </div>
  <ImageListSmall className={s.queueThumbs} images={row.run.images} ... />
</Link>
```

**Key Details:**
- **Navigation Method:** Next.js `<Link>` component
- **Href:** `demoHref(`/runs/${row.run.id}`)`
- **Data Source:** `row.run.id` - the unique run ID from the review row
- **Card Content Displayed:**
  - Section name (e.g., project section)
  - Run index (which run number it is)
  - Created date (生成于)
  - Thumbnail images

### The `demoHref()` Helper Function
Located in `src/app/design-demos/routing/routes.ts` (lines 106-110):

```tsx
export function demoHref(route: string) {
  const normalized = normalizeProductRoute(route);
  if (normalized === "/") return "/design-demos";
  return `/design-demos${normalized}`;
}
```

**Purpose:** Converts production routes to design-demo paths by prefixing `/design-demos`

**Example:** `/runs/run-123` → `/design-demos/runs/run-123`

---

## 2. Route Definition: routes.ts

**File:** `src/app/design-demos/routing/routes.ts`

### Route Configuration (line 62)
```tsx
{ key: "queue-review", pattern: "/runs/:runId", title: "审核宫格", group: "核心", icon: Grid3X3 }
```

**Pattern Breakdown:**
- **Pattern:** `/runs/:runId`
- **Key:** `"queue-review"` (used for route matching)
- **Title:** "审核宫格" (Review Grid)
- **Icon:** `Grid3X3`
- **Parameter:** `:runId` - extracted from the URL and matched to find the specific run

### Route Matching Function (lines 146-153)
```tsx
export function matchRoute(route: string): Match {
  const normalized = route === "" ? "/" : route;
  for (const def of ROUTES) {
    const params = matchPattern(def.pattern, normalized);
    if (params) return { key: def.key, params, route: normalized };
  }
  return { key: "not-found", params: {}, route: normalized };
}
```

This function:
1. Normalizes the route
2. Iterates through all ROUTES
3. Uses `matchPattern()` to extract URL parameters (`:runId`)
4. Returns the matched route with its parameters

---

## 3. Detail Page: review-page.tsx

**File:** `src/app/design-demos/features/runs/review-page.tsx`

### Component Props
```tsx
export function ReviewPage({ data, run }: { data: DemoData; run: DemoRun | undefined })
```

### Page Structure

#### 3.1 Page Header (lines 32-47)
```tsx
<PageHeader
  className={s.reviewPageHeader}
  back={{ href: "/runs", label: "返回任务" }}
  eyebrow="审核"
  title={`${run.projectTitle} / ${run.sectionName}`}
  subtitle={project?.notes || undefined}
  actions={
    <>
      {sectionPath ? <ButtonLink href={sectionPath} icon={ExternalLink}>跳转至小节</ButtonLink> : null}
      <a className={s.workflowDownloadLink} href={`/api/runs/${run.id}/workflow`} download>
        <Download className={s.iconMd} />
        下载工作流文件
      </a>
    </>
  }
/>
```

**Features:**
- **Back Button:** Returns to `/runs` with label "返回任务" (Return to Tasks)
- **Title Format:** `{Project Title} / {Section Name}`
- **Actions:**
  - Jump to section button (跳转至小节)
  - Download workflow file (下载工作流文件)

#### 3.2 Parameters Section: ReviewMetaCard (lines 48-50)
```tsx
{section ? (
  <ReviewMetaCard run={run} meta={executionMeta} />
) : null}
```

**Default State:** **EXPANDED** (initially open)

Location: `src/app/design-demos/features/runs/review-meta-card.tsx`

**Parameters Displayed ("参数" section contents):**

1. **KSampler 1 & 2 Blocks**
   - Seed
   - Steps
   - CFG (Classifier-Free Guidance)
   - Denoise
   - Sampler (sampling method)

2. **Checkpoint & Workflow**
   - Checkpoint name
   - Workflow ID

3. **LoRA1 & LoRA2 Columns**
   - LoRA file names
   - Weight values
   - Enabled/Disabled status
   - Entry count

4. **Prompts**
   - Positive prompt (Prompt)
     - Character count display
     - Multiline formatting (BREAK becomes newlines)
   - Negative prompt (Negative)
     - Character count display
     - Multiline formatting

**State Management (line 161):**
```tsx
const [open, setOpen] = useState(false);
```

**NOTE:** The state initializes to `false`, which means **the section starts COLLAPSED** by default in the code. However, this may need to be changed to `true` based on requirements.

#### 3.3 Filter Tabs (lines 52-66)
```tsx
<SegmentedControl
  ariaLabel="切换视图"
  className={s.reviewFilterTabs}
  role="tablist"
  items={[
    { value: "all", label: "全部", count: runImages.length },
    { value: "pending", label: "待审", count: runImages.filter((image) => image.status === "pending").length },
    { value: "kept", label: "已保留", count: runImages.filter((image) => image.status === "kept").length },
    { value: "pstation", label: "p站", count: runImages.filter((image) => image.featured).length },
    { value: "preview", label: "预览", count: runImages.filter((image) => image.featured2).length },
    { value: "cover", label: "封面", count: runImages.filter((image) => image.cover).length },
  ]}
  value={filter}
  onChange={setFilter}
/>
```

**Filter Options:**
- 全部 (All) - Total image count
- 待审 (Pending) - Images awaiting review
- 已保留 (Kept) - Approved images
- p站 (Featured) - Images marked as featured
- 预览 (Preview) - Images marked as featured2
- 封面 (Cover) - Cover images

#### 3.4 Image Review Board (lines 67-72)
```tsx
<ReviewImageBoard images={images} onImagesChange={(updated) => {
  setRunImages((prev) => prev.map((img) => {
    const match = updated.find((u) => u.id === img.id);
    return match ?? img;
  }));
}} />
```

Displays the filtered images with interactive review capabilities.

---

## 4. Data Flow Diagram

```
pending-review-groups.tsx
  ├─ Lists QueueReviewRow items
  ├─ Each row contains: run.id, run.sectionName, run.runIndex, run.createdAt, run.images
  └─ Wrapped in <Link href={demoHref(`/runs/${row.run.id}`)}>
       │
       └─→ demoHref() helper
            └─→ /design-demos/runs/{runId}
                 │
                 └─→ Next.js routing
                      │
                      └─→ review-page.tsx
                           ├─ Receives data: DemoData
                           ├─ Receives run: DemoRun (found by matching :runId)
                           ├─ PageHeader (back button + title)
                           ├─ ReviewMetaCard (parameters)
                           │   ├─ Initial state: collapsed (useState(false))
                           │   └─ Shows: KSampler, Checkpoint, LoRA, Prompts
                           ├─ Filter tabs (6 filter options)
                           └─ ReviewImageBoard (image grid)
```

---

## 5. Parameter Section (参数) - Detailed Breakdown

### ReviewMetaCard Component
File: `src/app/design-demos/features/runs/review-meta-card.tsx`

### Meta Data Merging (lines 11-29)
```tsx
export function mergeExecutionMeta(run: DemoRun, section: ...) {
  const fallback: Record<string, unknown> = {
    aspectRatio: section.aspectRatio,
    shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    checkpointName: section.checkpointName,
    workflowId: run.id,
    lora1: section.lora1 ?? [],
    lora2: section.lora2 ?? [],
    positivePrompt: section.positivePrompt,
    negativePrompt: section.negativePrompt,
  };

  // Override with run-specific metadata if available
  for (const [key, value] of Object.entries(run.executionMeta ?? {})) {
    if (value !== null && value !== undefined && value !== "") fallback[key] = value;
  }

  return fallback;
}
```

**Priority Order:**
1. Section default parameters
2. Run-specific execution metadata (overrides section defaults)

### Parameters Display Logic

**KSampler Blocks (2 stages):**
- Uses prefix: `ks1` (stage 1), `ks2` (stage 2)
- Fields: Seed, Steps, Cfg, Denoise, Sampler
- Empty sampler shows "跳过（1x 或未记录高清修复参数）" (Skipped)

**LoRA Entries:**
- Extracted from arrays
- Fields per entry:
  - `path` / `filePath` / `fileName`
  - `weight` (default: "未设权重" if not set)
  - `enabled` (boolean, defaults to true)

**Prompts:**
- Both positive and negative
- "BREAK" tokens converted to newlines
- Character count displayed
- Empty defaults to "未记录" (Not recorded)

---

## 6. Key Technical Points

### 1. **URL Parameter Extraction**
- Pattern: `/runs/:runId`
- Parameter name: `runId` (not `id` or `run_id`)
- Extracted via `matchPattern()` function

### 2. **Demo Route Prefixing**
- All routes prefixed with `/design-demos` in the demo environment
- Production routes normalized via `normalizeProductRoute()`

### 3. **Data Resolution**
- Run data resolved server-side in the layout/page component
- Passed to `ReviewPage` as prop
- If run not found: `EmptyPage` component shown (line 24)

### 4. **Parameter Section Default State**
- **Current:** Starts collapsed (`useState(false)`)
- **To change:** Modify to `useState(true)` if default expanded behavior is needed

### 5. **Image Filtering**
- Supports 6 filter types
- Updates component state via `setRunImages()`
- Count displayed on each tab

---

## 7. Implementation Summary

| Aspect | Details |
|--------|---------|
| **Entry Point** | `<Link>` in pending-review-groups.tsx |
| **Click Href** | `demoHref(`/runs/${row.run.id}`)` |
| **Route Pattern** | `/runs/:runId` |
| **Route Key** | `"queue-review"` |
| **Destination** | `review-page.tsx` |
| **Parameters Section** | `ReviewMetaCard` component |
| **Parameters Default State** | Collapsed (change to expanded: `useState(true)`) |
| **Data Source** | `executionMeta` merged with section defaults |
| **Back Navigation** | Returns to `/runs` |

---

## 8. Files to Modify (if needed)

### To make parameters section default to expanded:
**File:** `src/app/design-demos/features/runs/review-meta-card.tsx`
**Line:** 161
**Change:**
```tsx
// Before:
const [open, setOpen] = useState(false);

// After:
const [open, setOpen] = useState(true);
```


# Navigation Flow Summary: Quick Reference

## 🎯 The Navigation Flow in 30 Seconds

```
User clicks pending review card
    ↓
<Link href={demoHref(`/runs/${row.run.id}`)}>
    ↓
Browser navigates to: /design-demos/runs/{runId}
    ↓
ReviewPage component renders with detail view
    ↓
Parameters section (ReviewMetaCard) is COLLAPSED by default
    ↓
User can click to expand and see: KSampler, Checkpoint, LoRA, Prompts
```

---

## 📍 Key Components

### 1. **Navigation Trigger**
- **File:** `src/app/design-demos/features/runs/pending-review-groups.tsx` (line 66)
- **Element:** `<Link>` component wrapping each review card
- **Href:** `demoHref(`/runs/${row.run.id}`)`
- **What it shows:** Section name, run index, date, thumbnails

### 2. **URL Pattern Matching**
- **File:** `src/app/design-demos/routing/routes.ts` (line 62)
- **Pattern:** `/runs/:runId`
- **Route Key:** `"queue-review"`
- **Function:** `matchPattern()` extracts `:runId` parameter

### 3. **Detail Page**
- **File:** `src/app/design-demos/features/runs/review-page.tsx`
- **Component:** `ReviewPage`
- **Props:** `{ data: DemoData, run: DemoRun }`
- **Sections:**
  - PageHeader with back button
  - ReviewMetaCard (parameters)
  - Filter tabs
  - ReviewImageBoard

### 4. **Parameters Section**
- **File:** `src/app/design-demos/features/runs/review-meta-card.tsx`
- **Component:** `ReviewMetaCard`
- **Default State:** **COLLAPSED** (line 161: `useState(false)`)
- **Contents when expanded:**
  - KSampler 1 & 2 (seed, steps, cfg, denoise, sampler)
  - Checkpoint & Workflow ID
  - LoRA 1 & 2 files with weights
  - Positive & Negative prompts

---

## 🔄 Data Flow

```
PendingReviewGroups
├─ Lists QueueReviewRow[]
├─ Each row has: run.id, run.sectionName, run.runIndex, run.createdAt, run.images
└─ Renders <Link href={demoHref(`/runs/${row.run.id}`)}>

    ↓ (Next.js navigation)

ReviewPage receives:
├─ data: DemoData (all app data)
├─ run: DemoRun (found by matching :runId)
└─ Renders:
    ├─ PageHeader (back, title, actions)
    ├─ ReviewMetaCard (parameters)
    │  └─ Data from mergeExecutionMeta(run, section)
    │     └─ Priority: section defaults + run.executionMeta overrides
    ├─ SegmentedControl (6 filter tabs)
    └─ ReviewImageBoard (interactive images)
```

---

## 📋 Parameter Data Priority

1. **Section defaults** (from project configuration)
   - aspectRatio, shortSidePx, batchSize, checkpointName
   - lora1, lora2, positivePrompt, negativePrompt

2. **Run-specific metadata** (overrides if not empty/null)
   - ks1Seed, ks1Steps, ks1Cfg, ks1Denoise, ks1Sampler
   - ks2Seed, ks2Steps, ks2Cfg, ks2Denoise, ks2Sampler
   - Any custom executionMeta fields

---

## 🎨 Filter Tabs (6 options)

| Label | Value | Logic |
|-------|-------|-------|
| 全部 (All) | `all` | Show all images |
| 待审 (Pending) | `pending` | `status === "pending"` |
| 已保留 (Kept) | `kept` | `status === "kept"` |
| p站 (Featured) | `pstation` | `featured === true` |
| 预览 (Preview) | `preview` | `featured2 === true` |
| 封面 (Cover) | `cover` | `cover === true` |

---

## 🔧 How to Modify

### Make Parameters Section Expand by Default

**File:** `src/app/design-demos/features/runs/review-meta-card.tsx`  
**Line:** 161  
**Change:**
```tsx
// Before:
const [open, setOpen] = useState(false);

// After:
const [open, setOpen] = useState(true);
```

### Change Back Button Destination

**File:** `src/app/design-demos/features/runs/review-page.tsx`  
**Line:** 34  
**Current:** `href: "/runs"`  
**Change to:** Any other path as needed

### Add More Filter Tabs

**File:** `src/app/design-demos/features/runs/review-page.tsx`  
**Lines:** 52-66  
**Pattern:** Add new item to the `items` array with:
- `value`: filter identifier
- `label`: display label
- `count`: filter count formula

---

## 📊 Important Files Map

```
src/app/design-demos/
├─ features/runs/
│  ├─ pending-review-groups.tsx    ← Card navigation trigger
│  ├─ review-page.tsx               ← Detail page
│  ├─ review-meta-card.tsx          ← Parameters section
│  └─ review-page.runs.module.css   ← Styles
├─ routing/
│  ├─ routes.ts                     ← Route definitions & matching
│  ├─ href.ts                       ← Href helpers export
│  └─ index.ts                      ← Routing module barrel
└─ data/
   └─ types.ts                      ← DemoData, DemoRun types
```

---

## 🎯 Quick Lookup Table

| Need to find... | Look in... | See line... |
|-----------------|-----------|------------|
| Navigation link | pending-review-groups.tsx | 66 |
| Route pattern | routes.ts | 62 |
| Review page | review-page.tsx | 17 |
| Parameters component | review-meta-card.tsx | 154 |
| Parameters expand state | review-meta-card.tsx | 161 |
| Back button | review-page.tsx | 34 |
| Filter tabs | review-page.tsx | 52-66 |
| Data merging logic | review-meta-card.tsx | 11-29 |
| KSampler display | review-meta-card.tsx | 66-91 |
| Helper functions | review-meta-card.tsx | 31-64 |

---

## 🚀 URL Examples

| User Action | URL | Route Pattern | Params |
|-------------|-----|---------------|--------|
| Click card | `/design-demos/runs/run-123` | `/runs/:runId` | `{ runId: "run-123" }` |
| Internal link | `/runs/run-456` | (normalized) | (same) |
| Production | `/runs/run-789` | (same) | (same) |

---

## 📝 Key Helper Functions

```tsx
// Normalize routes (e.g., /queue → /runs)
normalizeProductRoute(route: string) → string

// Add /design-demos prefix for demo environment
demoHref(route: string) → string

// Match URL against route pattern
matchPattern(pattern: string, route: string) → Record<string, string> | null

// Find matching route definition
matchRoute(route: string) → Match

// Merge section defaults with run metadata
mergeExecutionMeta(run, section) → Record<string, unknown>
```

---

## 🔍 Debugging Tips

1. **Card not clickable?** → Check `<Link>` component wrapping (line 66)
2. **Page not loading?** → Check if route matches pattern `/runs/:runId`
3. **Parameters not showing?** → Check if `section` exists (line 48)
4. **Data missing?** → Check `mergeExecutionMeta()` priority (lines 11-29)
5. **Wrong values shown?** → Check `run.executionMeta` overrides

---

## 📚 Documentation Files

This project includes three additional reference documents:

1. **NAVIGATION_FLOW_ANALYSIS.md**
   - Detailed explanation of each layer
   - Component structure
   - Data flow diagrams
   - File-by-file breakdown

2. **NAVIGATION_DIAGRAM.txt**
   - Visual ASCII diagrams
   - Component hierarchy
   - State management
   - Parameter section layout

3. **CODE_SNIPPETS_REFERENCE.md**
   - Copy-paste code examples
   - Function signatures
   - Implementation patterns
   - Quick reference table

---

## ✅ Implementation Checklist

- [ ] Understand navigation flow (Card → Link → Route → Page)
- [ ] Locate `ReviewPage` component and its props
- [ ] Find `ReviewMetaCard` and understand its state
- [ ] Review `mergeExecutionMeta()` data priority
- [ ] Check filter tabs implementation
- [ ] Test card navigation works
- [ ] Verify parameters section expand/collapse
- [ ] Review data display formatting helpers

---

Generated: 2026-05-26
Project: `/Users/luca/dev/comfyui-remote`

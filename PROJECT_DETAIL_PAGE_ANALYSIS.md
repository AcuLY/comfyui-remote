# ComfyUI Remote - Project Detail Page Analysis

## Overview
The project detail page displays a "小节列表" (Section List) that shows all sections (小节) for a project. Each section is a complete parameter set for one image generation run.

---

## 1. Page Component - Project Detail Route

**File**: `/Users/luca/dev/comfyui-remote/src/app/projects/[projectId]/page.tsx` (Lines 1-63)

**Route**: `/projects/[projectId]` (dynamic route using `[projectId]` parameter)

**Key Features**:
- Server component with `dynamic = "force-dynamic"` (always fresh data)
- Fetches project detail and revision history in parallel
- Returns 404 if project not found
- Three main sections displayed:
  1. Project Header Card (title + preset names)
  2. Project Parameters Overview
  3. **Section List** (小节列表) - Main focus
  4. Revision History

**Structure**:
```tsx
export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> })
```

---

## 2. Section Rendering - SectionList Component

**File**: `/Users/luca/dev/comfyui-remote/src/app/projects/[projectId]/section-list.tsx` (Lines 1-244)

**Is Client Component**: `"use client"` (uses state, drag-drop)

### 2.1 Main Container: `SectionList` Component (Lines 48-104)

**Props**:
```typescript
type SectionListProps = {
  projectId: string;
  sections: Section[];
};
```

**Features**:
- Uses `@dnd-kit` (dnd-kit library) for drag-and-drop reordering
- Implements drag sensors: `PointerSensor` (8px activation distance) + `KeyboardSensor`
- Uses `DndContext` with `closestCenter` collision detection
- Vertical list sorting strategy with `SortableContext`
- Optimistic UI updates: updates local state immediately, syncs with server
- Reverts changes on error

**Drag-Drop Setup**:
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);
```

---

### 2.2 Individual Section Card: `SortableSectionCard` (Lines 106-244)

**What Each Section Card Shows**:

```
┌─────────────────────────────────────────┐
│ ⋮⋮ 1. Section Name      [Copy] [Delete] │  ← Header row
│    正 2 · 负 3           [View All]     │  ← Metadata (prompt blocks)
│    batch 2 · 16:9 · seed 123 · done    │  
├─────────────────────────────────────────┤
│ Thumbnail images (max 8 shown)          │  ← Image previews
│ [img] [img] [img] [img] +2              │  ← with status badges
├─────────────────────────────────────────┤
│ [Run This Section] [Copy] [Delete]      │  ← Action buttons
└─────────────────────────────────────────┘
```

**Card Layout Structure** (Lines 117-243):

1. **Main Content Area** (Lines 124-160)
   - Drag handle: `GripVertical` icon from lucide-react
   - Clickable section info area: Links to `/projects/{projectId}/sections/{sectionId}/blocks`
   - Display: "Index. Name" + prompt block badges
   - Display: `batch · aspectRatio · seedPolicy · latestRunStatus`
   - Desktop-only copy/delete buttons (hidden on mobile)

2. **Result Preview Section** (Lines 163-228)
   - Shows latest 8 thumbnail images from most recent completed run
   - Each image shows status badge (kept/trashed/pending)
   - Includes count of pending images with amber highlight
   - "View All" link to results gallery
   - Fallback: empty state message if no results

3. **Action Buttons** (Lines 230-241)
   - `SectionRunButton`: Run this section with batch size control
   - Mobile-only copy/delete buttons (hidden on desktop)

**Styling** (Lines 121-122):
- Base: `rounded-2xl border border-white/10 bg-white/[0.03] p-4`
- Dragging state: `shadow-lg ring-2 ring-sky-500/30` + opacity reduction for other items

---

## 3. Data Structure for Sections

### 3.1 Section Type Definition (Lines 28-41 in section-list.tsx)

```typescript
type Section = {
  id: string;
  name: string;
  batchSize: number | null;
  aspectRatio: string | null;
  seedPolicy1: string | null;
  seedPolicy2: string | null;
  latestRunStatus: string | null;
  latestRunId: string | null;
  promptBlockCount: number;
  positiveBlockCount: number;
  negativeBlockCount: number;
  latestImages: { id: string; src: string; status: string }[];
};
```

### 3.2 Project Detail Data Structure (from server-data.ts, Lines 274-294)

```typescript
export type ProjectDetail = {
  id: string;
  title: string;
  presetNames: string[];
  status: string;
  sections: {
    id: string;
    name: string;
    batchSize: number | null;
    aspectRatio: string | null;
    seedPolicy1: string | null;
    seedPolicy2: string | null;
    latestRunStatus: string | null;
    latestRunId: string | null;
    promptBlockCount: number;
    positiveBlockCount: number;
    negativeBlockCount: number;
    latestImages: { id: string; src: string; status: string }[];
  }[];
};
```

### 3.3 Database Model (ProjectSection from Prisma)

Key fields from schema:
- `id`: UUID
- `projectId`: Foreign key to Project
- `name`: Optional section name
- `sortOrder`: Integer for ordering (supports drag-drop reordering)
- `enabled`: Boolean flag
- `batchSize`: Optional number
- `aspectRatio`: String like "16:9", "1:1", etc.
- `seedPolicy1`, `seedPolicy2`: Seed control strategies
- `upscaleFactor`: Optional upscale multiplier
- `positivePrompt`, `negativePrompt`: Legacy prompt fields
- `promptBlocks`: Relationship to individual prompt blocks
- `runs`: Relationship to generation runs
- `latestRunId`: ID of most recent completed run
- `createdAt`, `updatedAt`: Timestamps

---

## 4. Scrolling & Navigation Patterns

### 4.1 Container-Level Scrolling

**From globals.css** (Lines 35-59):
- Custom scrollbar styling for all containers
- Firefox: `scrollbar-width: thin; scrollbar-color: #3f3f46 transparent;`
- WebKit: 6px width/height, rounded corners, gray color (#3f3f46)
- Hover state: lighter gray (#52525b)

### 4.2 Section List Scrolling

**Vertical scrolling**:
- The project detail page itself has `space-y-4` (Tailwind spacing)
- Each section card is separated by Tailwind spacing
- Implicit vertical scroll on the page when many sections exist

**Horizontal scrolling in image previews** (Line 186):
- `flex gap-1.5 overflow-x-auto scrollbar-none`
- Horizontal scroll for thumbnail strip with `scrollbar-none` class
- Smooth scrolling for image carousel

### 4.3 Navigation Patterns

**Internal Links from Section Card**:
1. **Section name** → `/projects/{projectId}/sections/{sectionId}/blocks` (edit section)
2. **"View All" images link** → `/projects/{projectId}/sections/{sectionId}/results` (view gallery)
3. **Individual image** → `/queue/{latestRunId}` (view queue/results)
4. **"Return to project"** → `/projects` (back button at top)

---

## 5. Overall Layout & Styling Approach

### 5.1 Design System

**Color Scheme** (from globals.css):
```css
:root {
  --bg: #09090b;           /* Very dark background */
  --fg: #f4f4f5;           /* Light foreground text */
  --panel: #111217;        /* Dark panel background */
  --panel-soft: #171923;   /* Slightly lighter panel */
}
```

**Background**: Radial gradient from #18181b at top to #09090b

### 5.2 Container Structure

**Page Layout**:
```tsx
<div className="space-y-4">
  {/* Back button */}
  {/* Project Header Card */}
  {/* Parameters Overview Card */}
  {/* Section List Card */}
  {/* Revision History Card */}
</div>
```

**Card Template** (SectionCard component, 16 lines):
```tsx
<section className="rounded-3xl border border-white/10 bg-[var(--panel)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
  <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {subtitle ? <p className="mt-1 text-xs text-zinc-400">{subtitle}</p> : null}
    </div>
    {actions}
  </div>
  {children}
</section>
```

**Section List Card Styling**:
- Outer: `rounded-2xl border border-white/10 bg-white/[0.03] p-4`
- Title: "小节列表"
- Subtitle: "拖动排序、点击名称重命名。每个小节对应一次完整生图的参数集合，可独立运行。"
- Spacing between sections: `space-y-3`

### 5.3 Interactive Elements

**Buttons**:
- Primary (Run): `rounded-2xl border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sky-300`
- Secondary (Copy): `rounded-xl border-white/10 bg-white/[0.04] px-3 py-2 text-zinc-400`
- Danger (Delete): `rounded-xl border-white/10 bg-white/[0.04] hover:border-rose-500/20 hover:bg-rose-500/10 text-rose-300`

**Icons**:
- From `lucide-react`: GripVertical, Layers, ImageIcon, Copy, Plus, Trash2, Play, etc.
- Compact sizing: `size-3.5` to `size-4`

**Badges**:
- Prompt block count: `inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400`
- Image status: "kept" (emerald), "trashed" (rose), "pending" (amber)

### 5.4 Responsive Design

**Desktop** (Lines 157-160):
- Copy/Delete buttons visible in header row

**Mobile** (Lines 237-240):
- Copy/Delete buttons moved to bottom action row
- Hidden on desktop with `sm:hidden` / `sm:flex`

**Tailwind Breakpoint**: `sm` = 640px

---

## 6. Key Libraries & Dependencies

### 6.1 Drag & Drop
- `@dnd-kit/core`: Core DnD functionality
- `@dnd-kit/sortable`: Sortable list component
- `@dnd-kit/utilities`: CSS transformation utilities

### 6.2 UI/Icons
- `lucide-react`: Icon library
- `next/image`: Image component for thumbnails
- `next/link`: Client-side navigation

### 6.3 State & Actions
- `useTransition`: Server action state management
- `useActionState`: Form action state in alternative version
- React hooks: `useState`, `useEffect`, `useId`

### 6.4 Data Fetching
- Server function: `getProjectDetail(projectId)` from `@/lib/server-data`
- Server actions: `reorderSections()`, `addSection()`, etc. from `@/lib/actions`

---

## 7. Data Flow

```
User navigates to /projects/[projectId]
           ↓
ProjectDetailPage (server component)
    └─→ getProjectDetail(projectId) [database fetch]
    └─→ Returns ProjectDetail object with sections array
           ↓
SectionCard wrapper (UI)
    └─→ Display header, params, and pass sections to SectionList
           ↓
SectionList (client component, "use client")
    ├─→ DndContext setup (drag handlers)
    ├─→ SortableContext with sections IDs
    └─→ Map sections to SortableSectionCard
           ↓
Per SortableSectionCard:
    ├─→ Display section info (name, batch, aspect ratio, status)
    ├─→ Display latest images from latestRun
    ├─→ Show action buttons (run, copy, delete)
    └─→ On drag: 
        ├─→ Optimistic UI update (swap order in state)
        ├─→ Call server action: reorderSections()
        └─→ On error: revert to previous order
```

---

## 8. Key Features & Interactions

### 8.1 Drag & Drop Reordering
- Grab handle with tooltip indication
- 8px activation distance (to avoid accidental triggers)
- Real-time visual feedback: ring and shadow
- Optimistic updates with error rollback
- Keyboard support (arrow keys)

### 8.2 Section Actions
- **Add**: Button at bottom - creates new section
- **Copy**: Duplicate entire section (from section-actions.tsx)
- **Delete**: With confirmation dialog
- **Run**: Execute section with optional batch size override
- **Rename**: Click on name (implemented in section name editor)

### 8.3 Image Gallery
- Horizontal scrollable strip
- Max 8 images displayed with "+N" indicator
- Color-coded status badges
- Click to navigate to queue/results view
- Shows "waiting for review" count

### 8.4 Metadata Display
- Prompt block count: "正 X · 负 Y" (positive · negative blocks)
- Generation parameters: batch size, aspect ratio, seed policy
- Latest run status: "done", "running", "failed", "未运行" (not run yet)

---

## 9. Performance Considerations

### 9.1 Optimizations
- **Lazy image loading**: Using Next.js Image component with `unoptimized`
- **Optimistic updates**: UI doesn't wait for server response
- **Selective re-renders**: Section list uses DnD kit's memoization
- **Image preview limit**: Only 8 latest images shown (not full gallery)

### 9.2 Potential Bottlenecks
- Fetching all sections with their runs and prompt blocks on page load
- All section images fetched at once (could pagination help?)
- Re-rendering entire list on any section change

---

## 10. File Reference Summary

| File | Lines | Purpose | Type |
|------|-------|---------|------|
| `page.tsx` | 63 | Project detail page component | Server component |
| `section-list.tsx` | 244 | Section list with drag-drop | Client component |
| `section-actions.tsx` | 67 | Add/Copy/Delete buttons | Client component |
| `project-detail-actions.tsx` | 136 | Run project, export, delete | Client component |
| `section-card.tsx` | 16 | Generic card wrapper | UI component |
| `server-data.ts` | 371+ | Data fetching functions | Server functions |
| `globals.css` | 81 | Global styles & scrollbars | CSS |
| `ProjectSection.ts` | 2300+ | Prisma model definition | Generated |

---

## 11. File Paths Summary

**Main Components**:
- `/src/app/projects/[projectId]/page.tsx` - Main page
- `/src/app/projects/[projectId]/section-list.tsx` - Section list rendering
- `/src/app/projects/[projectId]/section-actions.tsx` - Section CRUD buttons
- `/src/app/projects/[projectId]/project-detail-actions.tsx` - Project-level actions

**Supporting Files**:
- `/src/components/section-card.tsx` - Reusable card wrapper
- `/src/lib/server-data.ts` - Data fetching
- `/src/app/globals.css` - Global styles
- `/prisma/schema.prisma` - Database schema


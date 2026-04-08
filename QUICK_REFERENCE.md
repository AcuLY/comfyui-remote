# Quick Reference - Project Detail Page (小节列表)

## File Locations

| What | Where | Lines |
|------|-------|-------|
| **Main page** | `src/app/projects/[projectId]/page.tsx` | 63 |
| **Section list + drag-drop** | `src/app/projects/[projectId]/section-list.tsx` | 244 |
| **Add/Copy/Delete buttons** | `src/app/projects/[projectId]/section-actions.tsx` | 67 |
| **Run/Export/Delete project** | `src/app/projects/[projectId]/project-detail-actions.tsx` | 136 |
| **Card wrapper component** | `src/components/section-card.tsx` | 16 |
| **Data fetching** | `src/lib/server-data.ts` | 371+ |
| **Global styles** | `src/app/globals.css` | 81 |
| **Database schema** | `prisma/schema.prisma` | — |

---

## One-Line Summaries

### page.tsx
Server component that fetches project data and renders the full detail page with header, params, sections, and revision history.

### section-list.tsx  
Client component with dnd-kit drag-drop, maps sections to SortableSectionCard, handles optimistic reordering with server sync.

### section-actions.tsx
Three client components: AddSectionButton (creates), CopySectionButton (duplicates), DeleteSectionButton (removes with confirm).

### project-detail-actions.tsx
Two main exports: ProjectDetailActions (run whole project, export images, delete project), SectionRunButton (run single section).

### section-card.tsx
Simple wrapper component with title, subtitle, actions slot, and children. Used for all major page sections.

### server-data.ts
`getProjectDetail()` fetches project + sections with latest images and prompt blocks, returns ProjectDetail type.

### globals.css
Dark theme setup, custom scrollbars, Tailwind integration, radial gradient background.

---

## Core Data Types

### Section (in component)
```typescript
{
  id: string
  name: string
  batchSize?: number
  aspectRatio?: string
  seedPolicy1?: string
  seedPolicy2?: string
  latestRunStatus?: string
  latestRunId?: string
  promptBlockCount: number
  positiveBlockCount: number
  negativeBlockCount: number
  latestImages: { id; src; status }[]
}
```

### ProjectDetail (from server)
```typescript
{
  id: string
  title: string
  presetNames: string[]
  status: string
  sections: Section[]  // same structure as above
}
```

---

## Component Tree

```
page.tsx (Server)
  ├─ getProjectDetail(projectId)
  ├─ getProjectRevisions(projectId)
  ├─ SectionCard (header)
  ├─ ProjectDetailActions (client)
  ├─ SectionCard (params)
  ├─ SectionCard
  │   └─ SectionList (client)
  │       └─ SortableSectionCard x N
  │           ├─ CopySectionButton (client)
  │           ├─ DeleteSectionButton (client)
  │           └─ SectionRunButton (client)
  ├─ AddSectionButton (client)
  └─ SectionCard (history)
      └─ RevisionHistory (client)
```

---

## Key Features

| Feature | File | Type | Status |
|---------|------|------|--------|
| Drag-drop sort | section-list.tsx | dnd-kit | ✅ Full |
| Optimistic updates | section-list.tsx | useState + startTransition | ✅ Full |
| Image gallery | section-list.tsx | horizontal scroll | ✅ Limited to 8 |
| Responsive buttons | section-list.tsx | sm:flex / sm:hidden | ✅ Desktop/Mobile |
| Status badges | section-list.tsx | status strings | ✅ Full |
| Delete confirm | section-actions.tsx | window.confirm() | ✅ Full |
| Server sync | section-list.tsx | reorderSections() action | ✅ Full |

---

## Navigation Routes

| From | To | Via | Element |
|------|----|----|---------|
| Section card | Edit section | `/projects/{id}/sections/{id}/blocks` | Title link |
| Section card | View results | `/projects/{id}/sections/{id}/results` | "View All" link |
| Section card | Queue/review | `/queue/{runId}` | Image thumbnail |
| Page top | Project list | `/projects` | Back button |

---

## Styling Quick Tips

### Colors
- Dark panel: `bg-white/[0.03]` + `bg-white/[0.08]` on hover
- Blue (active): `border-sky-500/20` + `text-sky-300`
- Red (danger): `border-rose-500/20` + `text-rose-300`
- Green (kept): `bg-emerald-500/80`
- Amber (pending): `text-amber-400`

### Spacing
- Container: `p-4` (1rem)
- Sections gap: `space-y-3` (0.75rem)
- Image gap: `gap-1.5` (0.375rem)
- Buttons gap: `gap-2` (0.5rem)

### Borders
- Cards: `rounded-2xl`
- Buttons: `rounded-2xl` (big) or `rounded-xl` (small)
- Border color: `border-white/10`

### Text
- Title: `text-sm font-semibold`
- Meta: `text-xs text-zinc-400`
- Tiny: `text-[10px]`

---

## Import Patterns

### From lucide-react
```typescript
import { GripVertical, Layers, ImageIcon, Copy, Plus, Trash2, Play, Download, CheckCircle, XCircle, ArrowLeft, SlidersHorizontal } from "lucide-react"
```

### From Next.js
```typescript
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
```

### From dnd-kit
```typescript
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
```

### From React
```typescript
import { useState, useTransition, useEffect, useId, useActionState } from "react"
```

---

## Common Patterns

### Drag-Drop Setup
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  
  const oldIndex = sections.findIndex(s => s.id === active.id)
  const newIndex = sections.findIndex(s => s.id === over.id)
  const newSections = arrayMove(sections, oldIndex, newIndex)
  
  setSections(newSections)
  startTransition(async () => {
    await reorderSections(projectId, newSections.map(s => s.id))
  })
}
```

### Server Action Button
```typescript
const [isPending, startTransition] = useTransition()

function handleClick() {
  startTransition(async () => {
    await someServerAction(id)
  })
}

return (
  <button 
    disabled={isPending}
    onClick={handleClick}
    className="..."
  >
    {isPending ? "Loading..." : "Action"}
  </button>
)
```

### Responsive Conditional
```typescript
// Desktop: visible
<div className="hidden items-center gap-2 sm:flex">
  {/* content */}
</div>

// Mobile: visible
<div className="flex items-center gap-2 sm:hidden">
  {/* content */}
</div>
```

---

## Debugging Checklist

- [ ] Is data being fetched in `getProjectDetail()`?
- [ ] Are sections passed correctly to SectionList?
- [ ] Does DndContext have unique `id` prop?
- [ ] Are sections in SortableContext?
- [ ] Is `useSortable()` hook used in card component?
- [ ] Is server action `reorderSections()` defined in `src/lib/actions`?
- [ ] Are images loading with `toImageUrl()` helper?
- [ ] Is styling using Tailwind dark theme variables?

---

## Performance Notes

**Good**:
- Optimistic UI updates (no wait for server)
- Only 8 images shown per section (not full gallery)
- DnD kit's efficient memoization

**To Improve**:
- Could paginate images for sections with many runs
- Could virtualize if section list becomes very long (100+)
- Could lazy-load section data on scroll

---

## Key Learnings

1. **Drag-drop**: Use dnd-kit with `verticalListSortingStrategy`
2. **Optimistic updates**: Update state immediately, sync server in background
3. **Responsive**: Use `sm:flex` / `sm:hidden` for breakpoints
4. **Colors**: Semi-transparent white/colored overlays for dark theme
5. **Links**: All navigation uses Next.js `<Link>` component
6. **Server actions**: Called via `startTransition()` for async ops
7. **Images**: Limited preview (8), full gallery accessible via link
8. **Status**: Display as text, color via badge class


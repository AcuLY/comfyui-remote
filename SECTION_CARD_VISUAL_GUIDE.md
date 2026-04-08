# Section Card (小节) - Visual & Component Guide

## Visual Layout of One Section Card

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                               ┃
┃  📌 Drag Handle                    [Copy Button]  [Delete]  ┃ ← Desktop
┃                                                               ┃    only
┃  1. Photography Studio             正 2 · 负 3               ┃
┃     batch 4 · 1.77:1 · fixed · done                          ┃
┃                                                               ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  🖼️  Latest Results · 8 张            [View All]             ┃
┃                                                               ┃
┃  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌──┐ ┃
┃  │img1│  │img2│  │img3│  │img4│  │img5│  │img6│  │img7│  │+1│ ┃
┃  │[✓]│  │    │  │    │  │    │  │(!) │  │    │  │    │  │  │ ┃
┃  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘  └──┘ ┃
┃    kept   ─────────────────────────────  pending(1)        +1   ┃
┃                                                               ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                               ┃
┃  [▶ Run This Section] [v ▼] [Copy] [Delete]                 ┃ ← Mobile
┃                                                               ┃    only
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Component Hierarchy

```
SectionList (Client Component)
  ├─ DndContext
  └─ SortableContext
      └─ SortableSectionCard (per section)
          ├─ useSortable() hook
          ├─ Main Container (draggable)
          │   ├─ Drag Handle Button
          │   ├─ Section Info Link
          │   │   ├─ Title & Index
          │   │   ├─ Prompt Block Badge
          │   │   └─ Metadata Row
          │   └─ Desktop Action Buttons
          │       ├─ CopySectionButton
          │       └─ DeleteSectionButton
          ├─ Image Gallery Section
          │   ├─ Section Header (if images exist)
          │   ├─ Horizontal Scroll Container
          │   │   └─ Image Thumbnail (x8 max)
          │   └─ "+N more" Indicator
          └─ Actions Footer
              ├─ SectionRunButton
              └─ Mobile Action Buttons
                  ├─ CopySectionButton
                  └─ DeleteSectionButton
```

---

## Key Measurements (Tailwind Classes)

### Container
- **Padding**: `p-4` = 1rem
- **Border radius**: `rounded-2xl` = 1rem
- **Gap between sections**: `space-y-3` = 0.75rem

### Header Area
- **Gap**: `gap-3` = 0.75rem
- **Icons**: `size-4` or `size-3.5` = 16px or 14px
- **Flex wrap**: `flex-wrap` for responsiveness

### Image Gallery
- **Gap between images**: `gap-1.5` = 0.375rem
- **Image size**: `w-[56px] h-[80px]` (portrait thumbnails)
- **Thumbnail scroll container**: `overflow-x-auto scrollbar-none`

### Buttons
- **Rounded**: 
  - Primary/Run: `rounded-2xl` = 1rem
  - Secondary/Actions: `rounded-xl` = 0.5rem
- **Padding**:
  - Primary/Run: `px-4 py-3` = 1rem x 0.75rem
  - Secondary: `px-3 py-2` = 0.75rem x 0.5rem
- **Text size**:
  - Primary: `text-sm`
  - Secondary: `text-xs`

---

## Color Palette

### Backgrounds
| Element | Class | Color | Hex |
|---------|-------|-------|-----|
| Card base | `bg-white/[0.03]` | Very light white | Semi-transparent |
| Button hover | `hover:bg-white/[0.08]` | Light white | Semi-transparent |
| Drag state | `bg-white/[0.05]` | Light white | Semi-transparent |
| Run button | `bg-sky-500/10` | Light blue | Semi-transparent |
| Delete hover | `hover:bg-rose-500/10` | Light red | Semi-transparent |

### Borders
| Element | Class | Color | Hex |
|---------|-------|-------|-----|
| Card border | `border-white/10` | Light border | Semi-transparent |
| Drag state ring | `ring-2 ring-sky-500/30` | Blue ring | Semi-transparent |
| Run button | `border-sky-500/20` | Light blue | Semi-transparent |
| Delete hover | `hover:border-rose-500/20` | Light red | Semi-transparent |

### Text
| Element | Class | Color | Hex |
|---------|-------|-------|-----|
| Section name | `text-white` | White | #f4f4f5 |
| Subtitle/meta | `text-zinc-400` | Medium gray | #a1a1aa |
| Small text | `text-zinc-500` | Dark gray | #71717a |
| Run button | `text-sky-300` | Light blue | #7dd3fc |
| Kept image | `text-emerald-300` | Light green | #6ee7b7 |

### Image Status Badges
| Status | Badge Class | Color | Location |
|--------|-------------|-------|----------|
| Kept | `bg-emerald-500/80` | Green | Bottom of image |
| Trashed | `opacity-40` | Dimmed | Entire image |
| Pending | `text-amber-400` | Amber | Counter badge |

---

## Responsive Breakpoints

### Desktop (≥ 640px / `sm` breakpoint)
- Copy/Delete buttons visible in header: `sm:flex`
- Drag handle visible: always visible
- Full layout: all elements shown
- Button size: normal (`px-3 py-2`)

### Mobile (< 640px)
- Copy/Delete buttons hidden from header: `hidden sm:flex`
- Copy/Delete buttons shown in footer: `sm:hidden`
- Drag handle visible: always visible
- Footer buttons moved to bottom action area
- Wrapping allowed for button layout

---

## State Indicators

### Visual Feedback During Drag
```
Before drag:     During drag:           After drop:
Normal opacity   Dragging item:         Normal opacity
                 - shadow-lg            
                 - ring-2 ring-sky-500/30
                 - zIndex: 50
                 
                 Other items:
                 - opacity-60
```

### Run Status Display
| Status | Display Text | Style | Icon |
|--------|--------------|-------|------|
| Done | "done" | Normal | — |
| Running | "running" | Normal | — |
| Failed | "failed" | Normal | — |
| Not run | "未运行" | `text-zinc-400` | — |

### Prompt Block Badge
```
正 2 · 负 3
├─ "正" = Positive prompt blocks (2)
├─ "·" = Separator
└─ "负" = Negative prompt blocks (3)

Style: 
- `rounded-full` pill shape
- `border border-white/10`
- `px-2 py-0.5` compact padding
- `text-[10px]` tiny text
- `text-zinc-400` muted color
```

---

## Typography

### Text Sizes
| Use | Class | Size | Line Height |
|-----|-------|------|------------|
| Section name | `text-sm font-semibold` | 0.875rem | 1.25rem |
| Metadata | `text-xs` | 0.75rem | 1rem |
| Button text | `text-xs` or `text-sm` | 0.75-0.875rem | 1rem |
| Badge text | `text-[10px]` | 0.625rem | 1rem |

---

## Spacing Reference

### Within Section Card
```
Header row:
  Grip handle (button)
    └─ p-1 (inner padding)
    └─ hover:bg-white/10
  
  Section info (Link)
    └─ flex-1 (flex grow)
    └─ min-w-0 (prevent overflow)
  
  Desktop buttons (gap-2)
    ├─ CopyButton
    └─ DeleteButton

Dividers:
  - border-t border-white/5
  - pt-3 / mt-3 (padding/margin top)

Image gallery:
  - gap-1.5 between thumbnails
  - mt-3 / pt-3 above gallery header

Footer buttons:
  - mt-3 / pt-3 (spacing from image gallery)
  - gap-2 between buttons
```

---

## Key Interaction Points

### Clickable Elements
1. **Drag handle**: Initiates drag (8px activation distance)
2. **Section info area**: Navigate to `/projects/{projectId}/sections/{sectionId}/blocks`
3. **Copy button**: Duplicate section
4. **Delete button**: Delete with confirmation
5. **Image thumbnail**: Navigate to `/queue/{runId}`
6. **"View All" link**: Navigate to `/projects/{projectId}/sections/{sectionId}/results`
7. **"Run This Section"**: Execute generation with batch size control

### Hover States
- All buttons: Background color intensifies
- Drag handle: `hover:bg-white/10 hover:text-zinc-300`
- Section info link: Cursor pointer (implicit via `<Link>`)
- Delete button: `hover:border-rose-500/20 hover:bg-rose-500/10`

---

## Accessibility Features

### Semantic HTML
- `<button>` for all interactive elements
- `<Link>` from Next.js for navigation
- `<section>` wrapper from SectionCard
- Proper heading hierarchy

### Aria & Labels
- Drag handle: Tactile feedback (grab cursor)
- Delete: Confirmation dialog before action
- Images: `alt=""` (decorative)

### Keyboard Support
- Drag & drop: Arrow keys via `KeyboardSensor`
- Tab navigation: Full keyboard accessible
- Button focus: Ring styles for visibility

---

## Animation/Transition Classes Used

### DnD Kit Transformations
- CSS transform via `CSS.Transform.toString(transform)`
- Transition applied: `transition` CSS class
- Smooth position updates during drag

### Button Transitions
- `transition` class on all buttons
- Smooth color/background changes
- No explicitly set `duration` (uses default 150ms)

---

## File-Specific Implementation Details

### section-list.tsx Key Hooks
```typescript
const [sections, setSections] = useState(initialSections)
const [isPending, startTransition] = useTransition()
const dndId = useId()

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: section.id
})

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 50 : undefined,
}
```

### Server Actions Called
- `reorderSections(projectId, sectionIds)` - Update sort order
- `runSection(sectionId, batchSize)` - Execute section
- `copySection(sectionId)` - Duplicate section
- `deleteSection(sectionId)` - Remove section


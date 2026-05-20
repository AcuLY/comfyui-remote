# Drag-and-Drop Implementation Analysis

## 1. DEPENDENCIES & LIBRARY STATUS

**✅ Already Installed:**
- `@dnd-kit/core`: v6.3.1
- `@dnd-kit/sortable`: v10.0.0
- `@dnd-kit/utilities`: v3.2.2

**Status**: Fully available, no installation needed.

---

## 2. COMPONENTS WITH DRAG HANDLES

### Design Demos (Visual Layer)
Located in `/src/app/design-demos/shared/patterns/index.tsx`:

#### **UnitRowShell**
- **Props**: 
  - `dragHandle?: React.ReactNode` - The handle content (icon)
  - `dragHandleClassName?: string` - CSS class for the handle container
- **Usage**: Wraps any content as a draggable handle. Used by:
  - `FolderRow` (category-form-page.tsx)
  - LoRA editor rows (editor-lora-history.tsx)
  - Template section rows (template-form-page.tsx)
- **Styling**: `.unitDrag` container with `.dragButton` cursor

#### **SortableRowShell**
- **Props**:
  - `index: number` - Row number (padded to 2 digits)
  - `marker?: React.ReactNode` - Optional marker element
  - Renders a `<GripVertical>` icon directly (hardcoded)
- **Status**: Display-only, no actual drag logic
- **Styling**: `.sortableRow` grid with gap and padding

#### **FolderRow**
- **Props**:
  - `showDragHandle?: boolean` (default: true)
  - `dragHandleClassName?: string`
  - Renders `GripVertical` icon in a `.dragButton` Button
- **Status**: Visual only, no DnD integration

---

## 3. PRODUCTION DND-KIT IMPLEMENTATIONS

### Real-World Usage (Full Stack)

#### A. **Project Folders** (`/src/app/projects/projects-client.tsx`)

**Pattern**:
```tsx
<DndContext
  id={folderDndId}
  sensors={folderSensors}
  collisionDetection={closestCenter}
  onDragEnd={handleFolderDragEnd}
>
  <SortableContext items={visibleFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
    {visibleFolders.map(folder => (
      <SortableFolderRow {...props} />
    ))}
  </SortableContext>
</DndContext>
```

**Sensors**:
- `PointerSensor` with `activationConstraint: { distance: 8 }`
- `KeyboardSensor` with `sortableKeyboardCoordinates`

**Collision Detection**: `closestCenter`

**Handle DragEnd**:
```tsx
function handleFolderDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = visibleFolders.findIndex(f => f.id === active.id);
  const newIndex = visibleFolders.findIndex(f => f.id === over.id);
  const reordered = arrayMove(visibleFolders, oldIndex, newIndex);
  // Persist to DB...
  await reorderProjectFolders(currentFolderId, reordered.map(f => f.id));
}
```

---

#### B. **Project Sections** (`/src/app/projects/[projectId]/section-cards.tsx`)

**Pattern**:
```tsx
<DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={sections.map(s => s.id)} strategy={rectSortingStrategy}>
    <div className="grid...">
      {sections.map(section =>
        <SortableCompactCard key={section.id} section={section} />
      )}
    </div>
  </SortableContext>
</DndContext>
```

**Sortable Item Hook**:
```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 50 : undefined,
};

return (
  <div ref={setNodeRef} style={style} className={isDragging ? "ring-2 ring-sky-500/30" : ""}>
    {/* Content */}
  </div>
);
```

**Drag Handle Button**:
```tsx
<button
  {...attributes}
  {...listeners}
  className="cursor-grab touch-none active:cursor-grabbing"
>
  <GripVertical className="size-3.5" />
</button>
```

**Strategy**: `rectSortingStrategy` (grid layout)

---

#### C. **Preset Groups** (`/src/app/assets/presets/group-list.tsx`)

**Pattern**:
```tsx
<DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupDragEnd}>
  <SortableContext items={visibleGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
    {visibleGroups.map(group => (
      <SortableGroupCard key={group.id} group={group} />
    ))}
  </SortableContext>
</DndContext>
```

**Within SortableGroupCard**: Nested `DndContext` for group members:
```tsx
<DndContext id={memberDndId} sensors={memberSensors} collisionDetection={closestCenter} onDragEnd={handleMemberDragEnd}>
  <SortableContext items={members.map(m => m.id)} strategy={verticalListSortingStrategy}>
    {members.map(m => (
      <SortableGroupMemberItem key={m.id} member={m} />
    ))}
  </SortableContext>
</DndContext>
```

**Two Levels of Dragging**: Groups + Members within groups

---

#### D. **Preset Folders** (Within group-list.tsx)

**Pattern**: Separate `DndContext` for folders:
```tsx
const folderDndId = useId();
const folderSensors = useSensors(...);

<DndContext
  id={folderDndId}
  sensors={folderSensors}
  collisionDetection={closestCenter}
  onDragEnd={handleFolderDragEnd}
>
  <SortableContext items={visibleFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
    <div className="grid...">
      {visibleFolders.map(folder => (
        <SortableFolderRow key={folder.id} folder={folder} />
      ))}
    </div>
  </SortableContext>
</DndContext>
```

---

## 4. SORTABLE COMPONENT IMPLEMENTATIONS

### SortableFolderRow (`/src/app/assets/presets/folder-components.tsx`)

```tsx
export function SortableFolderRow(props: {
  folder: FolderItem;
  itemCount: number;
  onEnter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.folder.id,
  });
  
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 w-full">
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-zinc-600 hover:text-zinc-400 shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3" />
      </button>
      <div className="flex-1 min-w-0 overflow-hidden">
        <FolderRow {...props} />
      </div>
    </div>
  );
}
```

**Key Pattern**:
1. `useSortable({ id })` hook
2. `setNodeRef` on wrapper div
3. `style` with `CSS.Transform.toString()` for animation
4. `{...attributes, ...listeners}` on drag handle button
5. Visual feedback with `opacity: isDragging ? 0.5 : 1`

---

### SortableGroupCard & SortableGroupMemberItem

**SortableGroupCard**:
- Wraps entire card with `setNodeRef` and transform style
- Handle button with `{...attributes, ...listeners}`
- Contains nested `DndContext` for members

**SortableGroupMemberItem**:
- Similar pattern: wraps div with `setNodeRef`
- Handle with `{...attributes, ...listeners}`
- Drag state affects opacity

---

### SortableCompactCard (Section Cards)

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: section.id,
});

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 50 : undefined, // Grid z-index for layering
};

return (
  <div
    ref={setNodeRef}
    style={style}
    className={isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""}
  >
    {/* Selection checkbox */}
    <button {...attributes} {...listeners} className="cursor-grab">
      <GripVertical className="size-3.5" />
    </button>
    {/* Content */}
  </div>
);
```

---

## 5. CSS PATTERNS

### Design Demos Styles (patterns.module.css)

```css
.dragButton:where([data-demo-ui-button="true"]) {
  cursor: grab;
}

.unitRow {
  display: grid;
  grid-template-columns: var(--unit-row-columns, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--demo-border);
  border-radius: 12px;
}

.unitDrag {
  min-width: 0;
}

.sortableRow {
  display: grid;
  grid-template-columns: var(--sortable-row-columns, auto auto minmax(0, 1fr));
  gap: 10px;
  padding: 10px 12px;
}
```

### Production Styles (Tailwind)

```tsx
// Grab cursor
className="cursor-grab touch-none active:cursor-grabbing"

// Drag state
className={isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""}

// Opacity during drag
opacity: isDragging ? 0.5 : 1

// Z-index for stacking
zIndex: isDragging ? 50 : undefined
```

---

## 6. MISSING INTEGRATIONS IN DESIGN DEMOS

### Status: Visual Components Only (No Actual DnD)

The design-demos `/features/` and `/shared/` directories contain:
- ✅ `SortableRowShell` - Display pattern
- ✅ `UnitRowShell` with drag handle - Display pattern
- ✅ `FolderRow` with drag handle - Display pattern
- ❌ **No actual `DndContext` setup**
- ❌ **No `useSortable` hooks**
- ❌ **No `@dnd-kit` integration**

These are **visual mockups only**. The real DnD logic lives in:
- `/src/app/projects/`
- `/src/app/assets/presets/`

---

## 7. COMPONENTS USING DRAG HANDLES (Design Demos)

| File | Component | Handle Type | Props |
|------|-----------|------------|-------|
| `category-form-page.tsx` | `UnitRowShell` | `GripVertical` icon | `dragHandle`, `dragHandleClassName` |
| `editor-lora-history.tsx` | `LoraRow` | `GripVertical` button | Hardcoded, no props |
| `template-form-page.tsx` | `TemplateSectionRow` | Referenced in list | Visual only |
| `template-section-page.tsx` | Template prompt blocks | `GripVertical` button | `className={s.dragHandle}` |

---

## 8. ARCHITECTURE OBSERVATIONS

### Two-Layer Architecture

**Layer 1: Design Demos** (`/design-demos/`)
- Purpose: UI component showcase
- Status: Visual patterns only
- Used by: Stakeholders viewing component library
- DnD Integration: None

**Layer 2: Production** (`/projects/`, `/assets/`)
- Purpose: Real application
- Status: Full DnD-kit integration
- Used by: End users
- DnD Integration: Complete with DB persistence

### Design Demos Limitation

The design-demos are **read-only showcases** of components. They:
- Display `GripVertical` icons
- Show grid layouts with drag areas
- But do NOT implement actual dragging

To add DnD to design-demos, you would need to:
1. Wrap the showcased components in `DndContext`
2. Implement `useSortable` hooks
3. Add state management for reordering
4. Connect to API endpoints for persistence

---

## 9. KEY PATTERNS FOR IMPLEMENTATION

### Minimal DnD Setup

```tsx
import { DndContext, closestCenter, useSensor, useSensors, PointerSensor, KeyboardSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 1. Sensors
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

// 2. Context
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
    {items.map(item => <SortableItem key={item.id} item={item} />)}
  </SortableContext>
</DndContext>

// 3. Item Component
function SortableItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button {...attributes} {...listeners}><GripVertical /></button>
      {/* Content */}
    </div>
  );
}

// 4. Handle Drag End
function handleDragEnd(event) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = items.findIndex(i => i.id === active.id);
  const newIndex = items.findIndex(i => i.id === over.id);
  setItems(arrayMove(items, oldIndex, newIndex));
  // Persist...
}
```

---

## 10. IMAGE MUTATION & RESULTS PANEL

### ReviewImageBoard (`/src/app/design-demos/shared/media/review-image-board/index.tsx`)

**Component**: Display-only image gallery with selection
- Renders `ImageListMedium` with action buttons
- Supports image selection via checkbox
- Shows status overlay (kept/trashed)
- Actions: Keep, Delete, Featured, Preview, Cover, Undo

**Status**: No mutations implemented (button callbacks are empty)

```tsx
<Button tone="primary" icon={Check} className={s.reviewActionKeep} feedback={{...}}>
  {hasSelection ? "保留" : "全部保留"}
</Button>
// No onClick handler
```

### ResultsPanel (`/src/app/design-demos/features/projects/editor/results-panel.tsx`)

**Component**: Renders filtered image results from runs
- Maps through `editor.runs` → images
- Shows `ImageThumbMedium` with inline action buttons
- Calls `editor.markStatus()`, `editor.toggleFeatured()`, `editor.setLightboxImageId()`

**Status**: Connected to state manager (editor object), but no DnD

---

## SUMMARY

| Aspect | Status | Details |
|--------|--------|---------|
| DnD Library | ✅ Installed | @dnd-kit v6.3.1, sortable v10.0.0 |
| Design Demos | ⚠️ Visual Only | Icons rendered, no logic |
| Production | ✅ Full DnD | Projects, Sections, Presets, Groups all sortable |
| Image Mutations | ⚠️ Partial | ReviewImageBoard has UI, no handlers |
| Results Panel | ⚠️ Connected | State management ready, visual only |
| Drag Handles | ✅ Patterns Set | GripVertical in Button, proper styling |

---

**Next Steps** (if expanding design-demos with DnD):
1. Wrap components in `DndContext`
2. Create sortable versions of demo components
3. Add mock state and handlers
4. Connect to mock API endpoints
5. Display in dedicated "Drag & Drop" showcase page

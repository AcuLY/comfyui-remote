# Drag-and-Drop Component Reference

## File Locations & Component Signatures

### Design Demos Patterns (Visual Only)

#### 1. UnitRowShell
**Location**: `/src/app/design-demos/shared/patterns/index.tsx:28-91`

```tsx
export function UnitRowShell({
  actions,
  actionsClassName,
  body,
  bodyClassName,
  className,
  description,
  descriptionClassName,
  dragHandle,              // 👈 Pass your drag handle here
  dragHandleClassName,     // 👈 CSS class for handle container
  leading,
  leadingClassName,
  mainClassName,
  media,
  mediaClassName,
  meta,
  metaClassName,
  selected = false,
  title,
  titleClassName,
}: {
  actions?: React.ReactNode;
  actionsClassName?: string;
  body?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  dragHandle?: React.ReactNode;
  dragHandleClassName?: string;
  leading?: React.ReactNode;
  leadingClassName?: string;
  mainClassName?: string;
  media?: React.ReactNode;
  mediaClassName?: string;
  meta?: React.ReactNode;
  metaClassName?: string;
  selected?: boolean;
  title: React.ReactNode;
  titleClassName?: string;
})
```

**How it renders the drag handle**:
```tsx
{dragHandle ? <div className={cx(s.unitDrag, dragHandleClassName)}>{dragHandle}</div> : null}
```

**Usage example** (from `category-form-page.tsx:78-91`):
```tsx
<UnitRowShell
  className={s.slotRow}
  dragHandle={<GripVertical className={s.categoryDragIcon} />}
  dragHandleClassName={s.slotRowHandle}
  key={slot.id}
  mainClassName={s.slotRowMain}
  title={/* ... */}
/>
```

**CSS**: `.unitDrag` in `/src/app/design-demos/shared/patterns/patterns.module.css:54-60`

---

#### 2. SortableRowShell
**Location**: `/src/app/design-demos/shared/patterns/index.tsx:392-421`

```tsx
export function SortableRowShell({
  children,
  className,
  contentClassName,
  handleClassName,
  index,                // 👈 Row index (0-based, padded to 2 digits)
  indexClassName,
  marker,
  markerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  handleClassName?: string;
  index: number;
  indexClassName?: string;
  marker?: React.ReactNode;
  markerClassName?: string;
})
```

**Renders**:
- `GripVertical` icon (hardcoded)
- Index number (padded: "01", "02", etc.)
- Optional marker
- Content

**No props for drag handle** - it's always rendered as an icon.

---

#### 3. FolderRow
**Location**: `/src/app/design-demos/shared/patterns/index.tsx:232-275`

```tsx
export function FolderRow({
  actions,
  actionsClassName,
  countLabel,
  className,
  countClassName,
  dragHandleClassName,     // 👈 CSS class for the drag button
  iconClassName,
  leadingIcon: LeadingIcon = Folder,
  name,
  nameClassName,
  onOpen,
  openClassName,
  showChevron = true,
  showDragHandle = true,   // 👈 Toggle visibility
}: {
  // ... properties
})
```

**Drag handle rendering**:
```tsx
{showDragHandle ? 
  <Button 
    className={cx(s.dragButton, dragHandleClassName)} 
    tone="subtle" 
    icon={GripVertical} 
    iconOnly 
    ariaLabel="排序手柄" 
  /> 
  : null
}
```

---

### Production Full DnD Implementations

#### 4. Project Folders (Full Stack)
**Location**: `/src/app/projects/projects-client.tsx:225-267`

**Components Used**:
- `DndContext` - wraps entire list
- `SortableContext` - provides sortable items
- `SortableFolderRow` - individual draggable item

**Setup**:
```tsx
const folderSensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);

<DndContext
  id={folderDndId}
  sensors={folderSensors}
  collisionDetection={closestCenter}
  onDragEnd={handleFolderDragEnd}
>
  <SortableContext 
    items={visibleFolders.map(f => f.id)} 
    strategy={verticalListSortingStrategy}
  >
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {visibleFolders.map(folder => (
        <SortableFolderRow
          key={folder.id}
          folder={folder}
          itemCount={countFolderItems(...)}
          onEnter={() => navigateFolder(folder.id)}
          onRename={(name) => { /* ... */ }}
          onDelete={() => { /* ... */ }}
          isPending={isPending}
        />
      ))}
    </div>
  </SortableContext>
</DndContext>
```

**Drag end handler**:
```tsx
function handleFolderDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = visibleFolders.findIndex(f => f.id === active.id);
  const newIndex = visibleFolders.findIndex(f => f.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;
  const reordered = arrayMove(visibleFolders, oldIndex, newIndex);
  startTransition(async () => {
    try {
      await reorderProjectFolders(currentFolderId, reordered.map(f => f.id));
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "排序失败");
    }
  });
}
```

---

#### 5. Section Cards (Grid Layout with Nested Content)
**Location**: `/src/app/projects/[projectId]/section-cards.tsx:225-264`

**Strategy**: `rectSortingStrategy` (for grid layouts instead of vertical lists)

```tsx
<DndContext 
  id={dndId} 
  sensors={sensors} 
  collisionDetection={closestCenter} 
  onDragEnd={handleDragEnd}
>
  <SortableContext 
    items={sections.map(s => s.id)} 
    strategy={rectSortingStrategy}
  >
    <div className="grid grid-cols-1 gap-1.5 justify-items-center md:grid-cols-2">
      {sections.map(section =>
        <SortableCompactCard
          key={section.id}
          section={section}
          projectId={projectId}
          isSelected={selectedIds.has(section.id)}
          onToggleSelect={toggleSelect}
          // ...
        />
      )}
    </div>
  </SortableContext>
</DndContext>
```

**Sortable Component** (within `SortableCompactCard`):
```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: section.id,
});

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 50 : undefined,
};

return (
  <div
    ref={setNodeRef}
    style={style}
    id={`section-${section.id}`}
    className={`group flex items-center gap-2 w-full rounded-xl border bg-white/[0.03] px-3 py-2.5 md:max-w-[500px] ${
      isDragging ? "shadow-lg ring-2 ring-sky-500/30" : ""
    } ${isSelected ? "border-sky-500/40 ring-1 ring-sky-500/20" : "border-white/10"}`}
  >
    {/* Checkbox */}
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleSelect(section.id);
      }}
      className="shrink-0 rounded p-0.5 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-400"
    >
      {isSelected ? (
        <CheckSquare className="size-3.5 text-sky-400" />
      ) : (
        <Square className="size-3.5" />
      )}
    </button>

    {/* 👇 Drag handle button */}
    <button
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none rounded p-0.5 text-zinc-600 transition hover:bg-white/10 hover:text-zinc-400 active:cursor-grabbing"
    >
      <GripVertical className="size-3.5" />
    </button>

    {/* Rest of card */}
  </div>
);
```

---

#### 6. Preset Groups with Nested Members
**Location**: `/src/app/assets/presets/group-list.tsx:162-179` (groups)
**Location**: `/src/app/assets/presets/sortable-group-card.tsx:138-148` (members)

**Pattern**: Two separate `DndContext` instances
- Outer: for dragging groups
- Inner: for dragging members within a group

**Groups level**:
```tsx
function handleGroupDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const items = visibleGroups;
  const oldIndex = items.findIndex(g => g.id === active.id);
  const newIndex = items.findIndex(g => g.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;
  const reordered = arrayMove(items, oldIndex, newIndex);
  const otherGroups = groups.filter(g => (g.folderId ?? null) !== currentFolderId);
  setLocalGroups({
    categoryId: category.id,
    sourceGroups: category.groups,
    groups: [...otherGroups, ...reordered],
  });
  startTransition(async () => {
    await reorderPresetGroups(category.id, reordered.map(g => g.id));
  });
}
```

**Members level** (within `SortableGroupCard`):
```tsx
function handleMemberDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = members.findIndex(m => m.id === active.id);
  const newIndex = members.findIndex(m => m.id === over.id);
  const reordered = arrayMove(members, oldIndex, newIndex);
  setLocalMembers({ sourceMembers: group.members, members: reordered });
  startTransition(async () => {
    await reorderGroupMembers(group.id, reordered.map(m => m.id));
  });
}
```

---

#### 7. SortableFolderRow (Base Implementation)
**Location**: `/src/app/assets/presets/folder-components.tsx:130-160`

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

**Key elements**:
1. `useSortable({ id: props.folder.id })` - makes it sortable
2. `setNodeRef` - registers element with dnd-kit
3. `transform: CSS.Transform.toString(transform)` - applies drag animation
4. `{...attributes, ...listeners}` - enables drag functionality on button
5. Opacity change on `isDragging` for visual feedback

---

### Image Components (No DnD, but relevant for mutation)

#### 8. ReviewImageBoard (Selection Only)
**Location**: `/src/app/design-demos/shared/media/review-image-board/index.tsx:14-131`

**Status**: No DnD, has selection state
- `setSelectedIds`: Track selected images
- `toggleImage()`: Toggle selection
- `actionPanel`: Buttons with empty onClick handlers

```tsx
<Button
  tone="primary"
  icon={Check}
  className={s.reviewActionKeep}
  feedback={{ title: "已加入保留队列", detail: `${actionTargetCount} 张图片` }}
>
  {hasSelection ? "保留" : "全部保留"}
</Button>
// No onClick - buttons don't do anything yet
```

---

#### 9. ResultsPanel (State Connected, No DnD)
**Location**: `/src/app/design-demos/features/projects/editor/results-panel.tsx:11-152`

**Status**: Connected to editor state, no DnD

**Props**: 
- `editor: SectionEditorModel` - state object

**Editor methods called**:
- `editor.markStatus(imageId, status)` - Mark as kept/trashed
- `editor.toggleFeatured(imageId)` - Toggle featured flag
- `editor.setLightboxImageId(imageId)` - Open lightbox
- `editor.setResultsFilter(filter)` - Filter tabs
- `editor.bulkStatusForRun(runIndex, status)` - Bulk actions

---

## CSS Classes Reference

### Design Demos (Module CSS)

| Class | Purpose | Location |
|-------|---------|----------|
| `.unitDrag` | Drag handle container | `patterns.module.css:54-60` |
| `.dragButton` | Cursor on drag button | `patterns.module.css:260-262` |
| `.sortableRow` | Sortable row layout | `patterns.module.css:327-346` |
| `.sortableMarker` | Optional row marker | `patterns.module.css:343-346` |
| `.unitRow` | Main row container | `patterns.module.css:33-47` |

### Production (Tailwind)

```tsx
// Grab cursor
"cursor-grab touch-none"

// Dragging state
"active:cursor-grabbing"

// Visual feedback
"shadow-lg ring-2 ring-sky-500/30"
"opacity: isDragging ? 0.5 : 1"

// Grid layout
"grid grid-cols-1 gap-2 sm:grid-cols-2"
```

---

## Import Paths

```tsx
// Core DnD
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  type DragEndEvent 
} from "@dnd-kit/core";

// Sortable utilities
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable 
} from "@dnd-kit/sortable";

// CSS transform utilities
import { CSS } from "@dnd-kit/utilities";

// Icons
import { GripVertical, CheckSquare, Square } from "lucide-react";

// Design demos
import { UnitRowShell, SortableRowShell, FolderRow } from "@/app/design-demos/shared/patterns";

// Production components
import { SortableFolderRow } from "@/app/assets/presets/folder-components";
import { SortableGroupCard } from "@/app/assets/presets/sortable-group-card";
```

---

## Common Patterns Summary

### 1. Setup Sensors
```tsx
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

### 2. Wrap with DndContext
```tsx
<DndContext 
  id={uniqueId}
  sensors={sensors} 
  collisionDetection={closestCenter} 
  onDragEnd={handleDragEnd}
>
  <SortableContext items={ids} strategy={strategy}>
    {/* Items */}
  </SortableContext>
</DndContext>
```

### 3. Create Sortable Item
```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

return (
  <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <button {...attributes} {...listeners}><GripVertical /></button>
    {/* Content */}
  </div>
);
```

### 4. Handle Drag End
```tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const oldIndex = items.findIndex(i => i.id === active.id);
  const newIndex = items.findIndex(i => i.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;
  setItems(arrayMove(items, oldIndex, newIndex));
  // Persist to DB...
}
```

---

## Useful Utilities

### arrayMove
```tsx
import { arrayMove } from "@dnd-kit/sortable";
const reordered = arrayMove(array, fromIndex, toIndex);
```

### CSS.Transform
```tsx
import { CSS } from "@dnd-kit/utilities";
const transform = CSS.Transform.toString(dndkitTransform);
```

### sortableKeyboardCoordinates
```tsx
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
```


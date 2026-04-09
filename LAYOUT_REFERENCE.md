# Layout Hierarchy & Container Nesting

## Page-Level Structure (All Main Pages)

```
<div className="space-y-4">                    ← Page root (16px vertical gaps)
  {/* Possible header/nav */}
  
  <SectionCard>                               ← Reusable card component
    <div className="space-y-3">               ← Card content (12px gaps)
      {/* Items, lists, etc */}
    </div>
  </SectionCard>
</div>
```

---

## Project List Page Layout Example

```tsx
// File: src/app/projects/page.tsx

<div className="space-y-4">
  ├─ <div className="flex items-center justify-between">
  │  └─ <Link> Create Project Button
  │
  └─ <SectionCard title="项目" subtitle="...">
     └─ <div className="space-y-3">
        ├─ <Link className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        │  ├─ <div className="flex items-start justify-between gap-3">
        │  │  ├─ <div className="min-w-0 flex-1">
        │  │  │  ├─ Project title
        │  │  │  └─ Preset names
        │  │  └─ <div className="flex shrink-0 items-center gap-2">
        │  │     ├─ Status badge
        │  │     └─ ChevronRight icon
        │  │
        │  └─ Metadata (updated date, section count)
        │
        └─ [More project items...]
```

**Key Classes:**
- `p-4` = 16px padding on entire card
- `gap-3` = 12px between title and actions
- `space-y-3` = 12px between projects

---

## Section List (Cards) - Expanded View

```tsx
// File: src/app/projects/[projectId]/section-list.tsx

<div className={`${compact ? "space-y-1.5" : "space-y-3"}`}>
  ├─ <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  │  │
  │  ├─ <div className="flex items-start gap-3">
  │  │  ├─ <button className="cursor-grab ...">
  │  │  │  └─ GripVertical icon
  │  │  │
  │  │  ├─ <Link className="min-w-0 flex-1">
  │  │  │  ├─ <div className="flex flex-wrap items-center gap-2">
  │  │  │  │  ├─ Section name
  │  │  │  │  └─ Prompt badge
  │  │  │  │
  │  │  │  └─ Config info (batch, aspect, seed, status)
  │  │  │
  │  │  └─ <div className="hidden items-center gap-2 sm:flex">
  │  │     ├─ Copy button
  │  │     └─ Delete button
  │  │
  │  ├─ <div className="mt-3 border-t border-white/5 pt-3">
  │  │  │ (Results Preview Section)
  │  │  │
  │  │  ├─ <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
  │  │  │  ├─ <Image width={56} height={80} className="h-[80px] w-[56px]">
  │  │  │  ├─ <Image ...>
  │  │  │  └─ "+N more" indicator
  │  │  │
  │  │  └─ Result count & link
  │  │
  │  └─ <div className="mt-3 flex flex-wrap ... gap-2 border-t border-white/5 pt-3">
  │     ├─ <SectionRunButton />
  │     └─ Mobile copy/delete buttons
  │
  └─ [More section cards...]

{/* Floating toggle button (if >3 sections) */}
<button className="fixed bottom-6 right-6 z-40 ...">
  Toggle View
</button>
```

**Key Classes:**
- Expanded: `p-4` (16px) + `space-y-3` (12px gaps)
- Compact: `px-3 py-2.5` (12px x, 10px y) + `space-y-1.5` (6px gaps)
- Result thumbnails: `gap-1.5` = 6px between images
- Image size: Fixed `width={56} height={80}`

---

## Section Editor (Preset Bindings)

```tsx
// File: src/components/section-editor.tsx

<div className="space-y-4">
  ├─ <div className="space-y-2">
  │  │ (Imported Presets Section)
  │  │
  │  ├─ <div className="flex items-center justify-between">
  │  │  ├─ <div className="flex items-center gap-2 text-xs text-zinc-400">
  │  │  │  └─ Icon + label + count badge
  │  │  │
  │  │  └─ <button className="inline-flex ... px-2 py-1 ...">
  │  │     └─ "Import Preset" button
  │  │
  │  ├─ <div className="space-y-1">
  │  │  ├─ <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
  │  │  │  ├─ <div className="flex items-center gap-2 min-w-0">
  │  │  │  │  ├─ Category tag (colored)
  │  │  │  │  ├─ Group indicator (if grouped)
  │  │  │  │  ├─ Preset name (truncated)
  │  │  │  │  ├─ Variant selector (dropdown)
  │  │  │  │  └─ Block/LoRA count
  │  │  │  │
  │  │  │  └─ <div className="flex items-center gap-0.5 shrink-0">
  │  │  │     ├─ Rename button
  │  │  │     ├─ Delete (standalone) button
  │  │  │     └─ Delete (cascade) button
  │  │  │
  │  │  └─ [More bindings...]
  │  │
  │  └─ <ImportPresetPanel>  ← Shown conditionally
  │     ├─ <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2">
  │     │  │
  │     │  ├─ <div className="flex items-center justify-between">
  │     │  │  └─ Title + close button
  │     │  │
  │     │  ├─ <div className="flex flex-wrap gap-1">
  │     │  │  └─ Category tabs
  │     │  │
  │     │  ├─ <div className="flex items-center gap-2 ...">
  │     │  │  └─ Search input
  │     │  │
  │     │  └─ <div className="max-h-40 overflow-y-auto space-y-1">
  │     │     ├─ Breadcrumb / back button
  │     │     ├─ Subfolders
  │     │     └─ Preset/Group items
  │     │
  │     └─ </ImportPresetPanel>
  │
  ├─ <PromptBlockEditor />
  │
  └─ <div className="border-t border-white/5 pt-4 space-y-4">
     ├─ <div>
     │  ├─ LoRA 1 label
     │  └─ <LoraListEditor />
     │
     └─ <div>
        ├─ LoRA 2 label
        └─ <LoraListEditor />
```

**Key Classes:**
- Binding card: `px-3 py-1.5` (12px x, 6px y)
- Binding list: `space-y-1` (4px gaps - very compact)
- Import panel: `p-3` (12px padding)
- Import content: `max-h-40` (160px max height, scrollable)
- Category tabs: `gap-1` (4px between tabs)

---

## Section Blocks Editor Page

```tsx
// File: src/app/projects/[projectId]/sections/[sectionId]/blocks/page.tsx

<div className="space-y-4">
  ├─ <div className="flex items-center justify-between gap-3">
  │  ├─ <Link className="inline-flex items-center gap-2 text-sm">
  │  │  └─ Back navigation
  │  │
  │  └─ <div className="flex items-center gap-2 text-zinc-400">
  │     ├─ Layers icon
  │     └─ Block count
  │
  ├─ <SectionCard title="编辑小节" subtitle="...">
  │  └─ <div className="space-y-6">
  │     ├─ <SectionParamsForm />
  │     │  (Batch size, aspect ratio, seed policy, etc)
  │     │
  │     └─ <div className="border-t border-white/5 pt-4">
  │        ├─ <div className="mb-3 text-xs font-medium text-zinc-400">
  │        │  └─ "提示词块 & LoRA" label
  │        │
  │        └─ <SectionEditor {...props} />
  │           (Full preset binding + prompt block + LoRA editor)
  │
  └─ <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
     ├─ <div className="mb-2 text-xs font-medium text-zinc-400">
     │  └─ "Run this section" label
     │
     └─ <SectionRunButton />
```

**Key Classes:**
- Page root: `space-y-4` (16px)
- Editor section: `space-y-6` (24px between params and editor)
- Section separator: `border-t border-white/5 pt-4`
- Run button card: `p-4` (16px)

---

## Prompt Manager Layout

```tsx
// File: src/app/assets/prompts/prompt-manager.tsx

<div className="space-y-4">
  └─ <SectionCard title="预制管理" subtitle="...">
     └─ <div className="flex flex-col gap-4 md:flex-row">
        │  (Mobile: stacked, Desktop: side-by-side)
        │
        ├─ <div className="w-full shrink-0 space-y-2 md:w-56">
        │  │ (Left panel - Categories)
        │  │
        │  ├─ <div className="flex items-center justify-between">
        │  │  ├─ "分类" label (uppercase, small)
        │  │  └─ <div className="flex gap-1">
        │  │     ├─ Settings button
        │  │     └─ Add category button
        │  │
        │  ├─ <DndContext>
        │  │  └─ <SortableContext>
        │  │     └─ <div className="space-y-2">
        │  │        ├─ <SortableCategoryItem>
        │  │        │  (Draggable category rows)
        │  │        └─ [More categories...]
        │  │
        │  └─ <CategoryForm> (Conditional)
        │     (Create/edit category)
        │
        └─ <div className="flex-1">
           (Right panel - Presets/Details)
           
           └─ [Content varies by selection]
```

**Key Classes:**
- Main layout: `flex flex-col gap-4 md:flex-row` (responsive)
- Left panel: `w-full shrink-0 space-y-2 md:w-56` (224px on desktop)
- Category list: `space-y-2` (8px gaps)

---

## Common Component Patterns

### Button
```tsx
// Primary Action Button
className="inline-flex items-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"

// Secondary Button
className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"

// Icon Button
className="rounded p-1 text-zinc-600 hover:bg-sky-500/10 hover:text-sky-400"
```

### Input/Form
```tsx
// Search Input
className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1"

// Variant Dropdown
className="appearance-none rounded border border-white/10 bg-white/[0.04] py-0.5 pl-1.5 pr-5 text-[10px] text-zinc-300 outline-none focus:border-sky-500/30 disabled:opacity-50"
```

### List Item
```tsx
// Compact row
className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"

// Standard row
className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5"
```

### Badge/Tag
```tsx
// Status badge
className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300"

// Category tag
className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium"
// (with inline style for background color)
```

### Empty State
```tsx
className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500"
```

---

## Responsive Breakpoints

### Mobile-First Approach
```tsx
// Example: Prompt Manager
<div className="flex flex-col gap-4 md:flex-row">
  <div className="w-full md:w-56">   {/* Full width mobile, 224px desktop */}
    ...
  </div>
  <div className="flex-1">           {/* Takes remaining space */}
    ...
  </div>
</div>

// Example: Section List Actions
<div className="hidden items-center gap-2 sm:flex">  {/* Hidden mobile, shown desktop */}
  <CopyButton />
  <DeleteButton />
</div>
<div className="flex items-center gap-2 sm:hidden">  {/* Shown mobile, hidden desktop */}
  <CopyButton />
  <DeleteButton />
</div>
```

**Breakpoint Used:** `md:` (768px+)

---

## Summary: Class Naming Patterns

| Element | Pattern | Example |
|---------|---------|---------|
| **Page Container** | `space-y-4` | Main layout |
| **Card Container** | `space-y-3` | Inside SectionCard |
| **List Item** | `space-y-1` to `space-y-2` | Binding rows |
| **Main Card** | `rounded-2xl border border-white/10 bg-white/[0.03] p-4` | Project/Section card |
| **Secondary Element** | `rounded-lg border border-white/5 bg-white/[0.02]` | Binding rows |
| **Accent Button** | `bg-sky-500/10 hover:bg-sky-500/20` | Import actions |
| **Text** | `text-zinc-300` or `text-zinc-500` | Default or muted |
| **Responsive** | `md:flex-row` or `sm:hidden` | Mobile/desktop differences |
| **Disabled** | `disabled:opacity-50` | Pending state |


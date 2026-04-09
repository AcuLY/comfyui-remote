# ComfyUI Remote - Complete Layout Analysis for Responsive Redesign

**Document Date:** 2026-04-09  
**Status:** Planning Phase (No Edits Yet)

---

## 📊 Quick Summary Table

| Page | Current Layout | Main Issue | Desktop Opportunity |
|------|---|---|---|
| `/queue` | Single column, 2-col stat grid | Stats too narrow | 4-column stats, 2-col cards |
| `/queue/[runId]` | 3-col review grid | Fixed columns | 5-6 columns at xl |
| `/queue/[runId]/images/[imageId]` | Full-width image, flex-wrap params | Tight nav buttons | 4-col nav grid |
| `/projects` | Single column list | Takes full width | 2-3 column grid |
| `/projects/[projectId]` | Vertical cards with drag | Single column | 2-col section cards |
| `/projects/[projectId]/blocks` | Tall single column form | Very vertical | Side-by-side layout lg+ |
| `/projects/[projectId]/edit` | Form full-width | Wasteful space | Narrower container |
| `/settings` | 3 vertical cards | Single column | 3-col grid |
| `/assets/*` | Vertical lists | Single column | Multi-column |
| `/trash` | Full-width items | Tiny thumbnails | 2-col with larger images |

---

## 🏗️ Container Structure Overview

### Current Root Layout (AppShell)

```
┌─────────────────────────────────────────┐
│          HEADER (max-w-6xl px-4)        │  ← 1024px max, 16px padding
├─────────────────────────────────────────┤
│                                         │
│   MAIN CONTENT                          │  ← mx-auto max-w-6xl px-4 py-4
│   (Full vertical scroll)                │  ← SINGLE COLUMN LAYOUT
│                                         │
│   └─ SectionCard (max-width: 100%)     │
│   └─ SectionCard (max-width: 100%)     │
│   └─ SectionCard (max-width: 100%)     │
│                                         │
├─────────────────────────────────────────┤
│      NAV (grid grid-cols-6)             │  ← 6 items always
└─────────────────────────────────────────┘

On 1920px desktop: 896px unused space on sides (44% waste!)
```

### Proposed Responsive Widths

```
Mobile (375px)        Tablet (768px)        Desktop (1024px+)     Wide (1440px+)    Ultra (1920px+)
└─ max-w-6xl          └─ max-w-6xl          └─ max-w-7xl          └─ max-w-8xl       └─ max-w-full
   px-4                  px-4                  px-8                  px-12              px-16
   
Layout width:         Layout width:         Layout width:         Layout width:      Layout width:
343px                 704px                 1280px                1440px             1888px
```

---

## 📱 Page-by-Page Detailed Analysis

### 1️⃣ `/queue` - Queue List & Tabs

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ PageHeader (title + description)        │
├─────────────────────────────────────────┤
│ [Pending] [Running] [Failed] [Refresh]  │  Tab bar with flex-1 spacer
├─────────────────────────────────────────┤
│ SectionCard: "队列概览"                  │
│  ┌───────────────────────────────────┐  │
│  │ Stat 1    │ Stat 2                │  │ grid-cols-2
│  │           │                       │  │ (wasted space on desktop)
│  └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│ SectionCard: "最新结果组"                │
│  Run Card 1 (full width)                │
│  Run Card 2 (full width)                │ All stacked vertically
│  Run Card 3 (full width)                │ Could be 2 per row on lg
│  ...                                    │
└─────────────────────────────────────────┘
```

**Outermost Container:** `space-y-4` (gap between SectionCards)

**Sub-components:**
- Stat grid: `grid grid-cols-2 gap-3` → **Should be:** `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Run cards container: `space-y-3` (vertical list) → **Should be:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`

**Responsive Classes Currently:** NONE

---

### 2️⃣ `/queue/[runId]` - Review Group (Image Grid)

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ Back link + [Download] [Edit Params]    │
├─────────────────────────────────────────┤
│ SectionCard: "宫格审核"                  │
│  Select buttons (Select All, Select Pending) ┤ Stays full-width
│  ┌─────────────────────────────────────┐  │
│  │ Image│Image│Image         [Stat]   │  │ grid-cols-3
│  │      │     │              [Stat]   │  │ Only 3 wide!
│  │ Image│Image│Image         [Stat]   │  │ On 1440px, only shows
│  │      │     │                       │  │ 3 images (wasted space)
│  │ Image│Image│Image                  │  │
│  │      │     │                       │  │
│  └─────────────────────────────────────┘  │
│  [Keep Selected] [Trash Selected]         │
└─────────────────────────────────────────┘

Stat boxes above grid:
  grid-cols-3 (好 on desktop, cramped on mobile)
```

**Outermost Container:** `space-y-4`

**Main Grid:** `grid grid-cols-3 gap-3`
- Each cell: `aspect-[3/4]` ratio with checkbox overlay
- Currently hardcoded to 3 columns

**Responsive Classes Currently:** NONE

**Proposal:**
```
grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
- Mobile (375px): 2 images per row
- Tablet (768px): 4 images per row  
- Desktop (1024px): 5 images per row
- Wide (1440px+): 6 images per row
```

---

### 3️⃣ `/queue/[runId]/images/[imageId]` - Single Image Viewer

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ [Back] ← Status Badge ← Preset Name     │
├─────────────────────────────────────────┤
│                                         │
│          FULL-WIDTH IMAGE               │
│          (responsive, good for mobile)  │
│                                         │
├─────────────────────────────────────────┤
│ Execution Parameters (flex-wrap):       │ Wrapping params
│  [param1] [param2] [param3]             │ Scales well on mobile
│  [param4] [param5] [param6] ...         │
├─────────────────────────────────────────┤
│ ImageActions (keep/trash buttons)       │
├─────────────────────────────────────────┤
│ [Previous Image] [Next Image]           │ grid-cols-2
│ (50% width each, centered)              │ Leaves space on desktop
└─────────────────────────────────────────┘
```

**Issues:**
- Navigation buttons: `grid grid-cols-2` → only Previous/Next
- On 1440px, buttons are 50% width each = 720px each! Too wide.

**Proposal:**
```
Navigation: grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6
- Mobile: 2 columns (50% width each)
- Tablet: 4 columns (25% width each)
- Desktop: 6 columns (16.67% width each, centered in container)
```

---

### 4️⃣ `/projects` - Project List

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ [Empty Space] ← [+ Create New Project]  │ Flex space-between
├─────────────────────────────────────────┤
│ SectionCard: "项目"                      │
│  ┌─────────────────────────────────────┐│
│  │ Project 1                           ││ 
│  │  Presets: Preset A · Preset B       ││ Full-width cards
│  │                              [Chevron]│ space-y-3 (vertical)
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ Project 2                           ││ Could be 2-3 per row
│  │  Presets: Preset C                  ││
│  │                              [Chevron]│
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ Project 3                           ││
│  │  Presets: Preset D · Preset E · ... ││
│  │                              [Chevron]│
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Container:** `space-y-3` (vertical gaps)

**Proposal:**
```
Change from space-y-3 to:
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3

- Mobile: 1 column (stacked)
- Tablet: 2 columns
- Desktop: 3 columns (fits ~6-9 projects on screen)
```

---

### 5️⃣ `/projects/[projectId]` - Project Detail

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ [Back to projects]                      │
├─────────────────────────────────────────┤
│ SectionCard: "Project Title"            │
│  [Edit Project Params] [Run Project]    │
├─────────────────────────────────────────┤
│ SectionCard: "参数概览"                  │
│  [Presets display]                      │
│  [Edit Current Project Params]          │
├─────────────────────────────────────────┤
│ SectionCard: "小节列表"                  │
│  [Expanded Section Cards - COMPLEX]     │  ← See SectionCard detail below
│    ┌────────────────────────────────┐   │
│    │ Section 1 (full-width)         │   │
│    │  - Title + Metadata            │   │
│    │  - Image thumbnails (horiz)    │   │
│    │  - [Run] [Copy] [Delete]       │   │
│    └────────────────────────────────┘   │
│    ┌────────────────────────────────┐   │
│    │ Section 2 (full-width)         │   │
│    │  - Title + Metadata            │   │
│    │  - Image thumbnails (horiz)    │   │
│    │  - [Run] [Copy] [Delete]       │   │
│    └────────────────────────────────┘   │
├─────────────────────────────────────────┤
│ SectionCard: "修订历史"                  │
│  [Revisions expandable list]            │
└─────────────────────────────────────────┘
```

**SectionCard Details (Expanded View):**
```
┌─────────────────────────────────────────┐
│ 🔲 Grip │ Title + Info         │ [x] [D] │ sm:hidden
│─────────────────────────────────────────│
│ 📸 Latest Results · 8 images            │
│  [img] [img] [img] [img] [img] ... → ┐ Horizontal scroll
│  (56px × 80px each, 8 max)           │
├─────────────────────────────────────────┤
│ [Run Section] [Copy] [Delete] ← sm:hide │
└─────────────────────────────────────────┘
```

**Responsive Classes Found:**
- `hidden sm:flex` - Desktop only (Copy/Delete buttons)
- `sm:hidden` - Mobile only (Copy/Delete)
- `hidden items-center gap-1.5 text-[10px] text-zinc-500 sm:flex` - Desktop metadata

**Issue:**
- Section cards are full-width, single column
- Copy/Delete buttons are hidden on mobile (good)
- Could show 2 columns on desktop (lg+)

**Proposal:**
```
Wrap section cards in:
grid grid-cols-1 lg:grid-cols-2 gap-4

On desktop (lg+): Show 2 sections side-by-side
- Better use of space
- Can scroll through more sections at once
```

---

### 6️⃣ `/projects/[projectId]/sections/[sectionId]/blocks` - Section Editor

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ [Back to project detail]                │
│                      [Layers] 8 blocks  │
├─────────────────────────────────────────┤
│ SectionCard: "编辑小节 — Section Name"  │
│  ┌─────────────────────────────────────┐│
│  │ SectionParamsForm                   ││
│  │  [Form fields in single column]     ││
│  │  - Batch Size input                 ││
│  │  - Aspect Ratio select              ││
│  │  - Seed Policy options              ││
│  │  - KSampler 1/2 parameters          ││
│  │  - Upscale Factor input             ││
│  │  [Save] [Revert]                    ││
│  ├─────────────────────────────────────┤│
│  │ 提示词块 & LoRA                      ││
│  │ SectionEditor (COMPLEX)             ││ Very tall, single column
│  │  - Import Preset UI                 ││
│  │  - Preset Bindings List             ││
│  │  - Prompt Blocks Editor             ││
│  │  - LoRA List Editor (lora1 + lora2) ││
│  │                                     ││
│  │  [+ Add Manual Prompt Block]        ││
│  │  [+ Import from Library]            ││
│  │  [+ Add LoRA Entry]                 ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│ SectionCard: "运行此小节"                │
│  [Batch Size Input] [Run]               │
└─────────────────────────────────────────┘

TOTAL HEIGHT: Very tall (2000px+ on desktop)
```

**Responsive Classes:** NONE

**Issue:**
- Form + editor stacked vertically
- Desktop wasted space (narrow single column)
- Could benefit from side-by-side layout on lg+

**Proposal:**
```
On lg+ screens, use grid layout:
grid grid-cols-1 lg:grid-cols-2 gap-6

Left column: SectionParamsForm
Right column: SectionEditor

- Reduces page height
- Params visible while editing blocks
- Better for wide monitors
```

---

### 7️⃣ `/projects/[projectId]/edit` - Project Edit

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ [Back to project detail]                │
├─────────────────────────────────────────┤
│ SectionCard: "编辑项目"                  │
│  ┌─────────────────────────────────────┐│
│  │ ProjectEditForm (single column)     ││
│  │  [Form fields]                      ││
│  │  [Presets multi-select]             ││
│  │  [Save] [Cancel]                    ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

**Issue:**
- Form takes full width (max-w-6xl = 1024px)
- Lots of empty space in columns on desktop

**Proposal:**
```
Option 1: Narrow container for form
<div class="max-w-2xl mx-auto">
  <SectionCard>
    <ProjectEditForm />

Option 2: Side-by-side (form + info)
grid grid-cols-1 lg:grid-cols-2 gap-6
- Left: Form
- Right: Project info/preview
```

---

### 8️⃣ `/settings` - Settings Hub

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ SectionCard: "设置"                      │
│  ┌──────────────────────────────────┐  │
│  │ [Icon] Workflow 模板             │  │
│  │        查看和导入模板             │  │ space-y-2
│  └──────────────────────────────────┘  │ (vertical)
│  ┌──────────────────────────────────┐  │
│  │ [Icon] ComfyUI 监控              │  │
│  │        进程状态、健康检查         │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ [Icon] 后端日志                  │  │
│  │        查看运行日志               │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Container:** `space-y-2` (vertical stack)

**Proposal:**
```
Change to: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3

- Mobile: 1 column (stacked)
- Tablet: 2 columns
- Desktop: 3 columns (more breathing room)
```

---

### 9️⃣ `/assets/prompts` - Prompt Manager

**Current Structure:** Likely similar to settings - vertical list of categories/items

**Proposal:** Apply same grid layout as settings

---

### 🔟 `/trash` - Trash Page

**Current Structure:**
```
┌─────────────────────────────────────────┐
│ SectionCard: "回收站"                    │
│  ┌──────────────────────────────────┐  │
│  │ Deleted: 5 images                │  │
│  └──────────────────────────────────┘  │
├─────────────────────────────────────────┤
│ SectionCard: "已删除图片"                │
│  ┌──────────────────────────────────┐  │
│  │ [img] Title                    │  │  space-y-3
│  │ 16×16  Deleted: 2025-03-01     │  │  (vertical list)
│  │        /path/to/image.png      │  │
│  │                         [Restore] │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │ [img] Title 2                  │  │
│  │ 16×16  Deleted: 2025-02-28     │  │
│  │        /path/to/image2.png     │  │
│  │                         [Restore] │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘

Thumbnail size: size-16 (64px × 64px)
- Tiny on mobile (acceptable)
- Tiny on desktop (should be larger!)
```

**Issue:**
- Items stacked vertically (space-y-3)
- Thumbnail stays 64px on all screen sizes (too small on desktop)

**Proposal:**
```
1. Add responsive grid:
   grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4

2. Scale thumbnails:
   current: size-16 (64px)
   proposal: size-16 md:size-20 lg:size-24
   
   - Mobile: 64px × 64px
   - Tablet: 80px × 80px  
   - Desktop: 96px × 96px
```

---

## 🎯 Common Responsive Patterns

### Pattern 1: List → Grid

**Current:**
```jsx
<div class="space-y-3">
  {items.map(item => <Card />)}
</div>
```

**Proposed:**
```jsx
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  {items.map(item => <Card />)}
</div>
```

### Pattern 2: Container Width

**Current:**
```jsx
<div class="mx-auto max-w-6xl px-4">
```

**Proposed:**
```jsx
<div class="mx-auto max-w-6xl md:max-w-7xl lg:max-w-8xl px-4 md:px-6 lg:px-8">
```

### Pattern 3: Grid Scaling

**Current:**
```jsx
<div class="grid grid-cols-3 gap-3">
```

**Proposed:**
```jsx
<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
```

### Pattern 4: Component Padding

**Current:**
```jsx
<section class="... p-4 ...">
```

**Proposed:**
```jsx
<section class="... p-4 md:p-6 lg:p-8 ...">
```

---

## 📋 Implementation Checklist

### Phase 1: Foundation (1-2 hours)
- [ ] Update `AppShell` with responsive max-width
- [ ] Update `SectionCard` padding
- [ ] Establish responsive spacing scale

### Phase 2: Core Pages (3-4 hours)
- [ ] `/queue` - Stat grid + Run cards
- [ ] `/queue/[runId]` - Review grid columns
- [ ] `/projects` - Project list grid
- [ ] `/projects/[projectId]` - Section list grid

### Phase 3: Complex Pages (3-4 hours)
- [ ] `/queue/[runId]/images/[imageId]` - Navigation grid
- [ ] `/projects/[projectId]/blocks` - Form + Editor side-by-side
- [ ] Settings pages - List grids

### Phase 4: Polish (2-3 hours)
- [ ] Typography scaling (responsive text sizes)
- [ ] Image scaling (thumbnails, badges)
- [ ] Navigation bar responsive behavior
- [ ] Test at all breakpoints

### Phase 5: Testing (1-2 hours)
- [ ] Mobile (375px)
- [ ] Tablet (768px)
- [ ] Desktop (1024px)
- [ ] Wide (1440px)
- [ ] Ultra-wide (1920px)

---

## 🎨 Breakpoint Strategy

```
Mobile First (default)      → Mobile layouts
  ↓ sm:640px               → Some mobile optimizations
  ↓ md:768px               → Tablet starts multi-column
  ↓ lg:1024px              → Desktop multi-column
  ↓ xl:1280px              → Extra spacing, larger components
  ↓ 2xl:1536px             → Ultra-wide optimization
```

**Common Transitions:**
- Single column → 2-column at md
- 2-column → 3+ columns at lg
- Padding increases at md/lg
- Typography scales at lg/xl

---

## 📐 Responsive Width Reference

| Breakpoint | Width | Container | Padding | Result |
|---|---|---|---|---|
| sm (mobile) | 375-640px | max-w-6xl | px-4 | 343px content |
| md (tablet) | 641-1023px | max-w-6xl | px-4 | 608px content |
| lg (desktop) | 1024-1439px | max-w-7xl | px-8 | 1264px content |
| xl (wide) | 1440-1535px | max-w-8xl | px-12 | 1416px content |
| 2xl (ultra) | 1536px+ | max-w-full | px-16 | Full minus 64px |

---

## ✅ Success Criteria

- [ ] All pages render properly at: 375px, 768px, 1024px, 1440px, 1920px
- [ ] No horizontal scrolling at any breakpoint
- [ ] Content properly scales with screen size
- [ ] Stat grids use available horizontal space
- [ ] Image grids increase columns on larger screens
- [ ] Lists transition from 1 → 2 → 3 columns
- [ ] Padding increases proportionally
- [ ] Navigation bar accommodates layout changes
- [ ] Touch targets remain accessible on mobile
- [ ] No layout shifts during interactions

---

## 🔗 Related Files

**Configuration:**
- `tailwind.config.*` - Breakpoints (v4, uses defaults)
- `postcss.config.mjs` - PostCSS config

**Core Components:**
- `src/components/app-shell.tsx` - Root container
- `src/components/section-card.tsx` - Content wrapper
- `src/components/page-header.tsx` - Page titles

**Pages to Modify:**
- All files in `src/app/` tree
- Focus areas: queue, projects, settings, assets, trash

---

**Notes for Developer:**
- Use Tailwind's mobile-first approach (base → sm: → md: → lg: → xl:)
- Test frequently at different breakpoints
- Consider touch targets (min 44px on mobile)
- Use `gap-*` instead of margin for better consistency
- Group responsive classes for clarity


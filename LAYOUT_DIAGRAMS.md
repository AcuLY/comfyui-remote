# ComfyUI Remote - Layout Diagrams

## Visual Page Structure Reference

### Root Layout Structure
```
┌────────────────────────────────────────────────────────┐
│                     HTML (h-full)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │  BODY (h-full bg-[var(--bg)])                    │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │ HEADER (shrink-0)                           │ │  │
│  │  │ max-w-6xl mx-auto px-4 py-3                 │ │  │
│  │  │ ┌─────────────┐         ┌──────────────────┐│ │  │
│  │  │ │ Logo/Title  │ ......  │ mobile-first tag ││ │  │
│  │  │ └─────────────┘         └──────────────────┘│ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │ MAIN (flex-1 min-h-0 overflow-y-auto)      │ │  │
│  │  │ max-w-6xl mx-auto px-4 py-4 pb-24          │ │  │
│  │  │                                             │ │  │
│  │  │ space-y-4                                   │ │  │
│  │  │ ┌─────────────────────────────────────────┐ │ │  │
│  │  │ │ Page Header / Content Components        │ │ │  │
│  │  │ │ (grows to fill available space)         │ │ │  │
│  │  │ │                                          │ │ │  │
│  │  │ │ [Scrollable on mobile]                  │ │ │  │
│  │  │ └─────────────────────────────────────────┘ │ │  │
│  │  │                                             │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │ FOOTER NAV (shrink-0)                       │ │  │
│  │  │ max-w-6xl mx-auto grid-cols-6 px-2 py-2   │ │  │
│  │  │ ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐                         │ │  │
│  │  │ │ ││ ││ ││ ││ ││ │                         │ │  │
│  │  │ └─┘└─┘└─┘└─┘└─┘└─┘                         │ │  │
│  │  │ 6 nav items (dense)                        │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  │                                                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Queue Page Layout

```
┌─ /queue ─────────────────────────────────────────────────┐
│                                                          │
│ space-y-4                                               │
│                                                          │
│ ┌─ PageHeader ──────────────────────────────────────┐  │
│ │ flex items-start justify-between                 │  │
│ │ ┌────────────────────────────┐ ┌──────────────┐  │  │
│ │ │ 待审核队列  (title)        │ │              │  │  │
│ │ │ 描述...      (subtitle)    │ │              │  │  │
│ │ └────────────────────────────┘ │              │  │  │
│ │                                 └──────────────┘  │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ Tab Bar (flex) ──────────────────────────────────┐  │
│ │ [待审核] [运行中] [失败]        [Refresh]         │  │
│ │  badge    badge    badge                         │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ SectionCard (space-y-4) ────────────────────────┐  │
│ │ Title: 队列概览  Subtitle: ...                   │  │
│ │                                                  │  │
│ │ grid grid-cols-2 gap-3  ← STATIC (needs md:4)  │  │
│ │ ┌──────────────┐ ┌──────────────┐               │  │
│ │ │ 待审核图片    │ │ 待处理组数    │               │  │
│ │ │ 待审核: 23   │ │ 待处理: 5    │               │  │
│ │ └──────────────┘ └──────────────┘               │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─ SectionCard (space-y-3) ────────────────────────┐  │
│ │ Title: 最新结果组  Subtitle: ...                 │  │
│ │                                                  │  │
│ │ ┌─ Run Card (flex + grid) ─────────────────────┐ │  │
│ │ │ ┌──────────────────────┐ ┌──────────────────┐│ │  │
│ │ │ │ ProjectTitle         │ │ 待审核 badge     ││ │  │
│ │ │ │ preset · preset      │ │                  ││ │  │
│ │ │ └──────────────────────┘ └──────────────────┘│ │  │
│ │ │                                              │ │  │
│ │ │ grid grid-cols-3 gap-2  ← STATIC (needs+)  │ │  │
│ │ │ ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │  │
│ │ │ │ ✓ Date  │ │ 👁 审核  │ │ ✨ 共  │        │ │  │
│ │ │ │ 2 小时前  │ │ 5       │ │ 18 张  │        │ │  │
│ │ │ └─────────┘ └─────────┘ └─────────┘        │ │  │
│ │ │                                              │ │  │
│ │ │ > 打开宫格                                  │ │  │
│ │ └──────────────────────────────────────────────┘ │  │
│ │                                                  │  │
│ │ ┌─ Run Card 2 ────────────────────────────────┐  │  │
│ │ │ ... (same pattern)                         │  │  │
│ │ └──────────────────────────────────────────────┘  │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key measurements:**
- Container width: 992px (max-w-6xl minus px-4)
- Top-level gap: gap-4 (1rem)
- Card padding: p-4
- Stats grid: 2 columns (needs: md:4)
- Metadata grid: 3 columns (needs: md:6)

---

## Run Detail Page Layout

```
┌─ /queue/[runId] ──────────────────────────────────────┐
│                                                       │
│ space-y-4                                            │
│                                                       │
│ ┌─ Back + Actions (flex justify-between) ─────────┐  │
│ │ < 返回队列                    [下载工作流][参数编辑]│  │
│ └──────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─ SectionCard ─────────────────────────────────────┐ │
│ │ Title: Group Title  Subtitle: ...                │ │
│ │                                                   │ │
│ │ grid grid-cols-3 gap-2  ← STATIC (needs md:4)  │ │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐          │ │
│ │ │ 待审核   │ │ 总张数   │ │ 单页上限 │          │ │
│ │ │ 5        │ │ 23       │ │ 9        │          │ │
│ │ └──────────┘ └──────────┘ └──────────┘          │ │
│ │                                                   │ │
│ │ [Execution Meta Display]                         │ │
│ │ grid grid-cols-2 gap-2                           │ │
│ │ ┌──────────────┐ ┌──────────────┐               │ │
│ │ │ KSampler1    │ │ KSampler2    │               │ │
│ │ │ Seed: ...    │ │ Seed: ...    │               │ │
│ │ │ steps ...    │ │ steps ...    │               │ │
│ │ └──────────────┘ └──────────────┘               │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─ SectionCard ─────────────────────────────────────┐ │
│ │ Title: 宫格审核  Subtitle: ...                    │ │
│ │                                                   │ │
│ │ [ReviewGrid Component - 9 images in 3x3]         │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
│ ┌─ Navigation (grid grid-cols-2 gap-3) ────────────┐ │
│ │ ┌──────────────────┐ ┌──────────────────┐        │ │
│ │ │ < 上一组         │ │ 下一组 >         │        │ │
│ │ └──────────────────┘ └──────────────────┘        │ │
│ │ (or empty divs if no prev/next)                  │ │
│ └──────────────────────────────────────────────────┘ │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Issues:**
- Status grid: 3 columns (too cramped on desktop, needs: md:4)
- Meta grid: 2 columns (okay but could expand)
- Nav buttons: 2 columns (could be 1 row on desktop)

---

## Single Image View Layout

```
┌─ /queue/[runId]/images/[imageId] ──────────────────┐
│                                                    │
│ space-y-4                                         │
│                                                    │
│ ┌─ Header (flex justify-between) ──────────────┐  │
│ │ < 返回宫格                  [badge] preset  │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
│ ┌─ Image Container ─────────────────────────────┐  │
│ │ rounded-[28px] border p-3                     │  │
│ │                                               │  │
│ │ ┌─────────────────────────────────────────┐  │  │
│ │ │                                         │  │  │
│ │ │    [Image - responsive w-full h-auto]  │  │  │
│ │ │    (scales to container width)          │  │  │
│ │ │                                         │  │  │
│ │ │                                         │  │  │
│ │ └─────────────────────────────────────────┘  │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
│ ┌─ Execution Params (flex flex-wrap gap-2) ─────┐  │
│ │ [param tag] [param tag] [param tag]           │  │
│ │ [param tag] [param tag]                       │  │
│ │                                               │  │
│ │ <details>                                      │  │
│ │   Prompt (collapsible)                        │  │
│ │   <pre> ... </pre>                            │  │
│ │ </details>                                     │  │
│ │                                               │  │
│ │ <details>                                      │  │
│ │   Negative Prompt                             │  │
│ │   <pre> ... </pre>                            │  │
│ │ </details>                                     │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
│ ┌─ Image Actions ───────────────────────────────┐  │
│ │ [Action buttons]                              │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
│ ┌─ Navigation (grid grid-cols-2 gap-3) ────────┐  │
│ │ ┌────────────────┐ ┌────────────────┐        │  │
│ │ │ < 上一张       │ │ 下一张 >       │        │  │
│ │ └────────────────┘ └────────────────┘        │  │
│ └───────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

**Notes:**
- Image: fully responsive with `w-full`
- Params: flexible wrap (good!)
- Navigation: 2 columns (static - could be centered or 1 row on desktop)

---

## Projects List Layout

```
┌─ /projects ───────────────────────────────────────────┐
│                                                      │
│ space-y-4                                           │
│                                                      │
│ ┌─ Create Button Row (flex justify-end) ─────────┐  │
│ │                              [+ 创建新项目]      │  │
│ └──────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ SectionCard ─────────────────────────────────────┐│
│ │ Title: 项目  Subtitle: ...                       ││
│ │                                                   ││
│ │ space-y-3  ← ALWAYS 1 COLUMN (needs: md:2)    ││
│ │ ┌────────────────────────────────────────────┐ ││
│ │ │ Link (block)                               │ ││
│ │ │ ┌──────────────────┐ ┌──────────────────┐ │ ││
│ │ │ │ Project Title    │ │ 待处理 | >       │ │ ││
│ │ │ │ preset · preset  │ │                  │ │ ││
│ │ │ └──────────────────┘ └──────────────────┘ │ ││
│ │ │ 最近更新: 2024-04-01 · 5 个小节           │ ││
│ │ └────────────────────────────────────────────┘ ││
│ │                                                   ││
│ │ ┌────────────────────────────────────────────┐ ││
│ │ │ Link (block)                               │ ││
│ │ │ ... (Project 2)                            │ ││
│ │ │                                            │ ││
│ │ └────────────────────────────────────────────┘ ││
│ │                                                   ││
│ └───────────────────────────────────────────────────┘│
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Issues:**
- Always 1 column (should be 2-3 on md/lg)
- Card padding: p-4
- Each project is a flex row with space-between

---

## Results Grid Comparison

### Current (Mobile-First, Responsive ✅)
```
Mobile (320px)         Tablet (768px)         Desktop (1024px)
┌─────┬─────┬─────┐   ┌─────┬─────┐          ┌─────┬─────┐
│ img │ img │ img │   │ img │ img │ img │ img│ img │ img │
├─────┼─────┼─────┤   │     │     │     │    │     │     │
│ img │ img │ img │   ├─────┼─────┼─────┼────┤─────┼─────┤
│ img │ img │ img │   │ img │ img │ img │ img│ img │ img │
└─────┴─────┴─────┘   └─────┴─────┴─────┴────┴─────┴─────┘
(3 cols)             (4 cols)               (5 cols)
```

**Code:**
```tsx
<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
```

**This is the BEST example in the app!**

---

## Monitor Page Stats Grid

### Current (Partial Responsive)
```
Mobile (320px)         Tablet (640px)         Desktop (1024px)
┌────────────┐         ┌──────┬──────┐       ┌──────┬──────┐
│ Status: ok │         │      │      │       │      │      │
├────────────┤         ├──────┼──────┤       ├──────┼──────┤
│ Uptime: 2h │         │      │      │       │      │      │
├────────────┤         ├──────┼──────┤       ├──────┼──────┤
│ PID: 1234  │         │      │      │       │ (all 4 on 1 row)
├────────────┤         └──────┴──────┘       │      │      │
│ Restarts: 0│                              └──────┴──────┘
└────────────┘
```

**Code:**
```tsx
<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
```

**Note:** Only uses `sm:` breakpoint, good start but needs `lg:` consideration.

---

## Form Layout (Project Form)

```
┌─ /projects/new ───────────────────────────────────────┐
│                                                       │
│ space-y-4                                            │
│                                                       │
│ ┌─ Title Input ─────────────────────────────────────┐│
│ │ label: 项目标题 *                                  ││
│ │ input (w-full)                                     ││
│ └──────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Category Selectors ──────────────────────────────┐│
│ │ grid gap-3 md:grid-cols-2                          ││
│ │                                                    ││
│ │ Mobile (1 col)              Desktop md+ (2 col)  ││
│ │ ┌───────────────┐            ┌───────┐ ┌───────┐ ││
│ │ │ Category A    │            │ Cat A │ │ Cat B │ ││
│ │ │ <select>      │            │ sel   │ │ sel   │ ││
│ │ │ <select>      │            └───────┘ └───────┘ ││
│ │ │ [preview]     │            ┌───────┐ ┌───────┐ ││
│ │ ├───────────────┤            │ Cat C │ │ Cat D │ ││
│ │ │ Category B    │            │ sel   │ │ sel   │ ││
│ │ │ <select>      │            └───────┘ └───────┘ ││
│ │ │ <select>      │                                 ││
│ │ │ [preview]     │                                 ││
│ │ └───────────────┘                                 ││
│ └──────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Notes Textarea ──────────────────────────────────┐│
│ │ label: 备注 (可选)                                 ││
│ │ <textarea rows={3} w-full>                         ││
│ └──────────────────────────────────────────────────┘│
│                                                       │
│ ┌─ Submit Button ───────────────────────────────────┐│
│ │ [+ 创建项目] (w-full)                              ││
│ └──────────────────────────────────────────────────┘│
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Note:** Uses `md:grid-cols-2` intentionally - good! Could expand to `lg:grid-cols-3` or `lg:grid-cols-4` for extra-large forms.

---

## Responsive Comparison: ALL Grids

```
Component           Mobile      Tablet      Desktop
────────────────────────────────────────────────────
Queue Stats         2 cols      2 cols      2 cols  ← STATIC
Queue Metadata      3 cols      3 cols      3 cols  ← STATIC
Run Status          3 cols      3 cols      3 cols  ← STATIC
Results Gallery     3 cols      4 cols      5 cols  ✅ RESPONSIVE
Monitor Stats       2 cols      4 cols      4 cols  ⚠️ PARTIAL
Project Form        1 col       2 cols      2 cols  ⚠️ PARTIAL
Trash Items         1 col       1 col       1 col   ← STATIC
Projects List       1 col       1 col       1 col   ← STATIC
Settings List       1 col       1 col       1 col   ← STATIC
```

---

## Recommended Breakpoint Progression

### For Grid Components
```tsx
// Template for responsive grids
<div className="grid 
  grid-cols-2 gap-3              // Mobile: 2 cols
  sm:grid-cols-3                 // 640px+: 3 cols
  md:grid-cols-4                 // 768px+: 4 cols
  lg:grid-cols-5                 // 1024px+: 5 cols
  xl:grid-cols-6                 // 1280px+: 6 cols
">
  {items}
</div>
```

### For List Components
```tsx
// Template for responsive lists
<div className="space-y-3
  md:grid md:grid-cols-2 md:gap-3 // 768px+: 2-col grid
  lg:grid-cols-3 lg:gap-4         // 1024px+: 3-col grid
">
  {items}
</div>
```

### For Form Inputs
```tsx
// Template for responsive forms
<div className="grid gap-3
  grid-cols-1                      // Mobile: 1 col
  md:grid-cols-2                   // 768px+: 2 col
  lg:grid-cols-3                   // 1024px+: 3 col
">
  {fields}
</div>
```

---

## Navigation Transformation

### Current: Bottom Mobile Nav (All Screens)
```
┌────────────────────────────────┐
│ [图] [项] [回] [预] [LoRA] [设] │  ← 6 items, dense
└────────────────────────────────┘
```

### Proposed: Sidebar on Desktop
```
Mobile (< lg)              Desktop (lg+)
┌─────────────────┐        ┌────┬────────────────┐
│                 │        │ ▋  │                │
│   Page content  │        │ ▋  │  Page content  │
│                 │        │ ▋  │  (wider)       │
└────────────────

█│        │ ▋  │                │
│ Images  │────┘
│ Projects│
│ Trash   │
│ Presets │
│ LoRA    │
│ Settings│
└────┘
```

---

## Width Calculations

```
Screen: 1920px (4K)
├─ Sidebar (fixed): 192px (w-48)
├─ Gap: 16px (gap-4)
├─ Content: max-w-6xl = 1024px
│  └─ Padding: px-4 = 32px total
│  └─ Content width: 992px
└─ Total used: 192 + 16 + 1024 = 1232px
   Unused: 688px on each side (problematic!)

Solution: Increase max-w to max-w-7xl (1280px) at xl:
Content: 1280px
  └─ Padding: 32px
  └─ Content width: 1248px
Total: 192 + 16 + 1280 = 1488px
Unused: 432px (much better!)

Or: Use max-w-full with larger side padding at lg+
```


# Visual Layout Guide - ComfyUI Remote

## Layout Hierarchy Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo + "mobile-first" badge                        │ (fixed)
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  MAIN CONTENT (max-w-6xl, gap-4 between sections)            │
│  ├─ space-y-4                                                │
│  │                                                            │
│  │ ┌───────────────────────────────────────────────┐         │
│  │ │ TAB BAR (gap-1)                              │         │
│  │ │ [待审核] [运行中] [失败]                     │         │
│  │ └───────────────────────────────────────────────┘         │
│  │                                                            │
│  │ ┌───────────────────────────────────────────────┐         │
│  │ │ SECTION CARD: "队列概览"                      │         │
│  │ │ ┌─────────┬─────────┐                         │         │
│  │ │ │ Stat 1  │ Stat 2  │  (grid-cols-2, gap-3) │         │
│  │ │ └─────────┴─────────┘                         │         │
│  │ └───────────────────────────────────────────────┘         │
│  │                                                            │
│  │ ┌───────────────────────────────────────────────┐         │
│  │ │ SECTION CARD: "最新结果组"                    │         │
│  │ │ ┌─────────────────────────────────────────┐   │         │
│  │ │ │ CARD 1 (space-y-3 between cards)       │   │         │
│  │ │ │ Title + Badge (flex, gap-3)             │   │         │
│  │ │ │ ┌──────┬──────┬──────┐ (grid-cols-3)  │   │         │
│  │ │ │ │ Stat │ Stat │ Stat │                 │   │         │
│  │ │ │ └──────┴──────┴──────┘                 │   │         │
│  │ │ └─────────────────────────────────────────┘   │         │
│  │ │ ┌─────────────────────────────────────────┐   │         │
│  │ │ │ CARD 2                                  │   │         │
│  │ │ │ ...                                     │   │         │
│  │ │ └─────────────────────────────────────────┘   │         │
│  │ └───────────────────────────────────────────────┘         │
│  │                                                            │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  BOTTOM NAV: [待审核] [项目] [回收站] [预制] [LoRA] [设置]  │ (fixed)
│  (grid-cols-6, gap-1)                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Review Grid Layout (Image Gallery)

### Grid Structure: 3 Columns
```
┌─────────────────────────────────────────────────────────────┐
│  SELECTION CONTROLS                                          │
│  [全选] [选中待审核 (n)] ────────────────────── [已选 x 张]  │
└─────────────────────────────────────────────────────────────┘

┌────────────┐  ┌────────────┐  ┌────────────┐
│  IMAGE 1   │  │  IMAGE 2   │  │  IMAGE 3   │  3 columns
│            │  │            │  │            │  gap-3 (12px)
│ aspect-3/4 │  │ aspect-3/4 │  │ aspect-3/4 │  aspect ratio
└────────────┘  └────────────┘  └────────────┘

Each image card structure:
┌──────────────────────────┐
│ ☑ IMG_001                │  ← Top-left: checkbox + label
│                          │
│    [3/4 ASPECT RATIO]    │
│        IMAGE             │
│                          │
│ pending          [查看→] │  ← Bottom: status + view link
└──────────────────────────┘

Hover effects:
- Border color: white/10 → sky-400/50 (on select)
- Ring: ring-2 ring-sky-400/30 (on select)
- Image scale: 1 → 1.02 (on hover)
```

### Action Buttons Below Grid
```
┌─────────────────────────────────────────────────────┐
│  ┌─────────────────────┬─────────────────────┐      │
│  │  批量保留 (n)       │   批量删除 (n)      │      │ grid-cols-2, gap-3
│  │  (emerald theme)    │  (rose theme)       │      │
│  └─────────────────────┴─────────────────────┘      │
│  
│  (If action taken & pending remain:)
│  ┌─────────────────────┬─────────────────────┐      │
│  │  保留剩余 (n) →     │   删除剩余 (n) →    │      │
│  │  (brighter emerald) │  (brighter rose)    │      │
│  └─────────────────────┴─────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## Single Image View Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← 返回宫格                              pending | Section   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                               │
│        ┌──────────────────────────────────┐                 │
│        │                                  │                 │
│        │      FULL SIZE IMAGE              │                 │
│        │     (rounded-[28px])              │                 │
│        │     aspect-auto, w-full           │                 │
│        │                                  │                 │
│        └──────────────────────────────────┘                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  EXECUTION PARAMETERS (flex flex-wrap, gap-2)               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │param 1  │ │param 2  │ │param 3  │ │param 4  │ ...        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│                                                               │
│  LoRA1:                                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐                  │
│  │lora_name1 │ │lora_name2 │ │lora_name3 │ ...              │
│  └───────────┘ └───────────┘ └───────────┘                  │
│                                                               │
│  <details>                                                   │
│  ▶ Prompt                                                    │
│  ▶ Negative Prompt                                           │
│  </details>                                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ACTION BUTTONS (grid-cols-2, gap-3)                        │
│  ┌──────────────┬──────────────┐                            │
│  │    保留      │    删除      │                            │
│  └──────────────┴──────────────┘                            │
│  ✓ Feedback message (text-xs, colored border)              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NAVIGATION (grid-cols-2, gap-3)                            │
│  ┌──────────────┬──────────────┐                            │
│  │  ← 上一张    │  下一张 →    │                            │
│  └──────────────┴──────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsive Strategy (Mobile-First)

### Current Implementation:
- **Mobile (default)**: Single column layouts
- **Desktop**: Fixed 3-column image grid

### Recommended Enhancements:

```css
/* Queue list cards - could be 2 columns on desktop */
.queue-list {
  display: grid;
  grid-template-columns: 1fr;           /* mobile: 1 col */
  /* sm:grid-cols-2 lg:grid-cols-1 */   /* tablet: 2 cols (if desired) */
}

/* Image grid - current 3-col, could scale on desktop */
.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* desktop: 3 cols */
  /* sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 */
}

/* Stats grids - current 2-col */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);  /* desktop: 2 cols */
  /* sm:grid-cols-1 md:grid-cols-2 */
}
```

---

## Key CSS Classes Reference

### Spacing
- `gap-1`: 4px
- `gap-2`: 8px
- `gap-3`: 12px
- `gap-4`: 16px
- `space-y-1`: 4px vertical
- `space-y-2`: 8px vertical
- `space-y-3`: 12px vertical
- `space-y-4`: 16px vertical

### Rounded Corners
- `rounded-lg`: 8px
- `rounded-xl`: 12px
- `rounded-2xl`: 16px
- `rounded-3xl`: 24px
- `rounded-[28px]`: 28px (custom)
- `rounded-[22px]`: 22px (custom)
- `rounded-full`: 50%

### Borders
- `border-white/10`: 10% white opacity
- `border-white/5`: 5% white opacity
- `border-white/20`: 20% white opacity

### Backgrounds
- `bg-[var(--panel)]`: Panel background color
- `bg-[var(--panel-soft)]`: Softer panel background
- `bg-white/[0.03]`: 3% white opacity
- `bg-white/[0.06]`: 6% white opacity

### Image
- `aspect-[3/4]`: 3:4 aspect ratio
- `aspect-auto`: Natural aspect ratio
- `object-cover`: Fill container, maintain aspect ratio

---

## Component Nesting Depth

```
AppShell
├── Header
├── Main
│   └── Page Content (max-w-6xl, gap-4)
│       ├── PageHeader
│       ├── TabBar
│       ├── SectionCard (space-y-4)
│       │   ├── Title + Subtitle
│       │   └── Content
│       │       ├── Grid (grid-cols-2 or grid-cols-3)
│       │       │   └── Cards/Items
│       │       └── ReviewGrid (only in /queue/[runId])
│       │           ├── Selection Controls
│       │           ├── Image Grid (grid-cols-3, gap-3)
│       │           │   └── Image Cards (relative positioned)
│       │           │       ├── Overlay (checkbox + label)
│       │           │       ├── Image
│       │           │       └── Overlay (status + view link)
│       │           └── Action Buttons
│       └── Navigation Buttons
└── Bottom Nav
```

---

## Color Coding System

### Status Badges
- **pending** (待审核): `border-white/10 bg-black/30`
- **kept** (保留): `border-emerald-500/30 bg-emerald-500/20 text-emerald-300`
- **trashed** (删除): `border-rose-500/30 bg-rose-500/20 text-rose-300`

### Button Themes
- **Keep/Positive**: `border-emerald-500/20 bg-emerald-500/10 text-emerald-300`
- **Delete/Negative**: `border-rose-500/20 bg-rose-500/10 text-rose-300`
- **Select**: `border-sky-400 bg-sky-500 text-white`
- **Neutral**: `border-white/10 bg-white/[0.03] text-zinc-300`

### Text Colors
- **Primary**: `text-white`
- **Secondary**: `text-zinc-300`, `text-zinc-400`
- **Tertiary**: `text-zinc-500`, `text-zinc-600`
- **Accent**: `text-sky-300`

---

## Notes on Future Modifications

✅ The 3-column image grid is the **main visual focus** and is working well.

⚠️ **No responsive variants** are currently in use (no `sm:`, `md:`, `lg:` prefixes).

💡 **Possible improvements:**
1. Add responsive image grid (fewer columns on mobile)
2. Add responsive queue list (2-col on desktop)
3. Implement sticky headers for better navigation
4. Add virtual scrolling for large image grids (50+ items)
5. Add image lazy loading with placeholder


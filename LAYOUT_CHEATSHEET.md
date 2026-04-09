# Layout Cheatsheet - Quick Reference

## 🎯 Container Classes You See Everywhere

### Page/Main Container
```tsx
<div className="space-y-4">  // 16px vertical gaps between major sections
```

### Card/Section Container
```tsx
<div className="space-y-3">  // 12px vertical gaps inside cards
```

### List Items/Rows
```tsx
<div className="space-y-1">  // 4px vertical gaps (compact list)
<div className="space-y-2">  // 8px vertical gaps
<div className="space-y-3">  // 12px vertical gaps
```

---

## 📏 Standard Padding Values

| Class | Pixels | Used For |
|-------|--------|----------|
| `p-1` | 4px | Minimal |
| `p-2` | 8px | Buttons, small cards |
| `p-3` | 12px | Medium cards, sections |
| `p-4` | 16px | Main cards, large sections |
| `px-2` | 8px x-axis | Horizontal padding in buttons |
| `py-1` | 4px y-axis | Vertical padding in buttons |
| `px-3 py-1.5` | 12x6px | Compact list items |
| `px-4 py-2` | 16x8px | Primary buttons |

---

## 🎨 Border & Background Patterns

### Main Cards (Most Used)
```tsx
className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
// = 16px padding, 1px border, 10% opacity white border, 3% opacity white bg
```

### Secondary Elements
```tsx
className="rounded-lg border border-white/5 bg-white/[0.02]"
// = More subtle version (smaller border radius, lower opacity)
```

### Buttons (Sky Blue Accent)
```tsx
className="rounded-lg bg-sky-500/10 px-2 py-1 text-sky-300 hover:bg-sky-500/20"
// = 10% opacity sky bg, hover gets 20% opacity
```

### Dashed/Empty State
```tsx
className="rounded-2xl border border-dashed border-white/10 p-6"
// = Empty state placeholder
```

### Import Panel
```tsx
className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2"
// = Sky-themed border & background for floating panel
```

---

## 🔢 Gap/Spacing Reference (Tailwind)

```
gap-1   = 4px      (very tight)
gap-1.5 = 6px      (between thumbnails)
gap-2   = 8px      (normal)
gap-3   = 12px     (comfortable)
gap-4   = 16px     (spacious)
gap-6   = 24px     (section separator)
```

---

## 📱 Responsive Patterns

### Show/Hide by Breakpoint
```tsx
className="hidden sm:flex"      // Hidden on mobile, shown on small+
className="flex md:hidden"      // Shown on mobile, hidden on medium+
```

### Layout Changes
```tsx
className="flex flex-col md:flex-row"   // Stack on mobile, row on desktop
className="w-full md:w-56"              // 100% mobile, 224px desktop
```

### Breakpoint Reference
- `sm:` = 640px and up
- `md:` = 768px and up (main one used in project)
- `lg:` = 1024px and up
- `xl:` = 1280px and up

---

## 🎭 Text Styling

### Common Color Classes
```tsx
text-zinc-300       // Main text (light)
text-zinc-400       // Secondary text
text-zinc-500       // Tertiary text (muted)
text-zinc-600       // Very muted (for icons, hover states)
text-sky-300        // Accent text (blue)
text-white          // Bright text
```

### Size/Weight
```tsx
text-sm             // Small (14px)
text-xs             // Extra small (12px)
text-[10px]         // Custom 10px
text-[11px]         // Custom 11px
font-semibold       // Semi-bold
font-medium         // Medium weight
```

---

## 🎛️ Flex & Layout Utilities

### Alignment
```tsx
flex items-center justify-between   // Space apart with vertical center
flex items-start justify-between    // Space apart, top-aligned
flex items-center gap-2             // Center + 8px gap between items
```

### Width & Flex
```tsx
flex-1              // Take remaining space (flex: 1)
min-w-0             // Allow text truncation in flex items
shrink-0            // Don't shrink (used with flex items)
w-full              // 100% width
w-56                // 224px (14 * 16)
```

---

## 🎪 State Classes

### Pending/Loading
```tsx
opacity-60          // Make content semi-transparent while loading
disabled:opacity-50 // Disable button state
```

### Drag State
```tsx
shadow-lg ring-2 ring-sky-500/30    // Visual feedback while dragging
```

### Hover State
```tsx
hover:bg-white/10       // Slight background on hover
hover:border-white/20   // Darker border on hover
hover:text-zinc-200     // Brighter text on hover
active:scale-95         // Scale down when clicked
```

---

## 📦 Component Building Blocks

### Typical Card Structure
```tsx
<div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
  <div className="space-y-3">
    <div>Content Item 1</div>
    <div>Content Item 2</div>
  </div>
</div>
```

### Typical Row/Item Structure
```tsx
<div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
  <div className="flex items-center gap-2 min-w-0">
    {/* Left content with truncation support */}
  </div>
  <div className="flex items-center gap-1 shrink-0">
    {/* Right actions that don't shrink */}
  </div>
</div>
```

### Typical Button Structure
```tsx
<button className="inline-flex items-center gap-2 rounded-lg bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/20">
  <Icon className="size-3" />
  Button Text
</button>
```

---

## 🔑 Key Constants Used

### Max-Height
```tsx
max-h-40  = 160px (import panel content)
```

### Fixed Sizes
```tsx
Image dimensions: width={56} height={80}  // Thumbnail size (56x80px)
Icon: size-3 = 12px
Icon: size-3.5 = 14px
Icon: size-4 = 16px
```

### Z-Index
```tsx
z-40  // Floating buttons
z-50  // Dragging elements (above floating buttons)
```

### Border Radius
```tsx
rounded-lg    = 8px
rounded-xl    = 12px
rounded-2xl   = 16px
rounded-full  = 9999px (perfect circle)
```

---

## ✂️ Most Common Patterns in This Project

### 1. **Main Page Structure**
```tsx
<div className="space-y-4">
  <SectionCard title="..." subtitle="...">
    <div className="space-y-3">
      {/* items */}
    </div>
  </SectionCard>
</div>
```

### 2. **List Item Pattern**
```tsx
<div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
  <div className="flex items-center gap-2 min-w-0">
    {/* truncatable content */}
  </div>
  <div className="flex items-center gap-1 shrink-0">
    {/* actions */}
  </div>
</div>
```

### 3. **Floating Button**
```tsx
<button className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/90 px-4 py-2.5">
  {/* icon + text */}
</button>
```

### 4. **Responsive Two-Column**
```tsx
<div className="flex flex-col gap-4 md:flex-row">
  <div className="w-full md:w-56">Left Panel</div>
  <div className="flex-1">Right Panel</div>
</div>
```

### 5. **Import Panel**
```tsx
<div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.03] p-3 space-y-2">
  {/* Panel content */}
  <div className="max-h-40 overflow-y-auto space-y-1">
    {/* Long scrollable list */}
  </div>
</div>
```

---

## 🎓 Design Principles Used

1. **Consistency**: Same padding, borders, and spacing across similar elements
2. **Hierarchy**: `space-y-4` (page) > `space-y-3` (card) > `space-y-1` (list)
3. **Opacity over Color**: Uses white/zinc with opacity instead of hard colors
4. **Minimal Borders**: Very subtle `border-white/5` to `border-white/10`
5. **Accent Highlighting**: Sky blue (`sky-500`) for actionable items
6. **Responsive First**: Mobile-friendly defaults, enhanced on larger screens
7. **Visual Feedback**: Hover states, disabled states, drag states all present

---

## 🚀 When Building New Components

1. Start with `space-y-4` or `space-y-3` for containers
2. Use `p-3` to `p-4` for card padding
3. Combine with `rounded-2xl border border-white/10 bg-white/[0.03]`
4. Add `gap-2` or `gap-3` between flex items
5. Use `hover:bg-white/10` for interactive states
6. Responsive: `md:flex-row` for desktop layouts
7. Text: `text-zinc-300` by default, `text-zinc-500` for secondary


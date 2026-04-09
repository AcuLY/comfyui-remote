# ComfyUI Remote - Layout Quick Reference

## 🎯 Current State at a Glance

| Aspect | Current | Status |
|--------|---------|--------|
| **Max-width all pages** | `max-w-6xl` (1024px) | ✅ Consistent |
| **Horizontal padding** | `px-4` (1rem each side) | ✅ Consistent |
| **Mobile breakpoints** | `sm:` (640px), `md:` (768px) | ⚠️ Minimal |
| **Desktop breakpoints** | `lg:`, `xl:` **NOT USED** | ❌ Missing |
| **Navigation** | Bottom `grid-cols-6` | ❌ Not optimized for desktop |
| **Most responsive page** | Results grid (3→4→5 cols) | ✅ Good example |
| **Least responsive** | Projects list, Trash, Settings | ❌ Always 1 column |

---

## 📱 Page Layout Matrix

```
┌─ ROOT LAYOUT ───────────────────────────────────────────┐
│                                                         │
│  ┌─ HEADER ──────────────────────────────────────────┐ │
│  │ max-w-6xl | flex row | px-4                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ MAIN CONTENT ───────────────────────────────────┐ │
│  │ max-w-6xl | flex col | px-4 py-4 pb-24          │ │
│  │                                                  │ │
│  │  Each page: <div className="space-y-4">         │ │
│  │  - PageHeader                                   │ │
│  │  - SectionCard(s)                               │ │
│  │  - Content (lists, grids, forms)                │ │
│  │                                                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ FOOTER NAV ──────────────────────────────────────┐ │
│  │ max-w-6xl | grid-cols-6 | gap-1 px-2 py-2       │ │
│  │ 6 nav items (dense on desktop)                   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Content Container Patterns

### Pattern 1: Vertical Stack (Most Common)
```tsx
<div className="space-y-4">
  <PageHeader />
  <SectionCard>...</SectionCard>
  <SectionCard>...</SectionCard>
</div>
```
**Used on:** Queue, Projects, Project Detail, Settings, Logs, Trash
**Status:** ❌ No desktop optimization

---

### Pattern 2: Static Grid (Needs Expansion)
```tsx
<div className="grid grid-cols-2 gap-3">  {/* or grid-cols-3 */}
  {/* Items */}
</div>
```
**Used on:** Stats displays, metadata, nav buttons
**Status:** ⚠️ Should add `md:`, `lg:` breakpoints

---

### Pattern 3: Responsive Grid (Best Example)
```tsx
<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
  {/* Images */}
</div>
```
**Used on:** Results gallery
**Status:** ✅ Good responsive progression

---

### Pattern 4: Single Column List
```tsx
<div className="space-y-3">
  {items.map(item => (
    <div className="flex items-center gap-4 p-4">
      {/* Content */}
    </div>
  ))}
</div>
```
**Used on:** Projects, Trash, Settings
**Status:** ❌ Could be 2-column on desktop

---

## 🔲 SectionCard Component

Every major content area wraps in this component:

```tsx
<section className="rounded-3xl border border-white/10 bg-[var(--panel)] p-4">
  <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2>{title}</h2>
      <p className="text-xs text-zinc-400">{subtitle}</p>
    </div>
    {actions}
  </div>
  {children}
</section>
```

**Key measurements:**
- Border radius: `rounded-3xl` (24px)
- Padding: `p-4` (1rem)
- Title text: `text-sm font-semibold`
- Subtitle: `text-xs text-zinc-400`

---

## 📍 Breakpoint Usage Summary

### Currently Used:
```
sm: (640px)
  ├─ monitor/page.tsx: grid-cols-2 → sm:grid-cols-4
  └─ results-grid.tsx: grid-cols-3 → sm:grid-cols-4

md: (768px)
  ├─ project-form.tsx: grid-cols-1 → md:grid-cols-2
  └─ results-grid.tsx: grid-cols-4 → md:grid-cols-5
```

### NOT Used:
```
lg: (1024px)  ❌
xl: (1280px)  ❌
2xl: (1536px) ❌
```

---

## 🎨 Common Layout Issues on Desktop

### Issue 1: Static 2-Column Stats Grid
```tsx
// Current (all screens same)
<div className="grid grid-cols-2 gap-3">
  <StatChip /> <StatChip />
</div>

// Should be:
<div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4">
  <StatChip /> <StatChip /> <StatChip /> <StatChip />
</div>
```

### Issue 2: Static 3-Column Metadata
```tsx
// Current (all screens same)
<div className="grid grid-cols-3 gap-2">
  {/* metadata boxes */}
</div>

// Should be:
<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
  {/* metadata boxes */}
</div>
```

### Issue 3: Single Column Lists Never Expand
```tsx
// Current (always 1 col)
<div className="space-y-3">
  {items.map(item => <div>{item}</div>)}
</div>

// Should support:
<div className="space-y-3 md:grid md:grid-cols-2 md:gap-3">
  {items.map(item => <div>{item}</div>)}
</div>
```

### Issue 4: No Sidebar Navigation
```tsx
// Current: bottom nav with grid-cols-6
// Desktop: Dense, small touch targets

// Better: Sidebar for lg+
<div className="flex gap-4">
  <aside className="hidden lg:flex w-48 flex-col gap-1">
    {/* Vertical nav with full labels */}
  </aside>
  <main className="flex-1">{children}</main>
</div>
```

---

## 📐 Spacing Reference

### Gap Values (space-y, gap)
- `gap-1` / `space-y-1` = 0.25rem (4px)
- `gap-1.5` / `space-y-1.5` = 0.375rem (6px)
- `gap-2` / `space-y-2` = 0.5rem (8px)
- `gap-3` / `space-y-3` = 0.75rem (12px)
- `gap-4` / `space-y-4` = 1rem (16px)
- `gap-6` / `space-y-6` = 1.5rem (24px)

### Padding Values
- `p-2` = 0.5rem (8px)
- `p-3` = 0.75rem (12px)
- `p-4` = 1rem (16px)
- `px-4` = 1rem left + 1rem right

---

## 🎯 Key Container Classes

| Element | Classes | Width | Purpose |
|---------|---------|-------|---------|
| HTML | `h-full antialiased` | 100% | Root container |
| Body | `h-full bg-[var(--bg)] text-[var(--fg)]` | 100% | Body styling |
| Header | `max-w-6xl mx-auto px-4` | 1024px - 32px | Sticky header |
| Main | `max-w-6xl mx-auto px-4 py-4 pb-24` | 1024px - 32px | Content area |
| Footer Nav | `max-w-6xl mx-auto grid-cols-6 px-2 py-2` | 1024px - 16px | Bottom nav |
| SectionCard | `rounded-3xl border p-4` | Content width | Card wrapper |

---

## 🚀 Desktop Optimization Roadmap

### Phase 1: Fix Static Grids (Quick Wins)
- [ ] Queue stats: add `md:grid-cols-4`
- [ ] Queue metadata: add `sm:grid-cols-4 md:grid-cols-6`
- [ ] Run status: add `md:grid-cols-4`
- [ ] Run nav: add `md:grid-cols-4`
- [ ] Trash items: add `md:grid-cols-2`

### Phase 2: Add Desktop Breakpoints
- [ ] Define `lg:` (1024px) strategy
- [ ] Define `xl:` (1280px) strategy
- [ ] Update results grid: `md:grid-cols-5 lg:grid-cols-6`
- [ ] Expand form layouts: `lg:grid-cols-3` or `lg:grid-cols-4`

### Phase 3: Sidebar Navigation
- [ ] Create responsive nav component
- [ ] Hide bottom nav on `lg:`
- [ ] Show sidebar on `lg:`
- [ ] Update main layout with flex gap

### Phase 4: Multi-Column Content Layouts
- [ ] Project detail: form + preview side-by-side
- [ ] Results section: sidebar filters + gallery
- [ ] Settings: categories + details layout

### Phase 5: Increase Max-Width for Ultra-Wide
- [ ] Test at 1920px+
- [ ] Consider `max-w-7xl` for `xl:`
- [ ] Or `max-w-full` with larger padding

---

## 📋 Testing Checklist

Test all pages at these viewport widths:
- [ ] 320px (mobile)
- [ ] 640px (sm breakpoint)
- [ ] 768px (md breakpoint / tablet)
- [ ] 1024px (lg breakpoint / laptop)
- [ ] 1280px (xl breakpoint)
- [ ] 1920px (desktop)

**Check for:**
- [ ] Content not cramped
- [ ] Grids expand appropriately
- [ ] Touch targets adequate (min 44px)
- [ ] No horizontal scroll
- [ ] Text readable at all sizes
- [ ] Spacing balanced

---

## 🔍 File Reference

| File | Purpose | Responsive? |
|------|---------|------------|
| `src/app/layout.tsx` | Root layout | ❌ No |
| `src/components/app-shell.tsx` | Main wrapper | ❌ No |
| `src/components/section-card.tsx` | Card component | ✅ Flexible |
| `src/app/queue/page.tsx` | Queue list | ❌ No |
| `src/app/queue/[runId]/page.tsx` | Run detail | ❌ No |
| `src/app/projects/page.tsx` | Projects list | ❌ No |
| `src/app/projects/new/project-form.tsx` | Project form | ⚠️ Partial |
| `src/app/settings/monitor/page.tsx` | Monitor | ✅ Partial |
| `src/app/projects/.../results-grid.tsx` | Results grid | ✅ Full |

---

## 💡 Design Principles to Apply

1. **Mobile-first:** Base layout always mobile, add complexity at breakpoints
2. **Consistent spacing:** Use `gap-3` and `gap-4` throughout
3. **Responsive grids:** Always provide `sm:`, `md:` alternatives
4. **Max-width containment:** Respect `max-w-6xl` on all pages
5. **Touch-friendly:** Buttons/inputs min 44px tall on mobile
6. **Readable:** Never force users to zoom to read text


# Responsive Design - Quick Start Guide

**Current Status:** Planning only (no changes made)

---

## 🎯 What You Found

Your app uses a **mobile-first Tailwind layout** with these key characteristics:

### Container Structure
- **Root:** `max-w-6xl` (1024px) - too narrow for desktop
- **Padding:** `px-4` (16px) - stays same on all sizes
- **Content:** Single column everywhere

### Current Responsive Classes Used
- `sm:hidden` - hide elements on mobile
- `hidden sm:flex` - show elements on desktop
- **That's it!** No `md:`, `lg:`, or `xl:` classes

### Key Issues Found

| Issue | Impact | Solution |
|-------|--------|----------|
| 1. `max-w-6xl` = 1024px | On 1920px, 896px of unused space | Use `lg:max-w-7xl xl:max-w-8xl` |
| 2. Fixed `grid-cols-3` | Image grid only shows 3 items | Use `md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6` |
| 3. Fixed `grid-cols-2` | Stat chips too narrow | Use `lg:grid-cols-4` |
| 4. All lists vertical | Projects/settings single column | Use `md:grid-cols-2 lg:grid-cols-3` |
| 5. Tiny thumbnails | `/trash` images stay 64px | Use `md:size-20 lg:size-24` |

---

## 📋 Files to Change (In Order)

### Priority 1: Foundation (affects everything)
```
src/components/app-shell.tsx
  Line 26: <div class="mx-auto max-w-6xl px-4 py-3">
    CHANGE TO: <div class="mx-auto max-w-6xl md:max-w-7xl lg:max-w-8xl px-4 md:px-6 lg:px-8 py-3">
  
  Line 35: <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 pb-24">
    CHANGE TO: <div class="mx-auto flex max-w-6xl md:max-w-7xl lg:max-w-8xl flex-col gap-4 px-4 md:px-6 lg:px-8 py-4 pb-24">
```

### Priority 2: Core Components
```
src/components/section-card.tsx
  Line 5: <section class="... p-4 ...">
    CHANGE TO: <section class="... p-4 md:p-6 lg:p-8 ...">
```

### Priority 3: Key Pages (High Impact)

**`/queue` - Queue List Page**
```
src/app/queue/queue-page-client.tsx

Line 151: <div class="grid grid-cols-2 gap-3">
  CHANGE TO: <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">

Line 158: <div class="space-y-3">
  CHANGE TO: <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
```

**`/queue/[runId]` - Review Grid**
```
src/app/queue/[runId]/review-grid.tsx

Line 125: <div class="grid grid-cols-3 gap-3">
  CHANGE TO: <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">

Line 182: <div class="mt-4 grid grid-cols-2 gap-3">
  CHANGE TO: <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
```

**`/projects` - Project List**
```
src/app/projects/page.tsx

Line 21: <div class="space-y-3">
  CHANGE TO: <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
```

**`/queue/[runId]/images/[imageId]` - Image Viewer**
```
src/app/queue/[runId]/images/[imageId]/page.tsx

Line 160: <div class="grid grid-cols-2 gap-3">
  CHANGE TO: <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
```

### Priority 4: Settings & Lists
```
src/app/settings/page.tsx
src/app/assets/loras/page.tsx
src/app/trash/page.tsx
```
Apply similar patterns: Convert `space-y-*` to `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

### Priority 5: Complex Pages (Nice to Have)
```
src/app/projects/[projectId]/sections/[sectionId]/blocks/page.tsx
  → Consider side-by-side form on lg+
  
src/app/projects/[projectId]/page.tsx
  → Could show 2 section cards per row on lg+
```

---

## 🧪 Testing Checklist

After each change, test at:

- [ ] **375px** (Mobile) - Should be single column
- [ ] **640px** (sm) - No change needed, same as mobile
- [ ] **768px** (md) - Should start multi-column (2 cols)
- [ ] **1024px** (lg) - More spacing, 3+ columns
- [ ] **1440px** (xl) - Wider container, larger components
- [ ] **1920px** (2xl) - Full width optimization

**Browser DevTools:** Use device emulation or drag browser window

---

## 🔧 Simple Template

When you're ready to update, use this pattern repeatedly:

```jsx
// BEFORE:
<div class="space-y-3">
  {items.map(item => <Card />)}
</div>

// AFTER:
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  {items.map(item => <Card />)}
</div>
```

Or for scaling grids:
```jsx
// BEFORE:
<div class="grid grid-cols-3 gap-3">

// AFTER:
<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
```

---

## 📊 Expected Results After Changes

### `/queue` Page
- **Mobile (375px):** 2 stat chips per row, 1 run card per row
- **Desktop (1024px):** 4 stat chips per row, 3 run cards per row
- **Wide (1440px):** Full width with breathing room

### `/queue/[runId]` Review Grid
- **Mobile:** 2 images per row (3×4 aspect ratio)
- **Tablet:** 4 images per row
- **Desktop:** 5 images per row
- **Wide:** 6 images per row

### `/projects` List
- **Mobile:** 1 project card per row
- **Tablet:** 2 project cards per row
- **Desktop:** 3 project cards per row

---

## ⚠️ Important Notes

1. **Don't rush:** Test after each change
2. **Mobile first:** All Tailwind classes start with mobile layout, then add breakpoints
3. **Use gaps:** Prefer `gap-3` over margins for consistency
4. **Container widths:** 
   - `max-w-6xl` = 1024px
   - `max-w-7xl` = 1280px
   - `max-w-8xl` = 1408px (Tailwind v3/v4 default)
5. **Padding scale:**
   - Mobile: `px-4` (16px)
   - Tablet: `md:px-6` (24px)
   - Desktop: `lg:px-8` (32px)

---

## 📌 All Changed Lines at a Glance

```
app-shell.tsx:
  Line 26 & 35: Add md:max-w-7xl lg:max-w-8xl px-6 lg:px-8

section-card.tsx:
  Line 5: Add md:p-6 lg:p-8

queue-page-client.tsx:
  Line 151: md:grid-cols-3 lg:grid-cols-4
  Line 158: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3

review-grid.tsx:
  Line 125: md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6
  Line 182: lg:grid-cols-4

projects/page.tsx:
  Line 21: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3

[imageId]/page.tsx:
  Line 160: md:grid-cols-4 lg:grid-cols-6

settings/page.tsx:
  Line 30: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3

trash/page.tsx:
  Line 13: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 (for items)
  Line 32: md:size-20 lg:size-24 (for thumbnails)
```

---

## 🚀 Next Steps

1. ✅ You've identified all the issues (done!)
2. ⏳ Ready to implement when you say go
3. Test at each breakpoint
4. Commit with message: "refactor: add responsive breakpoints for desktop"

**Status:** Awaiting your approval to proceed! 🎯


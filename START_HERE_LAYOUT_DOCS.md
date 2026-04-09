# 🎯 START HERE - Layout Documentation Guide

## What's In This Folder?

You have **comprehensive documentation** about how the ComfyUI Remote layout and display system works.

### Choose Your Entry Point:

#### 📖 **"Just tell me the key facts in 5 minutes"**
→ Read: **`LAYOUT_DOCUMENTATION_SUMMARY.txt`**
- Quick overview of all layouts
- Key grid patterns
- Component file map
- Tailwind cheatsheet

---

#### 🎨 **"I want to see visual diagrams"**
→ Read: **`LAYOUT_VISUAL_GUIDE.md`**
- ASCII box diagrams of all pages
- Hierarchy trees and nesting
- Component structure visuals
- CSS classes at a glance

---

#### ⚡️ **"I need to write code NOW"**
→ Open: **`QUICK_REFERENCE.md`**
- 7 copy-paste ready JSX patterns
- Complete image grid code
- Tailwind lookup table
- File locations

**Use this while coding!**

---

#### 📚 **"I need complete understanding"**
→ Read: **`LAYOUT_ANALYSIS.md`**
- Every page analyzed in detail
- All JSX structure with classNames
- Complete component breakdown
- Color system documentation
- Responsive behavior notes

---

#### 🗂️ **"I'm confused - where do I start?"**
→ Read: **`LAYOUT_DOCS_INDEX.md`**
- Navigation guide for all docs
- Use cases mapped to documents
- Quick facts and insights
- CSS cheatsheet

---

## The 30-Second Version

### Main Findings:
- ✅ **Queue page** (`/queue`): Vertical stack of cards
- ✅ **Review page** (`/queue/[runId]`): **3-column image grid** ⭐️
- ✅ **Image page** (`/queue/[runId]/images/[imageId]`): Full-width single column

### Main Image Grid (The Star):
```jsx
<div className="grid grid-cols-3 gap-3">
  {images.map((image) => (
    <div className="relative rounded-2xl border border-white/10">
      {/* Image with aspect-[3/4] */}
      {/* Checkbox overlay (top-left) */}
      {/* Status badge overlay (bottom) */}
    </div>
  ))}
</div>
```

### Key CSS Classes:
- Grids: `grid-cols-1`, `grid-cols-2`, `grid-cols-3`, `grid-cols-6`
- Gaps: `gap-1` (4px), `gap-2` (8px), `gap-3` (12px), `gap-4` (16px)
- Rounded: `rounded-2xl` (16px) for cards, `rounded-[28px]` (28px) for large
- Borders: `border-white/10` (default)

---

## Document Quick Reference

| Document | When to Read | Time |
|----------|--------------|------|
| `LAYOUT_DOCUMENTATION_SUMMARY.txt` | Need overview | 5 min |
| `QUICK_REFERENCE.md` | Writing code | 10 min |
| `LAYOUT_VISUAL_GUIDE.md` | Need diagrams | 12 min |
| `LAYOUT_ANALYSIS.md` | Deep dive needed | 20 min |
| `LAYOUT_DOCS_INDEX.md` | Navigating docs | 3 min |

---

## If You Only Read One Document

**Read: `LAYOUT_ANALYSIS.md`**

It contains everything, but here's what to focus on:
1. Section 1 - AppShell (page structure)
2. Section 4 - ReviewGrid (image gallery) ⭐️
3. Section 6 - Grid patterns summary table
4. Section 8 - Color & visual system

---

## If You're Modifying Code

**Have these open:**
1. `QUICK_REFERENCE.md` (left side for patterns)
2. `LAYOUT_VISUAL_GUIDE.md` (quick visual lookup)
3. Source file: `src/app/queue/[runId]/review-grid.tsx`

---

## The Main Layout Structure

```
AppShell (max-w-6xl container)
├── Header (fixed at top)
├── Main Content
│   ├── /queue page
│   │   └── Vertical stack of cards (space-y-3)
│   ├── /queue/[runId] page
│   │   └── 3-COLUMN IMAGE GRID ⭐️
│   └── /queue/[runId]/images/[imageId] page
│       └── Full-width single image
└── Bottom Nav (fixed 6-column grid)
```

---

## Key Takeaways

✅ **3-column grid** is used for the main image gallery
✅ **No responsive breakpoints** currently (mobile-first design)
✅ **Pure Tailwind** + Lucide icons (no UI library)
✅ **Dark theme** with white/10 borders
✅ **Consistent spacing**: gap-3 (12px) for most layouts

---

## Next Steps

1. **First time?** 
   - Read: `LAYOUT_DOCUMENTATION_SUMMARY.txt` (5 min)
   
2. **Need details?** 
   - Read: `LAYOUT_ANALYSIS.md` (20 min)
   
3. **Writing code?** 
   - Open: `QUICK_REFERENCE.md` in another window

4. **Need visuals?**
   - Check: `LAYOUT_VISUAL_GUIDE.md`

---

## Questions Answered

- ❓ "How are queue items listed?" 
  → Vertical cards (space-y-3)

- ❓ "How are images displayed?"
  → 3-column grid (grid-cols-3 gap-3) ⭐️

- ❓ "Single image layout?"
  → Full-width with overlays

- ❓ "Any multi-column layouts?"
  → Yes! Image grid is 3 columns + others

- ❓ "Show me the JSX?"
  → Check QUICK_REFERENCE.md

---

Generated: 2026-04-09  
Status: Complete ✅  
Ready to use! 🚀


# Quick Reference - Layout & JSX Patterns

## File Locations
| File | Purpose |
|------|---------|
| `src/app/queue/page.tsx` | Server-side queue page wrapper |
| `src/app/queue/queue-page-client.tsx` | Client component - tabs, list, stats |
| `src/app/queue/[runId]/page.tsx` | Server-side single group view |
| `src/app/queue/[runId]/review-grid.tsx` | **Main image grid component** (3-col) |
| `src/app/queue/[runId]/images/[imageId]/page.tsx` | Single image fullscreen view |
| `src/components/section-card.tsx` | Card wrapper with title/subtitle |
| `src/components/app-shell.tsx` | Main layout wrapper (header/nav) |

---

## Key JSX Patterns to Copy

### 1. Main Container
```jsx
<div className="space-y-4">
  {/* Content with 16px gaps between major sections */}
</div>
```

### 2. Section Card
```jsx
<SectionCard title="Title" subtitle="Subtitle">
  <div className="grid grid-cols-3 gap-3">
    {/* 3-column grid content */}
  </div>
</SectionCard>
```

### 3. 2-Column Grid (Stats/Buttons)
```jsx
<div className="grid grid-cols-2 gap-3">
  <div>Left</div>
  <div>Right</div>
</div>
```

### 4. 3-Column Image Grid ⭐️
```jsx
<div className="grid grid-cols-3 gap-3">
  {images.map((image) => (
    <div
      key={image.id}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel-soft)] transition"
    >
      <Image
        src={image.src}
        alt={image.id}
        width={400}
        height={560}
        className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]"
        unoptimized
      />
    </div>
  ))}
</div>
```

### 5. Button Grid (Actions)
```jsx
<div className="grid grid-cols-2 gap-3">
  <button className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
    Keep
  </button>
  <button className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm">
    Delete
  </button>
</div>
```

### 6. Vertical Stack (Cards)
```jsx
<div className="space-y-3">
  {items.map((item) => (
    <Link href={`/${item.id}`} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {/* Card content */}
    </Link>
  ))}
</div>
```

### 7. Status Badge
```jsx
<span className={`rounded-full border px-2 py-0.5 text-[11px] ${
  image.status === "kept"
    ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
    : image.status === "trashed"
      ? "border-rose-500/30 bg-rose-500/20 text-rose-300"
      : "border-white/10 bg-black/30"
}`}>
  {image.status}
</span>
```

---

## Tailwind Classes Quick Lookup

### Gaps & Spacing
| Class | Size |
|-------|------|
| `gap-1` | 4px |
| `gap-2` | 8px |
| `gap-3` | 12px |
| `gap-4` | 16px |
| `space-y-3` | 12px between children |
| `space-y-4` | 16px between children |

### Grid Columns
| Class | Columns |
|-------|---------|
| `grid-cols-1` | 1 |
| `grid-cols-2` | 2 |
| `grid-cols-3` | 3 |
| `grid-cols-6` | 6 (bottom nav) |

### Rounded Corners
| Class | Size |
|-------|------|
| `rounded-lg` | 8px |
| `rounded-xl` | 12px |
| `rounded-2xl` | 16px |
| `rounded-3xl` | 24px |
| `rounded-[28px]` | 28px |

### Colors
| Situation | Class |
|-----------|-------|
| Default border | `border-white/10` |
| Subtle border | `border-white/5` |
| Default bg | `bg-white/[0.03]` |
| Hover bg | `bg-white/[0.06]` |
| Keep/Positive | `border-emerald-500/20 bg-emerald-500/10 text-emerald-300` |
| Delete/Negative | `border-rose-500/20 bg-rose-500/10 text-rose-300` |

---

## Image Grid Deep Dive

### Container
```jsx
<div className="grid grid-cols-3 gap-3">
  {/* 3 equal-width columns, 12px gap */}
</div>
```

### Per-Item Structure
```jsx
<div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel-soft)]">
  {/* Overlay for checkbox + label */}
  <div className="absolute left-2 top-2 z-10 flex items-center gap-2">
    <button className="flex size-5 items-center justify-center rounded border">
      <Check className="size-3" />
    </button>
    <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
      {image.label}
    </span>
  </div>

  {/* Image with 3:4 aspect ratio */}
  <Image
    src={image.src}
    alt={image.id}
    width={400}
    height={560}
    className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]"
    unoptimized
  />

  {/* Bottom overlay with status + link */}
  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8">
    <span className="rounded-full border px-2 py-0.5 text-[10px]">
      {image.status}
    </span>
    <Link href={`/queue/${runId}/images/${image.id}`}>
      <Expand className="size-3" /> 查看
    </Link>
  </div>
</div>
```

### Selection State (Active)
```jsx
className={`group relative overflow-hidden rounded-2xl border transition ${
  isSelected ? "border-sky-400/50 ring-2 ring-sky-400/30" : "border-white/10"
}`}
```

---

## Common Patterns

### Page Layout Template
```jsx
export default function PageName() {
  return (
    <div className="space-y-4">
      <PageHeader title="Title" description="Description" />

      <SectionCard title="Section 1" subtitle="Subtitle">
        <div className="grid grid-cols-2 gap-3">
          {/* Content */}
        </div>
      </SectionCard>

      <SectionCard title="Section 2">
        <div className="space-y-3">
          {/* Content */}
        </div>
      </SectionCard>
    </div>
  );
}
```

### Link Card Pattern
```jsx
<Link
  href={`/${item.id}`}
  className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
>
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-sm font-semibold text-white">{item.title}</div>
      <div className="mt-1 text-xs text-zinc-400">{item.subtitle}</div>
    </div>
    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px]">
      {item.status}
    </span>
  </div>
</Link>
```

### Flex with Icon + Text
```jsx
<div className="flex items-center gap-2 text-sm text-zinc-300">
  <ArrowLeft className="size-4" />
  Back
</div>
```

---

## Responsive Considerations

### Currently NOT Responsive
- Image grid is fixed at 3 columns
- Button/stat grids are fixed at 2 columns
- Queue list is fixed at 1 column

### To Make Responsive (Future)
```jsx
{/* Image grid responsive */}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">

{/* Buttons responsive */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

{/* Stats responsive */}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
```

---

## CSS Variables Used
- `--panel`: Main panel background
- `--panel-soft`: Softer panel background variant

---

## Import Statements
```jsx
// Icons from lucide-react
import { Check, ChevronLeft, ChevronRight, Expand, ArrowLeft, Download, Ellipsis } from "lucide-react";

// Next Image component
import Image from "next/image";

// Next Link
import Link from "next/link";

// Server data functions
import { getReviewGroup, getReviewGroupIds } from "@/lib/server-data";

// Components
import { SectionCard } from "@/components/section-card";
import { PageHeader } from "@/components/page-header";
```

---

## State Management Patterns

### Selection State (ReviewGrid)
```jsx
const [selected, setSelected] = useState<Set<string>>(new Set());

function toggleSelect(id: string) {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

const selectedCount = selected.size;
```

### Pending State (ReviewGrid)
```jsx
const pendingImages = images.filter((img) => img.status === "pending");
const remainingPendingIds = pendingImages
  .filter((img) => !selected.has(img.id))
  .map((img) => img.id);
```

---

## Element Overlay Pattern (Absolute Positioning)

### Top-left overlay (checkbox + label)
```jsx
<div className="absolute left-2 top-2 z-10 flex items-center gap-2">
  {/* Content */}
</div>
```

### Bottom overlay (status + link)
```jsx
<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8">
  {/* Content */}
</div>
```


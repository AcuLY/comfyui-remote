export default function SectionResultsLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-8 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-8 w-16 animate-pulse rounded-xl bg-white/10" />
          <div className="h-8 w-16 animate-pulse rounded-xl bg-white/10" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-64 animate-pulse rounded bg-white/10" />
        {/* Image grid skeleton */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[3/4] animate-pulse rounded-xl bg-white/[0.06]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

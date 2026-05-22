export default function QueueRunLoading() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>

      {/* Section card skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
      </div>

      {/* Image grid skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-white/10" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 w-28 animate-pulse rounded-2xl bg-white/[0.06]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

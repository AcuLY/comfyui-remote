export default function ProjectDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Toolbar skeleton */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b border-white/[0.06] bg-[var(--bg)]/80 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex-1" />
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-white/10" />
        </div>
      </div>

      {/* Section cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}

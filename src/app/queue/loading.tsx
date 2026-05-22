export default function QueueLoading() {
  return (
    <div className="space-y-4">
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded-lg bg-white/10" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-white/10" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-white/10" />
      </div>

      {/* Queue items skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  );
}

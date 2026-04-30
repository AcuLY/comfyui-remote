import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="-mx-5 min-h-[calc(100dvh-5rem)] w-[calc(100%+2.5rem)] sm:-mx-6 sm:w-[calc(100%+3rem)]">
      <div className="flex h-full">
        <aside className="hidden w-56 shrink-0 border-r border-white/5 p-3 md:block">
          <Skeleton className="mb-4 h-16 w-full rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </aside>
        <main className="flex-1 px-4 py-4 sm:px-6">
          <Skeleton className="mb-4 h-12 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 12 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

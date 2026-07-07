import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ProjectLoadingActionBar({
  buttonWidths,
  className,
  itemClassName,
}: {
  buttonWidths: string[];
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={cn("flex gap-2", className)}>
      {buttonWidths.map((width, index) => (
        <Skeleton
          key={`${width}-${index}`}
          className={cn("h-8 rounded-xl bg-white/10", width, itemClassName)}
        />
      ))}
    </div>
  );
}

export function ProjectLoadingBlock({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function ProjectLoadingGrid({
  count,
  className,
  itemClassName,
}: {
  count: number;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={itemClassName} />
      ))}
    </div>
  );
}

export function ProjectLoadingSidebar({
  itemCount = 8,
  className,
}: {
  itemCount?: number;
  className?: string;
}) {
  return (
    <aside className={cn("hidden w-56 shrink-0 border-r border-white/5 p-3 md:block", className)}>
      <ProjectLoadingBlock className="mb-4 h-16 w-full rounded-xl" />
      <ProjectLoadingGrid
        count={itemCount}
        className="space-y-2"
        itemClassName="h-9 w-full rounded-lg"
      />
    </aside>
  );
}

"use client";

type QueueReviewSelectionToolbarProps = {
  allSelected: boolean;
  pendingCount: number;
  selectedCount: number;
  onToggleSelectAll: () => void;
  onSelectPending: () => void;
};

export function QueueReviewSelectionToolbar({
  allSelected,
  pendingCount,
  selectedCount,
  onToggleSelectAll,
  onSelectPending,
}: QueueReviewSelectionToolbarProps) {
  return (
    <div className="mb-3 flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={onToggleSelectAll}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
      >
        {allSelected ? "取消全选" : "全选"}
      </button>
      <button
        type="button"
        onClick={onSelectPending}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-zinc-300 transition hover:bg-white/[0.08]"
      >
        选中待审核 ({pendingCount})
      </button>
      {selectedCount > 0 && (
        <span className="ml-auto text-sky-300">已选 {selectedCount} 张</span>
      )}
    </div>
  );
}

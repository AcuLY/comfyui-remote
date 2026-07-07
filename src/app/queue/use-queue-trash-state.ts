"use client";

import { useCallback, useEffect, useMemo, useState, type TransitionStartFunction } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearTrash } from "@/lib/actions/image-review";
import type { TrashItem, TrashPagination } from "@/lib/types";

type UseQueueTrashStateOptions = {
  initialTrashItems?: TrashItem[];
  initialTrashPagination: TrashPagination;
  isPending: boolean;
  startTransition: TransitionStartFunction;
  refreshTrashPage: (page: number) => void;
};

type TrashRefreshData = {
  trashItems?: TrashItem[];
  trashPagination?: TrashPagination;
};

export function useQueueTrashState({
  initialTrashItems,
  initialTrashPagination,
  isPending,
  startTransition,
  refreshTrashPage,
}: UseQueueTrashStateOptions) {
  const router = useRouter();
  const [trashItems, setTrashItems] = useState<TrashItem[]>(initialTrashItems ?? []);
  const [trashPagination, setTrashPagination] = useState<TrashPagination>(initialTrashPagination);

  useEffect(() => {
    setTrashItems(initialTrashItems ?? []);
    setTrashPagination(initialTrashPagination);
  }, [initialTrashItems, initialTrashPagination]);

  const trashCount = trashPagination.totalItems;
  const trashVisiblePages = useMemo(
    () =>
      Array.from(
        new Set([
          1,
          trashPagination.page - 1,
          trashPagination.page,
          trashPagination.page + 1,
          trashPagination.totalPages,
        ]),
      ).filter((page) => page >= 1 && page <= trashPagination.totalPages),
    [trashPagination.page, trashPagination.totalPages],
  );

  const applyTrashRefresh = useCallback((data: TrashRefreshData) => {
    if (Array.isArray(data.trashItems)) {
      setTrashItems(data.trashItems);
    }
    if (data.trashPagination) {
      setTrashPagination(data.trashPagination);
    }
  }, []);

  const handleTrashPageChange = useCallback((page: number) => {
    const nextPage = Math.min(Math.max(1, page), trashPagination.totalPages);
    if (nextPage === trashPagination.page || isPending) return;
    refreshTrashPage(nextPage);
  }, [isPending, refreshTrashPage, trashPagination.page, trashPagination.totalPages]);

  const handleRestore = useCallback((item: TrashItem) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/images/${encodeURIComponent(item.imageResultId)}/restore`, {
          method: "POST",
        });
        const result = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: { message?: string };
        } | null;

        if (!response.ok || result?.ok === false) {
          throw new Error(result?.error?.message ?? "恢复失败");
        }

        setTrashItems((prev) => prev.filter((trashItem) => trashItem.id !== item.id));
        setTrashPagination((prev) => {
          const totalItems = Math.max(0, prev.totalItems - 1);
          const totalPages = Math.max(1, Math.ceil(totalItems / prev.pageSize));
          const page = Math.min(prev.page, totalPages);
          const startIndex = (page - 1) * prev.pageSize;
          return {
            ...prev,
            page,
            totalItems,
            totalPages,
            startItem: totalItems === 0 ? 0 : startIndex + 1,
            endItem: Math.min(Math.max(startIndex, prev.endItem - 1), totalItems),
          };
        });
        refreshTrashPage(trashPagination.page);
        toast.success("图片已恢复");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "恢复失败");
      }
    });
  }, [refreshTrashPage, startTransition, trashPagination.page]);

  const handleClearTrash = useCallback(() => {
    if (trashCount === 0) return;
    if (
      !confirm(
        `确定要永久清空回收站中的 ${trashCount} 张图片吗？此操作不可恢复。`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await clearTrash();
      if (result.ok) {
        setTrashItems([]);
        setTrashPagination((prev) => ({
          ...prev,
          page: 1,
          totalItems: 0,
          totalPages: 1,
          startItem: 0,
          endItem: 0,
        }));
        const suffix =
          result.fileDeleteFailures > 0
            ? `，其中 ${result.fileDeleteFailures} 个文件未能删除`
            : "";
        toast.success(`已清空 ${result.count} 张图片${suffix}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "清空回收站失败");
      }
    });
  }, [router, startTransition, trashCount]);

  return {
    trashItems,
    trashPagination,
    trashCount,
    trashVisiblePages,
    applyTrashRefresh,
    handleTrashPageChange,
    handleRestore,
    handleClearTrash,
  };
}

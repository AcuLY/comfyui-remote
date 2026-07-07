"use client";

import { useEffect } from "react";
import { toast } from "sonner";

type UseQueueReviewKeyboardShortcutsOptions = {
  lightboxOpen: boolean;
  prevRunId: string | null;
  nextRunId: string | null;
  reviewImageCount: number;
  navigateDocument: (href: string) => void;
  openLightbox: () => void;
  onUndoTrash: () => void;
  onTrashCurrentRun: () => void;
};

export function useQueueReviewKeyboardShortcuts({
  lightboxOpen,
  prevRunId,
  nextRunId,
  reviewImageCount,
  navigateDocument,
  openLightbox,
  onUndoTrash,
  onTrashCurrentRun,
}: UseQueueReviewKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key;

      if (key === "s" || key === "S" || key === "ArrowLeft") {
        event.preventDefault();
        if (prevRunId) navigateDocument(`/queue/${prevRunId}`);
        return;
      }

      if (key === "f" || key === "F" || key === "ArrowRight") {
        event.preventDefault();
        if (nextRunId) navigateDocument(`/queue/${nextRunId}`);
        return;
      }

      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        const editorLink = document.querySelector<HTMLAnchorElement>("[data-nav-editor]");
        if (editorLink) editorLink.click();
        return;
      }

      if ("12345".includes(event.key)) {
        event.preventDefault();
        const bsMap: Record<string, number> = { "1": 1, "2": 2, "3": 4, "4": 8, "5": 16 };
        const bs = bsMap[event.key];
        if (bs !== undefined) {
          const batchButton = document.querySelector<HTMLButtonElement>(`[data-batch-size="${bs}"]`);
          if (batchButton) {
            batchButton.click();
            toast.dismiss("batch-size");
            toast(`Batch size: ${bs}`, { id: "batch-size", duration: 2000 });
          }
        }
        return;
      }

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        const runButton = document.querySelector<HTMLButtonElement>("[data-queue-run-section]");
        if (runButton) runButton.click();
        return;
      }

      if (key === "i" || key === "I" || key === "d" || key === "D") {
        event.preventDefault();
        if (reviewImageCount > 0) openLightbox();
        return;
      }

      if ((key === "z" || key === "Z") && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onUndoTrash();
        return;
      }

      if (event.key === "x" || event.key === "X") {
        if (event.repeat) return;
        event.preventDefault();
        onTrashCurrentRun();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    lightboxOpen,
    navigateDocument,
    nextRunId,
    onTrashCurrentRun,
    onUndoTrash,
    openLightbox,
    prevRunId,
    reviewImageCount,
  ]);
}

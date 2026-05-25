"use client";

import { RefreshCw } from "lucide-react";
import { useTaskPanel } from "@/components/task-panel";

export function CandidateAddButton({
  image,
}: {
  image: { id: string; relativePath: string | null; generationRunId: string };
}) {
  const { pushBaseImage, setOpen } = useTaskPanel();

  return (
    <button
      type="button"
      onClick={() => {
        pushBaseImage({
          id: image.id,
          label: image.id.slice(0, 6),
          relativePath: image.relativePath ?? "",
          generationRunId: image.generationRunId,
        });
        setOpen(true);
      }}
      title="加入生图面板"
      className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 text-[11px] text-violet-200 transition hover:bg-violet-500/20"
    >
      <RefreshCw className="size-3" />
      重生
    </button>
  );
}

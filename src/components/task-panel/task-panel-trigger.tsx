"use client";

import { ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-panel-provider";

export function TaskPanelTrigger() {
  const { isOpen, setOpen, activeTaskCount, activeTasks } = useTaskPanel();

  const hasRunning = activeTasks.some((t) => t.status === "running");

  // Hide on lg when panel is open (since the panel is visible as a drawer)
  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "fixed bottom-20 right-4 z-40 flex size-12 items-center justify-center rounded-full",
        "bg-zinc-800/90 border border-white/10 shadow-lg shadow-black/40",
        "backdrop-blur-sm transition-all duration-200",
        "hover:bg-zinc-700/90 hover:scale-105 hover:border-white/15",
        "active:scale-95",
        // Hide on lg when panel would be shown inline
        "lg:hidden",
        // Pulsing ring when tasks are running
        hasRunning && "ring-2 ring-sky-400/50 animate-pulse",
      )}
      aria-label="打开生图面板"
    >
      <ImagePlus className="size-5 text-zinc-200" />

      {/* Badge */}
      {activeTaskCount > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 flex size-5 items-center justify-center",
            "rounded-full text-[10px] font-bold tabular-nums",
            hasRunning
              ? "bg-sky-500 text-white"
              : "bg-zinc-600 text-zinc-200",
          )}
        >
          {activeTaskCount > 9 ? "9+" : activeTaskCount}
        </span>
      )}
    </button>
  );
}

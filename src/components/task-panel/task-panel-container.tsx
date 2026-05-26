"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-panel-provider";
import { TaskPanelTrigger } from "./task-panel-trigger";
import { TaskPanelContent } from "./task-panel-content";

export function TaskPanelContainer() {
  const { isOpen, setOpen, activeTasks } = useTaskPanel();
  const hasRunning = activeTasks.some((t) => t.status === "running");

  // Lock body scroll when panel is open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return (
    <>
      {/* FAB trigger */}
      <TaskPanelTrigger />

      {/* Backdrop (only visible on sm+ where panel doesn't fill full width) */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 hidden sm:block",
          isOpen ? "sm:opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Panel: right-side drawer on all sizes */}
      <aside
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden border-l",
          "bg-[var(--panel,#111217)] shadow-2xl shadow-black/50",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",

          // Width: full on mobile, 85vw on sm, 360px on md+
          "w-full sm:w-[85vw] md:w-[360px]",

          // Slide in/out
          isOpen ? "translate-x-0" : "translate-x-full",

          // Border color
          hasRunning ? "border-sky-400/40" : "border-white/[0.06]",
        )}
        role="complementary"
        aria-label="生图任务面板"
      >
        {/* Running tasks gradient accent (left border) */}
        {hasRunning && (
          <div
            className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ background: "linear-gradient(to bottom, #38bdf8, #a78bfa)" }}
          />
        )}

        {/* Content */}
        <TaskPanelContent />
      </aside>
    </>
  );
}

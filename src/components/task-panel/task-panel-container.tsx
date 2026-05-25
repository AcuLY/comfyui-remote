"use client";

import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-panel-provider";
import { TaskPanelTrigger } from "./task-panel-trigger";
import { TaskPanelContent } from "./task-panel-content";

export function TaskPanelContainer() {
  const { isOpen, setOpen, activeTasks } = useTaskPanel();

  const hasRunning = activeTasks.some((t) => t.status === "running");

  return (
    <>
      {/* FAB trigger */}
      <TaskPanelTrigger />

      {/* Backdrop (below lg only) */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Panel shell */}
      <aside
        className={cn(
          "fixed z-40 flex flex-col overflow-hidden",
          "bg-[var(--panel,#111217)] shadow-2xl shadow-black/50",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",

          // --- Desktop (lg+): right-side drawer ---
          "lg:top-0 lg:right-0 lg:bottom-0 lg:w-[360px] lg:border-l",
          isOpen ? "lg:translate-x-0" : "lg:translate-x-full",

          // --- Mobile/tablet (<lg): bottom sheet ---
          "max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[75vh] max-lg:rounded-t-2xl max-lg:border-t",
          isOpen ? "max-lg:translate-y-0" : "max-lg:translate-y-full",

          // Border color: gradient accent when running, subtle otherwise
          hasRunning
            ? "border-sky-400/40"
            : "border-white/[0.06]",
        )}
        // Accessible panel role
        role="complementary"
        aria-label="生图任务面板"
      >
        {/* Running tasks gradient accent (left border on lg, top border on mobile) */}
        {hasRunning && (
          <>
            {/* Left accent for desktop */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5 hidden lg:block"
              style={{
                background: "linear-gradient(to bottom, #38bdf8, #a78bfa)",
              }}
            />
            {/* Top accent for mobile */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5 lg:hidden"
              style={{
                background: "linear-gradient(to right, #38bdf8, #a78bfa)",
              }}
            />
          </>
        )}

        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-2 pb-0 lg:hidden">
          <div className="h-1 w-8 rounded-full bg-white/20" />
        </div>

        {/* Content */}
        <TaskPanelContent />
      </aside>
    </>
  );
}

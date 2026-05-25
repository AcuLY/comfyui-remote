"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTaskPanel } from "./task-panel-provider";
import { TaskPanelForm } from "./task-panel-form";
import { TaskPanelTaskList } from "./task-panel-task-list";

export function TaskPanelContent() {
  const { setOpen, activeTaskCount, baseImages, removeBaseImage, formConfig } =
    useTaskPanel();

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-zinc-200">生图</h2>
          {activeTaskCount > 0 && (
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold tabular-nums text-sky-300">
              {activeTaskCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-300"
          aria-label="关闭面板"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Base images strip */}
        {baseImages.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              基准图片 ({baseImages.length})
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {baseImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative shrink-0"
                >
                  <img
                    src={`/api/character-lora-training/jobs/${formConfig?.jobId}/artifacts/image?path=${encodeURIComponent(img.relativePath)}&w=120&q=60`}
                    alt={img.label}
                    className="size-14 rounded-lg border border-white/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeBaseImage(img.id)}
                    className={cn(
                      "absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center",
                      "rounded-full bg-zinc-800 border border-white/10 text-zinc-400",
                      "opacity-0 transition group-hover:opacity-100",
                      "hover:bg-rose-900/50 hover:text-rose-300 hover:border-rose-500/30",
                    )}
                    aria-label={`移除 ${img.label}`}
                  >
                    <X className="size-2.5" />
                  </button>
                  {img.canonicalView && (
                    <span className="absolute bottom-0 inset-x-0 rounded-b-lg bg-black/60 px-1 py-0.5 text-center text-[9px] text-zinc-400">
                      {img.canonicalView}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
        <TaskPanelForm />

        {/* Task list */}
        <TaskPanelTaskList />
      </div>
    </div>
  );
}

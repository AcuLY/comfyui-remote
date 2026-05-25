"use client";

import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import { SfwModeProvider } from "@/components/sfw-mode-provider";
import { TaskPanelProvider, TaskPanelContainer } from "@/components/task-panel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TaskPanelProvider>
      <SfwModeProvider />
      <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 overflow-x-hidden px-3 py-4 pb-24 sm:px-6 lg:mr-0 transition-[margin] duration-300">
        {children}
      </main>
      <PersistentBottomNav />
      <TaskPanelContainer />
      <Toaster
        theme="dark"
        position="top-right"
        closeButton
        visibleToasts={3}
        toastOptions={{
          duration: 3000,
          style: { background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7" },
          closeButton: true,
          closeButtonAriaLabel: "关闭通知",
          classNames: {
            toast: "!pr-10",
            closeButton:
              "!top-1/2 !h-6 !w-6 !border-white/10 !bg-white/5 !text-zinc-300 [--toast-close-button-end:0.5rem] [--toast-close-button-start:auto] [--toast-close-button-transform:translateY(-50%)] hover:!border-white/20 hover:!bg-white/10 hover:!text-white",
          },
        }}
      />
    </TaskPanelProvider>
  );
}

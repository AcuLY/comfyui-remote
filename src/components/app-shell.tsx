"use client";

import { Toaster } from "sonner";
import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import { SfwModeProvider } from "@/components/sfw-mode-provider";
import { TaskPanelProvider, TaskPanelContainer } from "@/components/task-panel";
import { NotificationCopyButtons } from "@/components/notification-copy-buttons";
import {
  resolveStoredWorkMode,
  resolveWorkModeForPathname,
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  type WorkMode,
} from "@/lib/work-mode";

function subscribeWorkMode(onStoreChange: () => void) {
  window.addEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getStoredWorkModeSnapshot() {
  return resolveStoredWorkMode(window.localStorage.getItem(WORK_MODE_STORAGE_KEY));
}

function getStoredWorkModeServerSnapshot(): WorkMode {
  return "generation";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const storedWorkMode = useSyncExternalStore(
    subscribeWorkMode,
    getStoredWorkModeSnapshot,
    getStoredWorkModeServerSnapshot,
  );
  const workMode = resolveWorkModeForPathname(pathname, storedWorkMode);

  return (
    <TaskPanelProvider>
      <SfwModeProvider />
      <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 overflow-x-hidden px-3 py-4 pb-24 sm:px-6">
        {children}
      </main>
      <PersistentBottomNav />
      {workMode === "generation" ? <TaskPanelContainer /> : null}
      <NotificationCopyButtons />
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
            toast: "!pr-20",
            closeButton:
              "!top-1/2 !h-6 !w-6 !border-white/10 !bg-white/5 !text-zinc-300 [--toast-close-button-end:0.5rem] [--toast-close-button-start:auto] [--toast-close-button-transform:translateY(-50%)] hover:!border-white/20 hover:!bg-white/10 hover:!text-white",
          },
        }}
      />
    </TaskPanelProvider>
  );
}

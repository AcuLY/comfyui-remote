"use client";

import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import { SfwModeProvider } from "@/components/sfw-mode-provider";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SfwModeProvider />
      <main className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-4 pb-24 sm:px-6">
        {children}
      </main>
      <PersistentBottomNav />
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
        }}
      />
    </>
  );
}

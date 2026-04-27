import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7" },
        }}
      />
      <main id="app-main-scroll" className="app-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 pb-24">{children}</div>
      </main>
      <PersistentBottomNav />
    </div>
  );
}

import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-4 pb-24 sm:px-6">
        {children}
      </main>
      <PersistentBottomNav />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7" },
        }}
      />
    </>
  );
}

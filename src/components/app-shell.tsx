import { Toaster } from "sonner";
import type { ReactNode } from "react";
import { PersistentBottomNav } from "@/components/persistent-bottom-nav";
import { CustomScrollContainer } from "@/components/ui/custom-scroll-container";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "rgba(24,24,27,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "#e4e4e7" },
        }}
      />
      <CustomScrollContainer as="main" id="app-main-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 pb-24">{children}</div>
      </CustomScrollContainer>
      <PersistentBottomNav />
    </div>
  );
}

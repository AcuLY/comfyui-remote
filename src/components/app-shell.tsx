import Link from "next/link";
import { Boxes } from "lucide-react";
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
      <header className="shrink-0 border-b border-white/10 bg-[var(--panel)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <Link href="/queue" className="flex items-center gap-2 text-sm font-semibold text-white">
            <Boxes className="size-4 text-sky-400" />
            ComfyUI Manager
          </Link>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">v0.3</span>
        </div>
      </header>
      <main id="app-main-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 pb-24">{children}</div>
      </main>
      <PersistentBottomNav />
    </div>
  );
}

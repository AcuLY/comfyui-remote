import Link from "next/link";
import { Boxes } from "lucide-react";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--panel)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/queue" className="flex items-center gap-2 text-sm font-semibold text-white">
            <Boxes className="size-4 text-sky-400" />
            ComfyUI Manager
          </Link>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-400">mobile-first</span>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}

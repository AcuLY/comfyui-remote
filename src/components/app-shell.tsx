import Link from "next/link";
import { Boxes, FolderOpen, Images, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/queue", label: "待审核", icon: Images },
  { href: "/jobs", label: "大任务", icon: FolderOpen },
  { href: "/trash", label: "回收站", icon: Trash2 },
  { href: "/assets/loras", label: "LoRA", icon: Upload },
];

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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[var(--panel)]/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 py-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

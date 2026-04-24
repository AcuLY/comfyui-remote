import Link from "next/link";
import { Boxes, FolderOpen, Images, Settings, Upload, BookOpen, LayoutTemplate } from "lucide-react";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

const navItems = [
  { href: "/queue", label: "待审核", icon: Images },
  { href: "/projects", label: "项目", icon: FolderOpen },
  { href: "/assets/presets", label: "预制", icon: BookOpen },
  { href: "/assets/templates", label: "模板", icon: LayoutTemplate },
  { href: "/assets/loras", label: "LoRA", icon: Upload },
  { href: "/settings", label: "设置", icon: Settings },
];

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
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 pb-24">{children}</div>
      </main>
      <nav className="shrink-0 border-t border-white/10 bg-[var(--panel)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
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

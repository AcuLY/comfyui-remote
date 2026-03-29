"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, Images, Trash2, Upload } from "lucide-react";

const navItems = [
  { href: "/queue", label: "待审核", icon: Images },
  { href: "/projects", label: "项目", icon: FolderOpen },
  { href: "/trash", label: "回收站", icon: Trash2 },
  { href: "/assets/loras", label: "LoRA", icon: Upload },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[var(--panel)]/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-4 gap-1 px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition ${
                active
                  ? "bg-sky-500/12 text-sky-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

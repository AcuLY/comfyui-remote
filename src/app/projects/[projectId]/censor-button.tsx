"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { censorProjectImages, type ProjectCensorMode } from "@/lib/actions";

export function CensorButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleCensor(mode: ProjectCensorMode) {
    setMenuOpen(false);
    startTransition(async () => {
      try {
        const result = await censorProjectImages(projectId, mode);
        if (result.success) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "打码失败");
      }
    });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        disabled={isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-2 py-2 text-[11px] text-amber-300 transition hover:bg-amber-500/[0.1] disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
        {isPending ? "提交中..." : "批量打码"}
        {!isPending && <ChevronDown className="size-3" />}
      </button>

      {menuOpen && !isPending && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-xl">
          <button
            type="button"
            onClick={() => handleCensor("all")}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <span className="font-medium">全部打码</span>
            <span className="text-zinc-500">保留 + 待审核</span>
          </button>
          <button
            type="button"
            onClick={() => handleCensor("kept")}
            className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2 text-left text-[11px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <span className="font-medium">仅保留</span>
            <span className="text-zinc-500">只打码已审核通过的</span>
          </button>
          <button
            type="button"
            onClick={() => handleCensor("marked")}
            className="flex w-full items-center gap-2 border-t border-white/5 px-3 py-2 text-left text-[11px] text-zinc-200 transition hover:bg-white/[0.06]"
          >
            <span className="font-medium">p站 + 预览 + 封面</span>
            <span className="text-zinc-500">只打码已标记图片</span>
          </button>
        </div>
      )}
    </div>
  );
}

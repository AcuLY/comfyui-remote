"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { censorProjectImages } from "@/lib/actions";

export function CensorButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await censorProjectImages(projectId);
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
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-2 py-2 text-[11px] text-amber-300 transition hover:bg-amber-500/[0.1] disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-3 sm:text-xs"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
      {isPending ? "提交中..." : "批量打码"}
    </button>
  );
}

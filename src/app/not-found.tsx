import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveRouteFallback } from "@/lib/route-fallback";

export default async function NotFound() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  const fallback = resolveRouteFallback(pathname);

  if (fallback) {
    redirect(fallback);
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">404</p>
      <h1 className="text-2xl font-semibold text-zinc-100">页面不存在</h1>
      <p className="text-sm leading-6 text-zinc-400">当前地址没有可用页面。</p>
      <Link
        href="/queue"
        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200 transition hover:bg-white/[0.08]"
      >
        返回任务列表
      </Link>
    </main>
  );
}

import Image from "next/image";
import { RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { trashItems } from "@/lib/mock-data";

export default function TrashPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="回收站" description="删除后的图片会先进入这里，支持恢复。" />
      <SectionCard title="已删除图片" subtitle={`当前共 ${trashItems.length} 条记录`}>
        {trashItems.length === 0 ? (
          <EmptyState title="回收站为空" description="当前没有可恢复的图片。" />
        ) : (
          <div className="space-y-3">
            {trashItems.map((item) => (
              <div key={item.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="relative h-24 w-18 overflow-hidden rounded-xl">
                  <Image src={item.src} alt={item.title} fill className="object-cover" unoptimized />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-zinc-400">删除于 {item.deletedAt}</div>
                  <div className="mt-2 break-all text-[11px] leading-5 text-zinc-500">{item.originalPath}</div>
                </div>
                <button className="inline-flex h-fit items-center gap-1 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
                  <RotateCcw className="size-3.5" /> 恢复
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

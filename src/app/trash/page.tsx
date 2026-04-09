import Image from "next/image";
import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { getTrashItems } from "@/lib/server-data";
import { RestoreButton } from "./restore-button";

export default async function TrashPage() {
  const items = await getTrashItems();

  return (
    <div className="space-y-3">
      <SectionCard title="回收站" subtitle="已删除的图片可在此恢复到原位置。">
        <div className="grid grid-cols-2 gap-3">
          <StatChip label="已删除图片" value={items.length} tone="warn" />
        </div>
      </SectionCard>

      {items.length === 0 ? (
        <SectionCard title="无回收记录" subtitle="暂无已删除的图片。">
          <div className="py-8 text-center text-sm text-zinc-500">
            回收站为空 🎉
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="已删除图片" subtitle="点击恢复按钮将图片移回原路径。">
          <div className="grid grid-cols-1 gap-2.5 justify-items-center lg:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 lg:max-w-lg"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--panel-soft)]">
                  <Image
                    src={item.src ?? "/placeholder.svg"}
                    alt={item.id}
                    width={128}
                    height={128}
                    className="size-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    删除于 {item.deletedAt}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-600">
                    {item.originalPath}
                  </div>
                </div>
                <RestoreButton trashRecordId={item.id} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

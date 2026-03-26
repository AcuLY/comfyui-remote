import { SectionCard } from "@/components/section-card";
import { StatChip } from "@/components/stat-chip";
import { getLoraAssets } from "@/lib/server-data";
import { LoraUploadForm } from "./lora-upload-form";

export default async function LorasPage() {
  const assets = await getLoraAssets();

  const categories = [...new Set(assets.map((a) => a.category))];

  return (
    <div className="space-y-4">
      <SectionCard title="LoRA 资源" subtitle="管理本地 LoRA 文件，支持按分类查看。">
        <div className="grid grid-cols-2 gap-3">
          <StatChip label="已登记 LoRA" value={assets.length} tone="accent" />
          <StatChip label="分类数" value={categories.length} tone="default" />
        </div>
      </SectionCard>

      <SectionCard title="上传 LoRA" subtitle="选择分类并上传 .safetensors 文件。">
        <LoraUploadForm />
      </SectionCard>

      {assets.length === 0 ? (
        <SectionCard title="暂无 LoRA" subtitle="还没有任何已登记的 LoRA 文件。">
          <div className="py-8 text-center text-sm text-zinc-500">
            可通过上传功能添加 LoRA
          </div>
        </SectionCard>
      ) : (
        categories.map((cat) => {
          const catAssets = assets.filter((a) => a.category === cat);
          return (
            <SectionCard
              key={cat}
              title={cat}
              subtitle={`${catAssets.length} 个 LoRA`}
            >
              <div className="space-y-2">
                {catAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        {asset.name}
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-normal text-sky-300">
                          {cat}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {asset.relativePath}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] text-zinc-600">
                      {asset.uploadedAt}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          );
        })
      )}
    </div>
  );
}

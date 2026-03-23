import { FolderTree } from "lucide-react";
import { LoraUploadPanel } from "@/components/lora-upload-panel";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getLoraAssets } from "@/lib/server-data";

const pathOptions = ["characters", "styles", "poses", "misc"];

export default async function LoraAssetsPage() {
  const loraAssets = await getLoraAssets();

  return (
    <div className="space-y-4">
      <PageHeader title="LoRA 资源" description="优先接真实上传接口，并映射到本地 LoRA 目录。" />

      <SectionCard title="上传入口" subtitle="已接真实 /api/loras，接口不可用时会显示错误提示。">
        <LoraUploadPanel categories={pathOptions} />
      </SectionCard>

      <SectionCard title="已登记 LoRA" subtitle={`当前示例 ${loraAssets.length} 个`}>
        <div className="space-y-3">
          {loraAssets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{asset.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{asset.uploadedAt}</div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">{asset.category}</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 break-all rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                <FolderTree className="size-3.5 text-zinc-500" /> {asset.relativePath}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

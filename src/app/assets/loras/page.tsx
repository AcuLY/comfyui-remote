import { FolderTree, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { loraAssets } from "@/lib/mock-data";

const pathOptions = [
  "characters",
  "styles",
  "poses",
  "misc",
];

export default function LoraAssetsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="LoRA 资源" description="后续会接文件上传接口，并映射到本地 LoRA 目录。" />

      <SectionCard title="上传入口" subtitle="首版先做页面骨架，后续接真实上传接口。">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center">
            <Upload className="size-5 text-sky-300" />
            <div className="mt-2 text-sm font-medium text-white">选择文件或拖拽上传</div>
            <div className="mt-1 text-xs text-zinc-400">支持 safetensors / ckpt 等文件</div>
            <input type="file" className="hidden" />
          </label>
          <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
            <div className="text-xs text-zinc-500">目标分类</div>
            <select className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none">
              {pathOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button className="w-full rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-300">上传到指定路径</button>
          </div>
        </div>
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

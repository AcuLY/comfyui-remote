import { FolderTree } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getLoraAssets, getLoraUploadMeta } from "@/lib/server-data";
import { LoraUploadForm } from "./lora-upload-form";

export default async function LoraAssetsPage() {
  const [loraAssets, uploadMeta] = await Promise.all([getLoraAssets(), getLoraUploadMeta()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="LoRA Assets"
        description="Upload files through the real API using backend-provided category metadata and review the current library here."
      />

      <SectionCard
        title="Upload LoRA"
        subtitle="Choose a file, pick a backend path-map category, submit it to `/api/loras`, and review the result here."
      >
        <div className="space-y-4">
          <LoraUploadForm uploadMeta={uploadMeta} />

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="text-xs font-medium text-white">Resolved upload targets</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {uploadMeta.categories.map((option) => (
                <div
                  key={option.category}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300"
                >
                  <span className="font-medium text-white">{option.category}</span>
                  <span className="mx-2 text-zinc-500">→</span>
                  <span className="break-all text-zinc-400">{option.relativeDir}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Library"
        subtitle={`Showing ${loraAssets.length} LoRA asset${loraAssets.length === 1 ? "" : "s"}.`}
      >
        <div className="space-y-3">
          {loraAssets.map((asset) => (
            <div key={asset.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{asset.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{asset.uploadedAt}</div>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
                  {asset.category}
                </span>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 break-all rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">
                <FolderTree className="size-3.5 text-zinc-500" />
                {asset.relativePath}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

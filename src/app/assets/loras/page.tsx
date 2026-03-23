import { FolderTree } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getLoraAssets } from "@/lib/server-data";
import { LoraUploadForm } from "./lora-upload-form";

export default async function LoraAssetsPage() {
  const loraAssets = await getLoraAssets();

  return (
    <div className="space-y-4">
      <PageHeader
        title="LoRA Assets"
        description="Upload files to the real API while keeping the existing library list and mock fallback intact."
      />

      <SectionCard
        title="Upload LoRA"
        subtitle="Choose a file, pick a category, submit it to `/api/loras`, and review the result here."
      >
        <LoraUploadForm />
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

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getJobDetail } from "@/lib/server-data";

export default async function JobEditPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJobDetail(jobId);

  if (!job) {
    notFound();
  }

  const primaryPosition = job.positions[0];
  const aspectRatioOptions = Array.from(new Set([primaryPosition?.aspectRatio ?? "3:4", "3:4", "4:3", "1:1"]));
  const characterLoraPath = job.promptOverview.characterLoraPath || job.character.loraPath;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <ArrowLeft className="size-4" /> 返回任务详情
        </Link>
        <button className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          <Save className="size-4" /> 保存当前大任务
        </button>
      </div>

      <PageHeader title="编辑当前大任务" description="这里只修改的是本次大任务配置，不影响全局 position 模板。" />

      <SectionCard title="角色 / 场景 / 风格" subtitle="这些字段会组合成完整任务的固定部分。">
        <div className="space-y-3 text-sm">
          <textarea
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
            defaultValue={job.promptOverview.characterPrompt}
          />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
            defaultValue={job.promptOverview.scenePrompt}
          />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
            defaultValue={job.promptOverview.stylePrompt}
          />
        </div>
      </SectionCard>

      <SectionCard title="任务级参数" subtitle="首版先保留最常用字段。">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">画幅</div>
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
              defaultValue={primaryPosition?.aspectRatio ?? "3:4"}
            >
              {aspectRatioOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <div className="text-xs text-zinc-500">batch size</div>
            <input
              type="number"
              defaultValue={primaryPosition?.batchSize ?? 8}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
            />
          </label>
          <label className="col-span-2 space-y-2">
            <div className="text-xs text-zinc-500">LoRA</div>
            <input
              defaultValue={characterLoraPath}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none"
            />
          </label>
        </div>
      </SectionCard>
    </div>
  );
}

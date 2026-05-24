import { notFound } from "next/navigation";

import {
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
} from "@/lib/actions/character-lora-training";
import {
  ImageStrip,
  InfoRow,
  JobPageShell,
  SimpleSection,
  StatusPill,
  compactId,
  formatDate,
} from "../shared-ui";

export const dynamic = "force-dynamic";

export default async function PersonaReferencePage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await getCharacterLoraTrainingJob(jobId).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("not found")) return null;
    throw error;
  });
  if (!job) notFound();

  const report = await getCharacterLoraJobReport(jobId);
  const currentCanonical = report.canonicalVersions.find((version) => version.id === job.currentCanonicalVersionId) ?? null;

  return (
    <JobPageShell
      job={job}
      currentPath="persona-reference"
      title={`${job.characterName} / 人设参考图`}
      description="查看初始参考图、人设图候选和当前选中的人设参考图。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SimpleSection title="初始参考图" subtitle={`${report.sourceImages.length} 张`}>
            <ImageStrip jobId={job.id} images={report.sourceImages} emptyLabel="暂无初始参考图" />
          </SimpleSection>

          <SimpleSection title="人设图候选" subtitle={`${report.canonicalVersions.length} 个版本`}>
            {report.canonicalVersions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
                暂无人设图候选
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.canonicalVersions.map((version) => (
                  <div key={version.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                    <ImageStrip jobId={job.id} images={[version]} emptyLabel="无预览" />
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-zinc-200">v{version.version}</span>
                      <StatusPill value={version.id === job.currentCanonicalVersionId ? "当前" : version.status} />
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-zinc-500">{compactId(version.id)}</div>
                  </div>
                ))}
              </div>
            )}
          </SimpleSection>
        </div>

        <SimpleSection title="当前人设图" subtitle={currentCanonical ? `v${currentCanonical.version}` : "缺失"}>
          <dl>
            <InfoRow label="版本" value={currentCanonical ? `v${currentCanonical.version}` : "缺失"} />
            <InfoRow label="状态" value={currentCanonical ? <StatusPill value={currentCanonical.status} /> : "缺失"} />
            <InfoRow label="创建时间" value={formatDate(currentCanonical?.createdAt)} />
            <InfoRow label="备注" value={currentCanonical?.notes ?? "-"} />
          </dl>
        </SimpleSection>
      </div>
    </JobPageShell>
  );
}

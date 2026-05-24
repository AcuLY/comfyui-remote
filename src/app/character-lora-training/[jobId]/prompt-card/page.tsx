import { notFound } from "next/navigation";

import {
  getCharacterLoraTrainingJob,
  listCharacterLoraPromptCardVersions,
} from "@/lib/actions/character-lora-training";
import {
  InfoRow,
  JobPageShell,
  SimpleSection,
  compactId,
  formatDate,
} from "../shared-ui";

export const dynamic = "force-dynamic";

export default async function PromptCardPage({
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

  const promptCards = await listCharacterLoraPromptCardVersions(jobId);
  const currentPrompt = promptCards.find((card) => card.id === job.currentPromptCardVersionId) ?? promptCards[promptCards.length - 1] ?? null;

  return (
    <JobPageShell
      job={job}
      currentPath="prompt-card"
      title={`${job.characterName} / 提示词卡`}
      description="查看当前提示词卡和历史版本。字段由外部 Agent 或人工确认写入。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SimpleSection title="当前提示词卡" subtitle={currentPrompt ? `v${currentPrompt.version}` : "未创建"}>
          {currentPrompt ? (
            <div className="space-y-4">
              <dl>
                <InfoRow label="版本 ID" value={<span className="font-mono text-xs">{compactId(currentPrompt.id)}</span>} />
                <InfoRow label="触发词" value={<span className="font-mono text-xs">{currentPrompt.triggerToken}</span>} />
                <InfoRow label="绑定人设图" value={compactId(currentPrompt.canonicalVersionId)} />
                <InfoRow label="创建时间" value={formatDate(currentPrompt.createdAt)} />
                <InfoRow label="变更原因" value={currentPrompt.changeReason ?? "-"} />
              </dl>
              <PromptBlock title="角色核心特征" value={currentPrompt.identityTraits} />
              <PromptBlock title="服装/形态特征" value={currentPrompt.outfitTraits} />
              <PromptBlock title="负面约束" value={currentPrompt.negativeTraits} />
              <PromptText title="最终完整提示词" value={currentPrompt.finalPromptDraft} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-500">
              暂无提示词卡
            </div>
          )}
        </SimpleSection>

        <SimpleSection title="版本历史" subtitle={`${promptCards.length} 个版本`}>
          {promptCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
              暂无历史版本
            </div>
          ) : (
            <div className="space-y-2">
              {[...promptCards].reverse().map((card) => (
                <div
                  key={card.id}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    card.id === currentPrompt?.id
                      ? "border-sky-500/30 bg-sky-500/10 text-sky-100"
                      : "border-white/10 bg-white/[0.03] text-zinc-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">v{card.version}</span>
                    <span className="text-xs text-zinc-500">{formatDate(card.createdAt)}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{card.finalPromptDraft}</div>
                </div>
              ))}
            </div>
          )}
        </SimpleSection>
      </div>
    </JobPageShell>
  );
}

function PromptBlock({ title, value }: { title: string; value: unknown }) {
  return <PromptText title={title} value={formatJsonish(value)} />;
}

function PromptText({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-2 text-xs font-medium text-zinc-400">{title}</div>
      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">{value || "-"}</div>
    </div>
  );
}

function formatJsonish(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

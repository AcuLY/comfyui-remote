import { notFound } from "next/navigation";

import {
  getCharacterLoraJobReport,
  getCharacterLoraTrainingJob,
  listCharacterLoraPromptCardVersions,
} from "@/lib/actions/character-lora-training";
import { getCanonicalViewLabel } from "@/lib/character-lora-canonical-views";
import {
  InfoRow,
  JobPageShell,
  SimpleSection,
  compactId,
  formatDate,
} from "../shared-ui";
import { PromptCardForm } from "./prompt-card-form";

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

  const [promptCards, report] = await Promise.all([
    listCharacterLoraPromptCardVersions(jobId),
    getCharacterLoraJobReport(jobId),
  ]);
  const currentPrompt = promptCards.find((card) => card.id === job.currentPromptCardVersionId) ?? promptCards[promptCards.length - 1] ?? null;
  const currentCanonical = report.canonicalVersions.find((version) => version.id === job.currentCanonicalVersionId) ?? null;
  const usableCanonicalVersions = report.canonicalVersions.filter((version) => version.status !== "rejected");
  const canonicalOptions = usableCanonicalVersions.map((version) => ({
    id: version.id,
    version: version.version,
    status: version.status,
    label: `v${version.version} / ${getCanonicalViewLabel(version.canonicalView)} / ${version.status} / ${compactId(version.id)}`,
  }));
  const initialDraft = {
    characterDescription: currentPrompt ? extractCharacterDescription(currentPrompt.identityTraits) : "",
    identityTraits: currentPrompt ? formatEditableJsonish(currentPrompt.identityTraits) : "",
    outfitTraits: currentPrompt ? formatEditableJsonish(currentPrompt.outfitTraits) : "",
    negativeTraits: currentPrompt ? formatEditableJsonish(currentPrompt.negativeTraits) : "",
    finalPromptDraft: currentPrompt?.finalPromptDraft ?? `${job.triggerToken}, `,
  };

  return (
    <JobPageShell
      job={job}
      currentPath="prompt-card"
      title={`${job.characterName} / 提示词卡`}
      description="创建可追踪的提示词卡版本，供后续模块生成与训练集冻结使用。"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SimpleSection title="创建提示词卡版本" subtitle={currentCanonical ? `默认绑定人设图 v${currentCanonical.version}` : "当前没有 canonical，可创建无绑定版本"}>
            {!currentCanonical ? (
              <div className="mb-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                机械警告：没有当前人设图时，后续 section lineage 仍会阻塞；该提示词卡可先保存，但不能独立生成训练图。
              </div>
            ) : null}
            <PromptCardForm
              jobId={job.id}
              triggerToken={job.triggerToken}
              defaultCanonicalVersionId={currentCanonical?.id ?? ""}
              canonicalOptions={canonicalOptions}
              initialDraft={initialDraft}
            />
          </SimpleSection>

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
        </div>

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

function formatEditableJsonish(value: unknown) {
  if (value === null || value === undefined) return "";
  return formatJsonish(value);
}

function extractCharacterDescription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const candidate = (value as Record<string, unknown>).characterDescription;
  return typeof candidate === "string" ? candidate : "";
}

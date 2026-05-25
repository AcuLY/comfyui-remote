"use client";

import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";

export type PromptCardDraftsProps = {
  drafts: Array<{
    taskId: string;
    status: string;
    provider: string | null;
    draft: PromptCardDraftFields | null;
    errorSummary: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
  onApply: (draft: PromptCardDraftFields) => void;
};

export function PromptCardDrafts({ drafts, onApply }: PromptCardDraftsProps) {
  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
        暂无 AI 草稿
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
        <DraftCard key={draft.taskId} draft={draft} onApply={onApply} />
      ))}
    </div>
  );
}

function DraftCard({
  draft: item,
  onApply,
}: {
  draft: PromptCardDraftsProps["drafts"][number];
  onApply: (draft: PromptCardDraftFields) => void;
}) {
  const isDone = item.status === "done";
  const isFailed = item.status === "failed";

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isFailed
          ? "border-rose-500/20 bg-rose-500/5"
          : isDone
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              isFailed
                ? "bg-rose-500/20 text-rose-300"
                : "bg-emerald-500/20 text-emerald-300"
            }`}
          >
            {isDone ? "完成" : "失败"}
          </span>
          {item.provider ? (
            <span className="text-[10px] text-zinc-500">{item.provider}</span>
          ) : null}
        </div>
        <span className="text-[10px] text-zinc-500">{formatTime(item.createdAt)}</span>
      </div>

      {isDone && item.draft ? (
        <>
          <div className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-zinc-300">
            {item.draft.finalPromptDraft}
          </div>
          <button
            type="button"
            onClick={() => onApply(item.draft!)}
            className="mt-2 inline-flex h-7 items-center justify-center rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 text-[11px] font-medium text-sky-200 transition hover:bg-sky-500/20"
          >
            应用到编辑器
          </button>
        </>
      ) : null}

      {isFailed && item.errorSummary ? (
        <div className="mt-1.5 text-xs leading-relaxed text-rose-300/80">
          {item.errorSummary}
        </div>
      ) : null}
    </div>
  );
}

function formatTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

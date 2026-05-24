"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";
import { createPromptCardAction, draftPromptCardAction, type PromptCardDraftActionResult } from "../workflow-actions";

export type PromptCardCanonicalOption = {
  id: string;
  version: number;
  status: string;
  label: string;
};

type PromptCardFormProps = {
  jobId: string;
  triggerToken: string;
  defaultCanonicalVersionId: string;
  canonicalOptions: PromptCardCanonicalOption[];
  initialDraft: PromptCardDraftFields;
};

export function PromptCardForm({
  jobId,
  triggerToken,
  defaultCanonicalVersionId,
  canonicalOptions,
  initialDraft,
}: PromptCardFormProps) {
  const router = useRouter();
  const [canonicalVersionId, setCanonicalVersionId] = useState(defaultCanonicalVersionId);
  const [characterDescription, setCharacterDescription] = useState(initialDraft.characterDescription);
  const [identityTraits, setIdentityTraits] = useState(initialDraft.identityTraits);
  const [outfitTraits, setOutfitTraits] = useState(initialDraft.outfitTraits);
  const [negativeTraits, setNegativeTraits] = useState(initialDraft.negativeTraits);
  const [finalPromptDraft, setFinalPromptDraft] = useState(initialDraft.finalPromptDraft || `${triggerToken}, `);
  const [changeReason, setChangeReason] = useState("");
  const [provider, setProvider] = useState("codex-cli");
  const [operatorNotes, setOperatorNotes] = useState("");
  const [draftPending, setDraftPending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [draftFeedback, setDraftFeedback] = useState<PromptCardDraftActionResult | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleDraft() {
    if (draftPending || savePending) return;
    setDraftPending(true);
    setDraftFeedback(null);
    try {
      const result = await draftPromptCardAction(jobId, {
        canonicalVersionId: canonicalVersionId || null,
        provider,
        operatorNotes: operatorNotes || null,
      });
      setDraftFeedback(result);
      if (!result.ok || !result.draft) {
        toast.error(result.message);
        return;
      }
      applyDraft(result.draft);
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 草稿生成失败。";
      const result = { ok: false, message };
      setDraftFeedback(result);
      toast.error(message);
    } finally {
      setDraftPending(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftPending || savePending) return;
    setSavePending(true);
    setSaveFeedback(null);
    try {
      const formData = new FormData(event.currentTarget);
      await createPromptCardAction(jobId, formData);
      const result = { ok: true, message: "Prompt Card 新版本已创建。" };
      setSaveFeedback(result);
      toast.success(result.message);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prompt Card 保存失败。";
      const result = { ok: false, message };
      setSaveFeedback(result);
      toast.error(message);
    } finally {
      setSavePending(false);
    }
  }

  function applyDraft(draft: PromptCardDraftFields) {
    setCharacterDescription(draft.characterDescription);
    setIdentityTraits(draft.identityTraits);
    setOutfitTraits(draft.outfitTraits);
    setNegativeTraits(draft.negativeTraits);
    setFinalPromptDraft(draft.finalPromptDraft);
    setChangeReason((current) => current || "AI draft reviewed from source/canonical references");
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <input type="hidden" name="triggerToken" value={triggerToken} />
      <input type="hidden" name="identityTraits" value={buildIdentityTraitsPayload(characterDescription, identityTraits)} />

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-sky-100">AI 草拟提示词卡</div>
            <div className="text-xs text-sky-200/80">只填充下方可编辑草稿；不会保存，需人工检查后点击“创建新版本”。</div>
          </div>
          <button
            type="button"
            disabled={draftPending || savePending}
            onClick={handleDraft}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {draftPending ? "正在生成" : "AI 草拟（不保存）"}
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)]">
          <label className="text-xs text-sky-100/80">
            草稿生成器
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
            >
              <option value="codex-cli">codex-cli</option>
              <option value="mock-local">mock-local</option>
            </select>
          </label>
          <label className="text-xs text-sky-100/80">
            补充说明（可选）
            <input
              value={operatorNotes}
              onChange={(event) => setOperatorNotes(event.target.value)}
              placeholder="例如：保留耳机/外套；不要把不同服装混在一起"
              className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
            />
          </label>
        </div>
        {draftFeedback ? <InlineFeedback result={draftFeedback} /> : null}
      </div>

      <label className="block text-xs text-zinc-400">
        绑定人设图
        <select
          name="canonicalVersionId"
          value={canonicalVersionId}
          onChange={(event) => setCanonicalVersionId(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        >
          <option value="">不绑定 canonical</option>
          {canonicalOptions.map((version) => (
            <option key={version.id} value={version.id}>{version.label}</option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-400">
        角色描述（从原始参考图提取）
        <textarea
          rows={5}
          value={characterDescription}
          onChange={(event) => setCharacterDescription(event.target.value)}
          placeholder="例如：long blonde twintails with black ribbon bows; red ornate idol dress..."
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      <label className="block text-xs text-zinc-400">
        identity / core traits
        <textarea
          rows={4}
          required
          value={identityTraits}
          onChange={(event) => setIdentityTraits(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      <label className="block text-xs text-zinc-400">
        outfit / form traits
        <textarea
          name="outfitTraits"
          rows={4}
          required
          value={outfitTraits}
          onChange={(event) => setOutfitTraits(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      <label className="block text-xs text-zinc-400">
        negative constraints
        <textarea
          name="negativeTraits"
          rows={3}
          value={negativeTraits}
          onChange={(event) => setNegativeTraits(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      <label className="block text-xs text-zinc-400">
        final prompt
        <textarea
          name="finalPromptDraft"
          rows={5}
          required
          value={finalPromptDraft}
          onChange={(event) => setFinalPromptDraft(event.target.value)}
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      <label className="block text-xs text-zinc-400">
        change note
        <input
          name="changeReason"
          value={changeReason}
          onChange={(event) => setChangeReason(event.target.value)}
          placeholder="本次版本调整说明"
          className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-2 text-sm text-zinc-200 outline-none transition focus:border-sky-400"
        />
      </label>
      {saveFeedback ? <InlineFeedback result={saveFeedback} /> : null}
      <button
        type="submit"
        disabled={draftPending || savePending}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {savePending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {savePending ? "正在创建" : "创建新版本"}
      </button>
    </form>
  );
}

function InlineFeedback({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
      {result.message}
    </div>
  );
}

function buildIdentityTraitsPayload(characterDescription: string, identityTraits: string) {
  const description = characterDescription.trim();
  const traits = identityTraits.trim();
  const parsed = parseJsonish(traits);

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return JSON.stringify({ characterDescription: description, ...(parsed as Record<string, unknown>) }, null, 2);
  }

  if (Array.isArray(parsed)) {
    return JSON.stringify({ characterDescription: description, traits: parsed }, null, 2);
  }

  return JSON.stringify({ characterDescription: description, traits }, null, 2);
}

function parseJsonish(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

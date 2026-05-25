"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createPromptCardAction } from "../workflow-actions";

export type PromptCardEditorProps = {
  jobId: string;
  triggerToken: string;
  defaultCanonicalVersionId: string;
  initialDraft: {
    characterDescription: string;
    identityTraits: string;
    outfitTraits: string;
    negativeTraits: string;
    finalPromptDraft: string;
  };
};

export function PromptCardEditor({
  jobId,
  triggerToken,
  defaultCanonicalVersionId,
  initialDraft,
}: PromptCardEditorProps) {
  const router = useRouter();
  const [characterDescription, setCharacterDescription] = useState(initialDraft.characterDescription);
  const [identityTraits, setIdentityTraits] = useState(initialDraft.identityTraits);
  const [outfitTraits, setOutfitTraits] = useState(initialDraft.outfitTraits);
  const [negativeTraits, setNegativeTraits] = useState(initialDraft.negativeTraits);
  const [finalPromptDraft, setFinalPromptDraft] = useState(initialDraft.finalPromptDraft || `${triggerToken}, `);
  const [changeReason, setChangeReason] = useState("");
  const [savePending, setSavePending] = useState(false);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savePending) return;
    setSavePending(true);
    try {
      const formData = new FormData(event.currentTarget);
      await createPromptCardAction(jobId, formData);
      toast.success("Prompt Card 新版本已创建。");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prompt Card 保存失败。";
      toast.error(message);
    } finally {
      setSavePending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <input type="hidden" name="triggerToken" value={triggerToken} />
      <input type="hidden" name="canonicalVersionId" value={defaultCanonicalVersionId} />
      <input type="hidden" name="identityTraits" value={buildIdentityTraitsPayload(characterDescription, identityTraits)} />

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
      <button
        type="submit"
        disabled={savePending}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-500 px-3 text-xs font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {savePending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {savePending ? "正在创建" : "保存为新版本"}
      </button>
    </form>
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

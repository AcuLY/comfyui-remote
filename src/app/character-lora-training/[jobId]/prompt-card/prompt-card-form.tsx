"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";
import { ArtifactImagePreview } from "../artifact-image-preview";
import {
  createPromptCardAction,
  draftPromptCardAction,
  getPromptCardDraftTaskAction,
  type PromptCardDraftActionResult,
  type PromptCardDraftTaskSnapshot,
} from "../workflow-actions";

export type PromptCardSourceImageOption = {
  id: string;
  label: string;
  relativePath: string | null;
};

export type PromptCardCanonicalOption = {
  id: string;
  version: number;
  status: string;
  label: string;
  relativePath: string | null;
};

type PromptCardFormProps = {
  jobId: string;
  triggerToken: string;
  defaultCanonicalVersionId: string;
  sourceOptions: PromptCardSourceImageOption[];
  canonicalOptions: PromptCardCanonicalOption[];
  initialDraft: PromptCardDraftFields;
};

export function PromptCardForm({
  jobId,
  triggerToken,
  defaultCanonicalVersionId,
  sourceOptions,
  canonicalOptions,
  initialDraft,
}: PromptCardFormProps) {
  const router = useRouter();
  const [canonicalVersionId, setCanonicalVersionId] = useState(defaultCanonicalVersionId);
  const [selectedSourceImageIds, setSelectedSourceImageIds] = useState(() => sourceOptions.map((option) => option.id));
  const [selectedCanonicalVersionIds, setSelectedCanonicalVersionIds] = useState(() => (
    defaultCanonicalVersionId ? [defaultCanonicalVersionId] : canonicalOptions.map((option) => option.id)
  ));
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
  const [draftTask, setDraftTask] = useState<PromptCardDraftTaskSnapshot | null>(null);
  const [appliedDraftTaskId, setAppliedDraftTaskId] = useState<string | null>(null);
  const [draftFeedback, setDraftFeedback] = useState<PromptCardDraftActionResult | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const draftTaskActive = draftTask ? draftTask.status === "queued" || draftTask.status === "running" : false;
  const storageKey = `character-lora-prompt-card-draft-task:${jobId}`;

  useEffect(() => {
    const storedTaskId = window.localStorage.getItem(storageKey);
    if (!storedTaskId || draftTask) return;
    void refreshDraftTask(storedTaskId, { silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time recovery of the last local draft task.
  }, [storageKey]);

  useEffect(() => {
    if (!draftTaskActive || !draftTask) return;
    const interval = window.setInterval(() => {
      void refreshDraftTask(draftTask.id, { silent: true });
    }, 2500);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll the current task id/status only.
  }, [draftTask?.id, draftTaskActive]);

  useEffect(() => {
    if (!draftTask || draftTask.status !== "done" || appliedDraftTaskId === draftTask.id) return;
    const draft = draftTask.progress?.draft;
    if (!draft) return;
    applyDraft(draft);
    setAppliedDraftTaskId(draftTask.id);
    window.localStorage.removeItem(storageKey);
    toast.success("AI 草稿已生成并填入编辑区，请人工检查后再保存。");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply only once per task id.
  }, [draftTask?.id, draftTask?.status, appliedDraftTaskId]);

  async function refreshDraftTask(taskId: string, options: { silent?: boolean } = {}) {
    const result = await getPromptCardDraftTaskAction(jobId, taskId);
    setDraftFeedback(result);
    if (!result.ok || !result.task) {
      if (!options.silent) toast.error(result.message);
      return result;
    }
    setDraftTask(result.task);
    if (result.task.status === "failed") {
      window.localStorage.removeItem(storageKey);
      if (!options.silent) toast.error(result.message);
    }
    return result;
  }

  async function handleDraft() {
    if (draftPending || savePending || draftTaskActive) return;
    setDraftPending(true);
    setDraftFeedback(null);
    setAppliedDraftTaskId(null);
    try {
      const result = await draftPromptCardAction(jobId, {
        provider,
        operatorNotes: operatorNotes || null,
        sourceImageIds: selectedSourceImageIds,
        canonicalVersionIds: selectedCanonicalVersionIds,
      });
      setDraftFeedback(result);
      if (!result.ok || !result.taskId || !result.task) {
        toast.error(result.message);
        return;
      }
      setDraftTask(result.task);
      window.localStorage.setItem(storageKey, result.taskId);
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 草稿任务入队失败。";
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
    setChangeReason((current) => current || "AI draft reviewed from manually selected source/canonical references");
  }

  function toggleSelectedSourceImage(id: string) {
    setSelectedSourceImageIds((current) => toggleString(current, id));
  }

  function toggleSelectedCanonicalVersion(id: string) {
    setSelectedCanonicalVersionIds((current) => toggleString(current, id));
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <input type="hidden" name="triggerToken" value={triggerToken} />
      <input type="hidden" name="identityTraits" value={buildIdentityTraitsPayload(characterDescription, identityTraits)} />

      <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-3">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-sky-100">AI 草拟提示词卡</div>
            <div className="text-xs text-sky-200/80">选择参考图后入队；生成完成只填充下方可编辑草稿，不会保存。</div>
          </div>
          <button
            type="button"
            disabled={draftPending || savePending || draftTaskActive}
            onClick={handleDraft}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-sky-500 px-3 text-xs font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {draftPending || draftTaskActive ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {draftPending ? "正在入队" : draftTaskActive ? "AI 草拟中" : "AI 草拟（入队）"}
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

        <div className="mt-3 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <ImageSelectionHeader
            title="手动选择原始参考图"
            selectedCount={selectedSourceImageIds.length}
            totalCount={sourceOptions.length}
            onSelectAll={() => setSelectedSourceImageIds(sourceOptions.map((option) => option.id))}
            onSelectNone={() => setSelectedSourceImageIds([])}
          />
          {sourceOptions.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sourceOptions.map((option) => (
                <PromptCardImageOption
                  key={option.id}
                  jobId={jobId}
                  id={option.id}
                  label={option.label}
                  relativePath={option.relativePath}
                  checked={selectedSourceImageIds.includes(option.id)}
                  onToggle={() => toggleSelectedSourceImage(option.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 py-4 text-center text-xs text-zinc-500">暂无原始参考图</div>
          )}

          <ImageSelectionHeader
            title="手动选择 canonical / 人设图"
            selectedCount={selectedCanonicalVersionIds.length}
            totalCount={canonicalOptions.length}
            onSelectAll={() => setSelectedCanonicalVersionIds(canonicalOptions.map((option) => option.id))}
            onSelectNone={() => setSelectedCanonicalVersionIds([])}
          />
          {canonicalOptions.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {canonicalOptions.map((option) => (
                <PromptCardImageOption
                  key={option.id}
                  jobId={jobId}
                  id={option.id}
                  label={option.label}
                  relativePath={option.relativePath}
                  checked={selectedCanonicalVersionIds.includes(option.id)}
                  onToggle={() => toggleSelectedCanonicalVersion(option.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-white/10 py-4 text-center text-xs text-zinc-500">暂无可用人设图</div>
          )}
        </div>

        <DraftTaskStatus task={draftTask} />
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

function ImageSelectionHeader({
  title,
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
}: {
  title: string;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="text-sky-100/90">{title} <span className="text-sky-200/60">{selectedCount}/{totalCount}</span></div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onSelectAll} className="rounded border border-white/10 px-2 py-1 text-zinc-300 transition hover:border-sky-400/50 hover:text-sky-100">全选</button>
        <button type="button" onClick={onSelectNone} className="rounded border border-white/10 px-2 py-1 text-zinc-300 transition hover:border-sky-400/50 hover:text-sky-100">清空</button>
      </div>
    </div>
  );
}

function PromptCardImageOption({
  jobId,
  id,
  label,
  relativePath,
  checked,
  onToggle,
}: {
  jobId: string;
  id: string;
  label: string;
  relativePath: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`rounded-lg border p-2 transition ${checked ? "border-sky-400/60 bg-sky-400/10" : "border-white/10 bg-black/20"}`}>
      <label className="mb-2 flex cursor-pointer items-start gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 accent-sky-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          <span className="block truncate font-mono text-[10px] text-zinc-500">{compactId(id)}</span>
        </span>
      </label>
      <ArtifactImagePreview
        jobId={jobId}
        relativePath={relativePath}
        alt={label}
        thumbnailOptions={{ w: 260, q: 70 }}
        imageClassName="aspect-[4/5] w-full rounded-md border border-white/10 bg-black/30 object-cover"
        emptyClassName="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed border-white/10 bg-black/20 text-xs text-zinc-600"
      />
    </div>
  );
}

function DraftTaskStatus({ task }: { task: PromptCardDraftTaskSnapshot | null }) {
  if (!task) {
    return (
      <div className="mt-3 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
        任务状态：尚未入队。选择图片后点击 AI 草拟。
      </div>
    );
  }

  const active = task.status === "queued" || task.status === "running";
  const done = task.status === "done";
  const failed = task.status === "failed";
  const progressStatus = task.progress?.status;

  return (
    <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${
      failed
        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
        : done
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "border-sky-500/30 bg-sky-500/10 text-sky-100"
    }`}>
      <div className="flex flex-wrap items-center gap-2">
        {active ? <Loader2 className="size-3.5 animate-spin" /> : done ? <CheckCircle2 className="size-3.5" /> : null}
        <span>任务 {compactId(task.id)}</span>
        <span>状态：{progressStatus ?? task.status}</span>
        {task.provider ? <span>provider：{task.provider}</span> : null}
        {task.imageCount !== undefined ? <span>图片：source {task.sourceImageCount ?? 0} / canonical {task.canonicalImageCount ?? 0}</span> : null}
      </div>
      {task.errorSummary ? <div className="mt-1 break-words">错误：{task.errorSummary}</div> : null}
      {done && task.progress?.draft ? <div className="mt-1">已收到草稿并自动填入编辑区；请检查后再创建新版本。</div> : null}
      {task.heartbeatAt ? <div className="mt-1 text-[10px] opacity-70">最后更新：{formatLocalTime(task.heartbeatAt)}</div> : null}
    </div>
  );
}

function InlineFeedback({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${result.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"}`}>
      {result.message}
    </div>
  );
}

function toggleString(values: string[], value: string) {
  return values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value];
}

function formatLocalTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleString();
}

function compactId(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
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

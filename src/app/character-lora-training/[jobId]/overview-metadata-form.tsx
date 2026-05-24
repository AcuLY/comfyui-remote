"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CharacterLoraJob } from "../types";

type ModelBrowseItem = {
  name: string;
  type: "directory" | "file";
  path: string;
  size?: number;
};

type ModelBrowseResult = {
  items: ModelBrowseItem[];
};

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string } };

async function fetchApiData<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => null)) as ApiResult<T> | null;
  if (!response.ok || !json) throw new Error(`HTTP ${response.status}`);
  if (!json.ok) throw new Error(json.error?.message ?? `HTTP ${response.status}`);
  return json.data;
}

function formatBytes(value: number | undefined) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function checkpointNameFromPath(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "保存失败";
}

const DEFAULT_PURPOSE = "character_identity";
const DEFAULT_CAPTION_STRATEGY = "controllable_identity";

type TrainingScopeFormState = {
  purpose: string;
  primaryOutfitOrForm: string;
  scopeNote: string;
  advancedExperiment: boolean;
  allowMixedCharacters: boolean;
  allowMultipleOfficialOutfits: boolean;
  mixingPolicyNote: string;
  derivedStates?: Array<Record<string, unknown>>;
};

type TrainingScopePayload = {
  purpose: string;
  primaryOutfitOrForm: string;
  scopeNote?: string;
  advancedExperiment?: boolean;
  mixingPolicy?: {
    allowMixedCharacters: boolean;
    allowMultipleOfficialOutfits: boolean;
    note?: string;
  };
  derivedStates?: Array<Record<string, unknown>>;
};

type UpdateJobPayload = Partial<{
  characterName: string;
  triggerToken: string;
  captionStrategy: string;
  trainingScope: TrainingScopePayload;
  baseCheckpointName: string | null;
  baseCheckpointPath: string | null;
  baseFamily: string | null;
}>;

export function OverviewMetadataForm({ job }: { job: CharacterLoraJob }) {
  const router = useRouter();
  const initialScope = useMemo(() => buildInitialTrainingScope(job), [job]);
  const [characterName, setCharacterName] = useState(job.characterName);
  const [triggerToken, setTriggerToken] = useState(job.triggerToken);
  const [captionStrategy, setCaptionStrategy] = useState(job.captionStrategy ?? DEFAULT_CAPTION_STRATEGY);
  const [baseFamily, setBaseFamily] = useState(job.baseFamily ?? "");
  const [purpose, setPurpose] = useState(initialScope.purpose);
  const [primaryOutfitOrForm, setPrimaryOutfitOrForm] = useState(initialScope.primaryOutfitOrForm);
  const [scopeNote, setScopeNote] = useState(initialScope.scopeNote);
  const [advancedExperiment, setAdvancedExperiment] = useState(initialScope.advancedExperiment);
  const [allowMixedCharacters, setAllowMixedCharacters] = useState(initialScope.allowMixedCharacters);
  const [allowMultipleOfficialOutfits, setAllowMultipleOfficialOutfits] = useState(initialScope.allowMultipleOfficialOutfits);
  const [mixingPolicyNote, setMixingPolicyNote] = useState(initialScope.mixingPolicyNote);
  const [selectedCheckpointPath, setSelectedCheckpointPath] = useState("");
  const [checkpointFiles, setCheckpointFiles] = useState<ModelBrowseItem[]>([]);
  const [checkpointLoading, setCheckpointLoading] = useState(true);
  const [checkpointError, setCheckpointError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadCheckpointFiles(controller.signal);
    return () => controller.abort();
  }, []);

  const selectedCheckpoint = useMemo(
    () => checkpointFiles.find((item) => item.path === selectedCheckpointPath) ?? null,
    [checkpointFiles, selectedCheckpointPath],
  );

  async function loadCheckpointFiles(signal?: AbortSignal) {
    setCheckpointLoading(true);
    setCheckpointError(null);
    try {
      const data = await fetchApiData<ModelBrowseResult>(
        "/api/models/browse?kind=checkpoint&recursive=1",
        { signal },
      );
      if (signal?.aborted) return;
      setCheckpointFiles(
        data.items
          .filter((item) => item.type === "file")
          .sort((a, b) => a.path.localeCompare(b.path)),
      );
    } catch (error) {
      if (signal?.aborted) return;
      setCheckpointFiles([]);
      setCheckpointError(getErrorMessage(error));
    } finally {
      if (!signal?.aborted) setCheckpointLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const trimmedCharacterName = characterName.trim();
      const trimmedTriggerToken = triggerToken.trim();
      const trimmedCaptionStrategy = captionStrategy.trim();
      const trimmedBaseFamily = baseFamily.trim();
      const body: UpdateJobPayload = {};

      if (!trimmedCharacterName) throw new Error("项目名不能为空");
      if (!trimmedTriggerToken) throw new Error("触发词不能为空");
      if (!trimmedCaptionStrategy) throw new Error("Caption 策略不能为空");

      if (trimmedCharacterName && trimmedCharacterName !== job.characterName) {
        body.characterName = trimmedCharacterName;
      }
      if (trimmedTriggerToken && trimmedTriggerToken !== job.triggerToken) {
        body.triggerToken = trimmedTriggerToken;
      }
      if (trimmedCaptionStrategy && trimmedCaptionStrategy !== job.captionStrategy) {
        body.captionStrategy = trimmedCaptionStrategy;
      }
      if (trimmedBaseFamily !== (job.baseFamily ?? "")) {
        body.baseFamily = trimmedBaseFamily || null;
      }

      if (selectedCheckpointPath.trim()) {
        body.baseCheckpointPath = selectedCheckpointPath.trim();
        body.baseCheckpointName = checkpointNameFromPath(selectedCheckpointPath.trim());
      }

      if (isTrainingScopeChanged(initialScope, {
        purpose,
        primaryOutfitOrForm,
        scopeNote,
        advancedExperiment,
        allowMixedCharacters,
        allowMultipleOfficialOutfits,
        mixingPolicyNote,
        derivedStates: initialScope.derivedStates,
      })) {
        body.trainingScope = buildTrainingScopePayload({
          purpose,
          primaryOutfitOrForm,
          scopeNote,
          advancedExperiment,
          allowMixedCharacters,
          allowMultipleOfficialOutfits,
          mixingPolicyNote,
          derivedStates: initialScope.derivedStates,
        }, trimmedCharacterName || job.characterName);
      }

      if (Object.keys(body).length === 0) {
        setSaveSuccess("没有需要保存的改动。");
        return;
      }

      await fetchApiData(`/api/character-lora-training/jobs/${encodeURIComponent(job.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      toast.success("项目信息已保存");
      setSaveSuccess("项目信息已保存。");
      setSelectedCheckpointPath("");
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error);
      setSaveError(message);
      toast.error("保存失败", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-zinc-400">
          项目名
          <input
            value={characterName}
            onChange={(event) => setCharacterName(event.currentTarget.value)}
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          触发词
          <input
            value={triggerToken}
            onChange={(event) => setTriggerToken(event.currentTarget.value)}
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Caption 策略
          <input
            value={captionStrategy}
            onChange={(event) => setCaptionStrategy(event.currentTarget.value)}
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Base family（可选）
          <input
            value={baseFamily}
            onChange={(event) => setBaseFamily(event.currentTarget.value)}
            placeholder="如 SDXL / Pony / Flux"
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
      </div>

      <div className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-zinc-300">训练基底 checkpoint</span>
          <button
            type="button"
            onClick={() => void loadCheckpointFiles()}
            disabled={checkpointLoading}
            className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-60"
          >
            <RefreshCw className={`size-3 ${checkpointLoading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-500">
          当前：<span className="font-mono">{job.baseCheckpointName ?? job.baseCheckpointPath ?? "-"}</span>
        </div>
        <select
          value={selectedCheckpointPath}
          onChange={(event) => setSelectedCheckpointPath(event.currentTarget.value)}
          disabled={checkpointLoading || checkpointFiles.length === 0}
          className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-xs text-white outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">
            {checkpointLoading ? "正在加载 checkpoint..." : "保持当前 checkpoint"}
          </option>
          {checkpointFiles.map((checkpoint) => (
            <option key={checkpoint.path} value={checkpoint.path}>
              {checkpoint.path}
            </option>
          ))}
        </select>
        {selectedCheckpoint ? (
          <div className="grid gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-500 sm:grid-cols-[1fr_auto]">
            <span className="break-all font-mono sm:truncate">{selectedCheckpoint.path}</span>
            <span>{formatBytes(selectedCheckpoint.size)}</span>
          </div>
        ) : null}
        {checkpointError ? (
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-200">
            Checkpoint 列表加载失败：{checkpointError}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-400">
        <div className="font-medium text-zinc-300">训练范围</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            purpose
            <input
              value={purpose}
              onChange={(event) => setPurpose(event.currentTarget.value)}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1">
            primary outfit / form
            <input
              value={primaryOutfitOrForm}
              onChange={(event) => setPrimaryOutfitOrForm(event.currentTarget.value)}
              className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-sky-400"
            />
          </label>
        </div>
        <label className="grid gap-1">
          scope note
          <textarea
            value={scopeNote}
            onChange={(event) => setScopeNote(event.currentTarget.value)}
            rows={3}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={advancedExperiment}
              onChange={(event) => setAdvancedExperiment(event.currentTarget.checked)}
              className="size-3.5 accent-sky-500"
            />
            Advanced
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={allowMixedCharacters}
              onChange={(event) => setAllowMixedCharacters(event.currentTarget.checked)}
              className="size-3.5 accent-sky-500"
            />
            Mixed characters
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={allowMultipleOfficialOutfits}
              onChange={(event) => setAllowMultipleOfficialOutfits(event.currentTarget.checked)}
              className="size-3.5 accent-sky-500"
            />
            Multiple outfits
          </label>
        </div>
        <label className="grid gap-1">
          mixing policy note
          <input
            value={mixingPolicyNote}
            onChange={(event) => setMixingPolicyNote(event.currentTarget.value)}
            className="h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-sky-400"
          />
        </label>
      </div>

      {saveError ? (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {saveError}
        </div>
      ) : null}
      {saveSuccess ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {saveSuccess}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          保存
        </button>
      </div>
    </div>
  );
}

function buildInitialTrainingScope(job: CharacterLoraJob): TrainingScopeFormState {
  const scope = asRecord(job.trainingScope);
  const mixingPolicy = asRecord(scope?.mixingPolicy);

  return {
    purpose: readString(scope, "purpose", DEFAULT_PURPOSE),
    primaryOutfitOrForm: readString(scope, "primaryOutfitOrForm", job.characterName),
    scopeNote: readString(scope, "scopeNote", ""),
    advancedExperiment: readBoolean(scope, "advancedExperiment", false),
    allowMixedCharacters: readBoolean(mixingPolicy, "allowMixedCharacters", false),
    allowMultipleOfficialOutfits: readBoolean(mixingPolicy, "allowMultipleOfficialOutfits", false),
    mixingPolicyNote: readString(mixingPolicy, "reason", readString(mixingPolicy, "note", "")),
    derivedStates: readRecordArray(scope?.derivedStates),
  };
}

function isTrainingScopeChanged(initialScope: TrainingScopeFormState, currentScope: TrainingScopeFormState) {
  return (
    initialScope.purpose !== currentScope.purpose ||
    initialScope.primaryOutfitOrForm !== currentScope.primaryOutfitOrForm ||
    initialScope.scopeNote !== currentScope.scopeNote ||
    initialScope.advancedExperiment !== currentScope.advancedExperiment ||
    initialScope.allowMixedCharacters !== currentScope.allowMixedCharacters ||
    initialScope.allowMultipleOfficialOutfits !== currentScope.allowMultipleOfficialOutfits ||
    initialScope.mixingPolicyNote !== currentScope.mixingPolicyNote
  );
}

function buildTrainingScopePayload(scope: TrainingScopeFormState, fallbackPrimaryOutfitOrForm: string): TrainingScopePayload {
  const purpose = scope.purpose.trim() || DEFAULT_PURPOSE;
  const primaryOutfitOrForm = scope.primaryOutfitOrForm.trim() || fallbackPrimaryOutfitOrForm;
  const scopeNote = scope.scopeNote.trim();
  const mixingPolicyNote = scope.mixingPolicyNote.trim();
  const payload: TrainingScopePayload = {
    purpose,
    primaryOutfitOrForm,
    advancedExperiment: scope.advancedExperiment,
    mixingPolicy: {
      allowMixedCharacters: scope.allowMixedCharacters,
      allowMultipleOfficialOutfits: scope.allowMultipleOfficialOutfits,
      ...(mixingPolicyNote ? { note: mixingPolicyNote } : {}),
    },
  };

  if (scopeNote) {
    payload.scopeNote = scopeNote;
  }
  if (scope.derivedStates && scope.derivedStates.length > 0) {
    payload.derivedStates = scope.derivedStates;
  }

  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(record: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : fallback;
}

function readBoolean(record: Record<string, unknown> | null | undefined, key: string, fallback: boolean) {
  const value = record?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function readRecordArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const records = value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  return records.length > 0 ? records.map((record) => ({ ...record })) : undefined;
}

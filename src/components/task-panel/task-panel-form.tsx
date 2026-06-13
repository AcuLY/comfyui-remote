"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { CANONICAL_VIEW_SPECS } from "@/lib/character-lora-canonical-views";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  enqueueCanonicalAction,
  rerunCanonicalAction,
  enqueueSectionRunAction,
  draftPromptCardAction,
} from "./task-panel-actions";
import { useTaskPanel } from "./task-panel-provider";

// ---------------------------------------------------------------------------
// Provider options
// ---------------------------------------------------------------------------

const CANONICAL_PROVIDERS = [
  { value: "openai-codex", label: "OpenAI Codex" },
  { value: "mock-local", label: "Mock (本地)" },
];

const PROMPT_CARD_PROVIDERS = [
  { value: "codex-cli", label: "Codex CLI" },
  { value: "openai-codex", label: "OpenAI Codex" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskPanelForm() {
  const { formConfig, baseImages, addTask, clearBaseImages } = useTaskPanel();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Form state
  const [canonicalView, setCanonicalView] = useState("");
  const [provider, setProvider] = useState("openai-codex");
  const [files, setFiles] = useState<File[]>([]);

  // Reset canonical view when base image sets it
  const effectiveCanonicalView =
    baseImages[0]?.canonicalView ?? canonicalView;

  if (!formConfig) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
        <p className="text-xs text-zinc-500">
          请导航到训练项目页面以配置生图任务
        </p>
      </div>
    );
  }

  const { type, jobId, sectionId, sourceImages, disabled, disabledReason } = formConfig;
  const isRerun = baseImages.length > 0;
  const providerOptions = type === "promptCard" ? PROMPT_CARD_PROVIDERS : CANONICAL_PROVIDERS;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formConfig || isPending) return;

    const form = formRef.current;
    if (!form) return;

    startTransition(async () => {
      try {
        const fd = new FormData(form);

        // Append files
        for (const file of files) {
          fd.append("referenceFiles", file);
        }

        // Append base image info for rerun
        if (isRerun && baseImages[0]) {
          fd.set("artifactId", baseImages[0].artifactId ?? "");
          fd.set("relativePath", baseImages[0].relativePath);
          fd.set("sha256", baseImages[0].sha256 ?? "");
        }

        let result;

        if (type === "canonical") {
          if (isRerun) {
            result = await rerunCanonicalAction(jobId, fd);
          } else {
            result = await enqueueCanonicalAction(jobId, fd);
          }
        } else if (type === "section") {
          result = await enqueueSectionRunAction(sectionId!, jobId, fd);
        } else if (type === "promptCard") {
          // draftPromptCardAction expects a plain object
          const operatorNotes = fd.get("operatorNotes") as string;
          const sourceImageIds = fd.getAll("sourceImageIds").map(String).filter(Boolean);
          const canonicalVersionIds = fd.getAll("canonicalVersionIds").map(String).filter(Boolean);
          result = await draftPromptCardAction(jobId, {
            provider: fd.get("provider"),
            operatorNotes: operatorNotes || undefined,
            sourceImageIds: sourceImageIds.length > 0 ? sourceImageIds : undefined,
            canonicalVersionIds: canonicalVersionIds.length > 0 ? canonicalVersionIds : undefined,
          });
        }

        if (result?.ok && result.taskId) {
          addTask({
            taskId: result.taskId,
            jobId,
            type,
            label: getTaskLabel(type, isRerun, effectiveCanonicalView),
            status: "queued",
            workerType: result.workerType ?? type,
            createdAt: new Date().toISOString(),
          });
          if (isRerun) clearBaseImages();
          setFiles([]);
          form.reset();
          toast.success(result.message);
        } else {
          toast.error(result?.message ?? "提交失败");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "提交失败");
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-3"
    >
      {/* Disabled overlay */}
      {disabled && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          {disabledReason ?? "当前不可提交"}
        </div>
      )}

      {/* Canonical view select (canonical type only) */}
      {type === "canonical" && (
        <FieldGroup label="角度">
          <Select
            value={effectiveCanonicalView}
            onChange={setCanonicalView}
            options={CANONICAL_VIEW_SPECS.map((v) => ({
              value: v.key,
              label: v.label,
            }))}
            placeholder="全部角度（4张）"
            size="sm"
            disabled={isRerun && !!baseImages[0]?.canonicalView}
          />
          <input type="hidden" name="canonicalView" value={effectiveCanonicalView} />
        </FieldGroup>
      )}

      {/* Provider */}
      <FieldGroup label="Provider">
        <Select
          value={provider}
          onChange={setProvider}
          options={providerOptions}
          size="sm"
        />
        <input type="hidden" name="provider" value={provider} />
      </FieldGroup>

      {/* File upload (not for promptCard) */}
      {type !== "promptCard" && (
        <FieldGroup label="参考图片">
          <FileUpload files={files} onChange={setFiles} />
        </FieldGroup>
      )}

      {/* Conditional text fields */}
      {type === "canonical" && !isRerun && (
        <>
          <FieldGroup label="角色描述">
            <TextArea name="characterDescription" placeholder="可选，描述角色外观特征…" rows={2} />
          </FieldGroup>
          <FieldGroup label="视觉提示词">
            <TextArea name="visualPrompt" placeholder="可选，补充视觉指令…" rows={2} />
          </FieldGroup>
        </>
      )}

      {type === "canonical" && isRerun && (
        <FieldGroup label="修改指令">
          <TextArea
            name="userInstruction"
            placeholder="描述要修改的内容（必填）…"
            rows={2}
            required
          />
        </FieldGroup>
      )}

      {type === "section" && (
        <FieldGroup label={isRerun ? "修改指令" : "补充指令"}>
          <TextArea
            name="userInstruction"
            placeholder={isRerun ? "描述要修改的内容（必填）…" : "可选，补充生成指令…"}
            rows={2}
            required={isRerun}
          />
        </FieldGroup>
      )}

      {type === "promptCard" && (
        <FieldGroup label="备注">
          <TextArea name="operatorNotes" placeholder="可选，给 AI 的补充说明…" rows={2} />
        </FieldGroup>
      )}

      {/* Negative prompt (not for promptCard) */}
      {type !== "promptCard" && (
        <FieldGroup label="负面提示词">
          <input
            type="text"
            name="negativePrompt"
            placeholder="可选"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-sky-500/30"
          />
        </FieldGroup>
      )}

      {/* Source image checkboxes */}
      {(type === "canonical" || type === "promptCard") && sourceImages && sourceImages.length > 0 && (
        <FieldGroup label="参考源图">
          <div className="max-h-24 space-y-1 overflow-y-auto">
            {sourceImages.map((img) => (
              <label key={img.id} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-300">
                <input
                  type="checkbox"
                  name="sourceImageIds"
                  value={img.id}
                  defaultChecked
                  className="size-3 rounded border-white/20 bg-white/[0.04] accent-sky-500"
                />
                <span className="truncate font-mono text-[10px]">
                  {img.relativePath ? img.relativePath.split("/").pop() : img.id.slice(0, 8)}
                </span>
              </label>
            ))}
          </div>
        </FieldGroup>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={disabled || isPending}
        className="w-full"
        size="sm"
      >
        {isPending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>提交中…</span>
          </>
        ) : (
          <span>{getSubmitLabel(type, isRerun)}</span>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function TextArea({
  name,
  placeholder,
  rows = 2,
  required = false,
}: {
  name: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  return (
    <textarea
      name={name}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-sky-500/30"
    />
  );
}

function FileUpload({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 px-3 py-2",
          "text-xs text-zinc-500 transition hover:border-white/20 hover:text-zinc-400",
        )}
      >
        <Upload className="size-3" />
        <span>{files.length > 0 ? `已选 ${files.length} 个文件` : "上传参考图"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          onChange(selected);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSubmitLabel(type: string, isRerun: boolean) {
  if (type === "promptCard") return "生成提示词草稿";
  if (isRerun) return "重新生成";
  if (type === "section") return "生成训练集图";
  return "生成人设图";
}

function getTaskLabel(type: string, isRerun: boolean, canonicalView: string) {
  if (type === "promptCard") return "提示词草稿";
  if (type === "section") return "训练集候选图";
  const viewLabel = CANONICAL_VIEW_SPECS.find((v) => v.key === canonicalView)?.label ?? "";
  if (isRerun) return `重生 ${viewLabel}人设图`;
  return `${viewLabel || "全角度"}人设图`;
}

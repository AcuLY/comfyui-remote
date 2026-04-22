"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectTemplate,
  updateProjectTemplate,
} from "@/lib/actions";
import { resolveResolution } from "@/lib/aspect-ratio-utils";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import { generateLoraEntryId, type LoraEntry } from "@/lib/lora-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  templateId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialSections?: ProjectTemplateSectionData[];
};

// ---------------------------------------------------------------------------
// TemplateFormClient
// ---------------------------------------------------------------------------

export function TemplateFormClient({
  templateId,
  initialName = "",
  initialDescription = null,
  initialSections = [],
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [sections, setSections] = useState<ProjectTemplateSectionData[]>(initialSections);
  const [isPending, startTransition] = useTransition();

  const isEdit = !!templateId;

  // ── Section management ──

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        sortOrder: prev.length,
        name: null,
        aspectRatio: "2:3",
        shortSidePx: 512,
        batchSize: 2,
        seedPolicy1: "random",
        seedPolicy2: "random",
        ksampler1: null,
        ksampler2: null,
        upscaleFactor: 2,
        loraConfig: { lora1: [], lora2: [] },
        extraParams: null,
        promptBlocks: [],
      },
    ]);
  }

  function removeSection(index: number) {
    setSections((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i })));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }

  // ── Save ──

  function handleSave() {
    if (!name.trim()) {
      toast.error("请输入模板名称");
      return;
    }
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateProjectTemplate({
            id: templateId,
            name: name.trim(),
            description: description.trim() || null,
            sections,
          });
          toast.success("模板已更新");
        } else {
          const id = await createProjectTemplate({
            name: name.trim(),
            description: description.trim() || null,
            sections,
          });
          toast.success("模板已创建");
          router.push(`/settings/templates/${id}/edit`);
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Link
        href="/settings/templates"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
      >
        <ArrowLeft className="size-4" /> 返回模板列表
      </Link>

      {/* Template metadata */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div>
          <label className="text-xs text-zinc-500">模板名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：4 宫格角色展示"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">描述（可选）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="模板用途说明"
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>

      {/* Sections list — two-column grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">
            小节配置 ({sections.length})
          </span>
          <button
            onClick={addSection}
            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-sky-500/30 hover:text-sky-300"
          >
            <Plus className="size-3" /> 添加小节
          </button>
        </div>

        {sections.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
            暂无小节，点击上方按钮添加
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 justify-items-center md:grid-cols-2">
          {sections.map((section, si) => (
            <SectionSummaryCard
              key={si}
              index={si}
              section={section}
              templateId={templateId}
              isFirst={si === 0}
              isLast={si === sections.length - 1}
              onRemove={() => removeSection(si)}
              onMove={(dir) => moveSection(si, dir)}
            />
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        disabled={isPending || !name.trim()}
        onClick={handleSave}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Save className="size-4" /> {isPending ? "保存中…" : isEdit ? "更新模板" : "创建模板"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Summary Card — compact card showing key info, click to edit
// ---------------------------------------------------------------------------

function SectionSummaryCard({
  index,
  section,
  templateId,
  isFirst,
  isLast,
  onRemove,
  onMove,
}: {
  index: number;
  section: ProjectTemplateSectionData;
  templateId?: string;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const aspectRatio = section.aspectRatio || "2:3";
  const res = resolveResolution(aspectRatio, section.shortSidePx ?? 512);
  const resDisplay = `${res.width}x${res.height}`;

  const loraConfig = (section.loraConfig as { lora1: LoraEntry[]; lora2: LoraEntry[] }) || { lora1: [], lora2: [] };
  const loraCount = loraConfig.lora1.length + loraConfig.lora2.length;
  const blockCount = (section.promptBlocks || []).length;

  // If no templateId yet (new template), can't navigate — card not clickable
  const href = templateId
    ? `/settings/templates/${templateId}/sections/${index}`
    : null;

  const CardWrapper = href
    ? ({ children }: { children: React.ReactNode }) => (
        <Link href={href} className="contents">
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <CardWrapper>
      <div className={`w-full rounded-xl border border-white/10 bg-white/[0.03] p-3.5 md:max-w-[500px] transition ${href ? "hover:border-white/20 hover:bg-white/[0.05] cursor-pointer" : ""}`}>
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5 text-zinc-600">
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(-1); }} disabled={isFirst} className="disabled:opacity-20 hover:text-zinc-400 transition">
              <GripVertical className="size-3 -scale-y-100" />
            </button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(1); }} disabled={isLast} className="disabled:opacity-20 hover:text-zinc-400 transition">
              <GripVertical className="size-3" />
            </button>
          </div>
          <span className="shrink-0 text-xs text-zinc-500">#{index + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {section.name || "未命名小节"}
          </span>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
          >
            <Trash2 className="size-3" />
          </button>
        </div>

        {/* Summary metadata */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span>{aspectRatio}</span>
          <span>{resDisplay}</span>
          <span>batch {section.batchSize ?? "—"}</span>
          <span>{section.upscaleFactor ?? 2}x</span>
        </div>
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500">
          {blockCount > 0 && <span>{blockCount} 个 prompt</span>}
          {loraCount > 0 && <span>{loraCount} 个 LoRA</span>}
          {blockCount === 0 && loraCount === 0 && <span>未配置内容</span>}
        </div>
      </div>
    </CardWrapper>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectTemplate,
  updateProjectTemplate,
} from "@/lib/actions";
import { ASPECT_RATIOS, resolveResolution } from "@/lib/aspect-ratio-utils";
import { generateLoraEntryId } from "@/lib/lora-types";
import type { ProjectTemplateSectionData } from "@/lib/server-data";

type Props = {
  templateId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialSections?: ProjectTemplateSectionData[];
};

const RATIO_OPTIONS = Object.keys(ASPECT_RATIOS);

type BlockData = ProjectTemplateSectionData["promptBlocks"][number];
type LoraEntryData = { id: string; path: string; weight: number; enabled: boolean; source: string; sourceLabel?: string; sourceColor?: string; sourceName?: string };

type LoraConfigData = { lora1: LoraEntryData[]; lora2: LoraEntryData[] };

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

  function updateSection(index: number, patch: Partial<ProjectTemplateSectionData>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
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

  // ── Prompt block management ──

  function addBlock(sectionIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const blocks: BlockData[] = [...(s.promptBlocks || []), { label: "", positive: "", negative: null, sortOrder: (s.promptBlocks || []).length }];
        return { ...s, promptBlocks: blocks };
      }),
    );
  }

  function removeBlock(sectionIndex: number, blockIndex: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const blocks = (s.promptBlocks || []).filter((_, bi) => bi !== blockIndex).map((b, bi) => ({ ...b, sortOrder: bi }));
        return { ...s, promptBlocks: blocks };
      }),
    );
  }

  function updateBlock(sectionIndex: number, blockIndex: number, patch: Partial<BlockData>) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const blocks = (s.promptBlocks || []).map((b, bi) => (bi === blockIndex ? { ...b, ...patch } : b));
        return { ...s, promptBlocks: blocks };
      }),
    );
  }

  // ── LoRA management ──

  function addLora(sectionIndex: number, stage: "lora1" | "lora2") {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const config: LoraConfigData = (s.loraConfig as LoraConfigData) || { lora1: [], lora2: [] };
        const entry: LoraEntryData = { id: generateLoraEntryId(), path: "", weight: 1.0, enabled: true, source: "manual" as const };
        return { ...s, loraConfig: { ...config, [stage]: [...config[stage], entry] } };
      }),
    );
  }

  function removeLora(sectionIndex: number, stage: "lora1" | "lora2", loraId: string) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const config: LoraConfigData = (s.loraConfig as LoraConfigData) || { lora1: [], lora2: [] };
        return { ...s, loraConfig: { ...config, [stage]: config[stage].filter((l) => l.id !== loraId) } };
      }),
    );
  }

  function updateLora(sectionIndex: number, stage: "lora1" | "lora2", loraId: string, patch: Partial<LoraEntryData>) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== sectionIndex) return s;
        const config: LoraConfigData = (s.loraConfig as LoraConfigData) || { lora1: [], lora2: [] };
        return {
          ...s,
          loraConfig: { ...config, [stage]: config[stage].map((l) => (l.id === loraId ? { ...l, ...patch } : l)) },
        };
      }),
    );
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
          await createProjectTemplate({
            name: name.trim(),
            description: description.trim() || null,
            sections,
          });
          toast.success("模板已创建");
          router.push("/settings/templates");
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

      {/* Sections list */}
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

        {sections.map((section, si) => (
          <SectionEditor
            key={si}
            index={si}
            section={section}
            isFirst={si === 0}
            isLast={si === sections.length - 1}
            onUpdate={(patch) => updateSection(si, patch)}
            onRemove={() => removeSection(si)}
            onMove={(dir) => moveSection(si, dir)}
            onAddBlock={() => addBlock(si)}
            onRemoveBlock={(bi) => removeBlock(si, bi)}
            onUpdateBlock={(bi, patch) => updateBlock(si, bi, patch)}
            onAddLora={(stage) => addLora(si, stage)}
            onRemoveLora={(stage, loraId) => removeLora(si, stage, loraId)}
            onUpdateLora={(stage, loraId, patch) => updateLora(si, stage, loraId, patch)}
          />
        ))}
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
// Section Editor (per-section card)
// ---------------------------------------------------------------------------

function SectionEditor({
  index,
  section,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMove,
  onAddBlock,
  onRemoveBlock,
  onUpdateBlock,
  onAddLora,
  onRemoveLora,
  onUpdateLora,
}: {
  index: number;
  section: ProjectTemplateSectionData;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<ProjectTemplateSectionData>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddBlock: () => void;
  onRemoveBlock: (blockIndex: number) => void;
  onUpdateBlock: (blockIndex: number, patch: Partial<BlockData>) => void;
  onAddLora: (stage: "lora1" | "lora2") => void;
  onRemoveLora: (stage: "lora1" | "lora2", loraId: string) => void;
  onUpdateLora: (stage: "lora1" | "lora2", loraId: string, patch: Partial<LoraEntryData>) => void;
}) {
  const aspectRatio = section.aspectRatio || "2:3";
  const res = resolveResolution(aspectRatio, section.shortSidePx ?? 512);
  const resDisplay = `${res.width}x${res.height}`;
  const loraConfig = (section.loraConfig as LoraConfigData) || { lora1: [], lora2: [] };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 text-zinc-600">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="disabled:opacity-20 hover:text-zinc-400 transition">
            <GripVertical className="size-3 -scale-y-100" />
          </button>
          <button onClick={() => onMove(1)} disabled={isLast} className="disabled:opacity-20 hover:text-zinc-400 transition">
            <GripVertical className="size-3" />
          </button>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">#{index + 1}</span>
        <input
          type="text"
          value={section.name ?? ""}
          onChange={(e) => onUpdate({ name: e.target.value || null })}
          placeholder="小节名称"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-zinc-600"
        />
        <button
          onClick={onRemove}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-zinc-500 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {/* Parameters grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] text-zinc-500">比例</label>
          <select
            value={aspectRatio}
            onChange={(e) => {
              const ratio = e.target.value;
              const px = section.shortSidePx ?? 512;
              const r = resolveResolution(ratio, px);
              onUpdate({ aspectRatio: ratio, shortSidePx: Math.min(r.width, r.height) });
            }}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          >
            {RATIO_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">短边 px</label>
          <input
            type="number"
            value={section.shortSidePx ?? 512}
            onChange={(e) => onUpdate({ shortSidePx: parseInt(e.target.value, 10) || 512 })}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Batch Size</label>
          <input
            type="number"
            min={1}
            value={section.batchSize ?? 2}
            onChange={(e) => onUpdate({ batchSize: parseInt(e.target.value, 10) || 2 })}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">放大倍数</label>
          <select
            value={section.upscaleFactor ?? 2}
            onChange={(e) => onUpdate({ upscaleFactor: parseFloat(e.target.value) })}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          >
            <option value={1}>1 (跳过)</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={2.5}>2.5x</option>
            <option value={3}>3x</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">种子策略 1</label>
          <select
            value={section.seedPolicy1 ?? "random"}
            onChange={(e) => onUpdate({ seedPolicy1: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          >
            <option value="random">随机</option>
            <option value="fixed">固定</option>
            <option value="increment">递增</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">种子策略 2</label>
          <select
            value={section.seedPolicy2 ?? "random"}
            onChange={(e) => onUpdate({ seedPolicy2: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none"
          >
            <option value="random">随机</option>
            <option value="fixed">固定</option>
            <option value="increment">递增</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-zinc-500">分辨率</label>
          <div className="mt-0.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-400">
            {resDisplay}
          </div>
        </div>
      </div>

      {/* KSampler params */}
      <KSamplerEditor label="KSampler 1" value={section.ksampler1} onChange={(v) => onUpdate({ ksampler1: v })} />
      <KSamplerEditor label="KSampler 2" value={section.ksampler2} onChange={(v) => onUpdate({ ksampler2: v })} />

      {/* Prompt blocks — two-column positive/negative */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-500">提示词 ({(section.promptBlocks || []).length})</span>
          <button onClick={onAddBlock} className="text-[10px] text-zinc-500 hover:text-sky-400 transition">
            + 添加
          </button>
        </div>
        {(section.promptBlocks || []).length === 0 && (
          <div className="rounded-lg border border-dashed border-white/5 p-4 text-center text-[10px] text-zinc-600">
            点击上方添加提示词块
          </div>
        )}
        {(section.promptBlocks || []).map((block, bi) => (
          <div key={bi} className="rounded-lg border border-white/5 bg-white/[0.02] p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={block.label}
                onChange={(e) => onUpdateBlock(bi, { label: e.target.value })}
                placeholder="标签（如角色名）"
                className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white outline-none placeholder:text-zinc-600"
              />
              <button onClick={() => onRemoveBlock(bi)} className="shrink-0 text-zinc-600 hover:text-rose-400 transition">
                <X className="size-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[9px] text-zinc-600">正面</span>
                <textarea
                  value={block.positive}
                  onChange={(e) => onUpdateBlock(bi, { positive: e.target.value })}
                  placeholder="正面提示词"
                  rows={3}
                  className="mt-0.5 w-full resize-none rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white outline-none placeholder:text-zinc-600"
                />
              </div>
              <div>
                <span className="text-[9px] text-zinc-600">负面</span>
                <textarea
                  value={block.negative ?? ""}
                  onChange={(e) => onUpdateBlock(bi, { negative: e.target.value || null })}
                  placeholder="负面提示词（可选）"
                  rows={3}
                  className="mt-0.5 w-full resize-none rounded border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* LoRA config */}
      <LoraEditor
        loraConfig={loraConfig}
        onAdd={onAddLora}
        onRemove={onRemoveLora}
        onUpdate={onUpdateLora}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoRA Editor
// ---------------------------------------------------------------------------

function LoraEditor({
  loraConfig,
  onAdd,
  onRemove,
  onUpdate,
}: {
  loraConfig: LoraConfigData;
  onAdd: (stage: "lora1" | "lora2") => void;
  onRemove: (stage: "lora1" | "lora2", loraId: string) => void;
  onUpdate: (stage: "lora1" | "lora2", loraId: string, patch: Partial<LoraEntryData>) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] text-zinc-500">LoRA 配置</span>
      {(["lora1", "lora2"] as const).map((stage) => (
        <div key={stage} className="rounded-lg border border-white/5 bg-white/[0.02] p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-zinc-400">{stage === "lora1" ? "LoRA 1" : "LoRA 2"}</span>
            <button
              onClick={() => onAdd(stage)}
              className="text-[10px] text-zinc-600 hover:text-sky-400 transition"
            >
              + 添加
            </button>
          </div>
          {loraConfig[stage].length === 0 && (
            <div className="px-1 py-2 text-center text-[10px] text-zinc-600">无</div>
          )}
          {loraConfig[stage].map((lora) => (
            <div key={lora.id} className="flex items-center gap-1.5 rounded border border-white/5 bg-black/20 px-2 py-1.5">
              <input
                type="text"
                value={lora.path}
                onChange={(e) => onUpdate(stage, lora.id, { path: e.target.value })}
                placeholder="LoRA 路径"
                className="min-w-0 flex-1 rounded border border-white/10 bg-black/20 px-1.5 py-1 text-[10px] text-white outline-none placeholder:text-zinc-700"
              />
              <label className="flex shrink-0 items-center gap-0.5 text-[10px] text-zinc-500">
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={2}
                  value={lora.weight}
                  onChange={(e) => onUpdate(stage, lora.id, { weight: parseFloat(e.target.value) || 0 })}
                  className="w-12 rounded border border-white/10 bg-black/20 px-1 py-1 text-center text-[10px] text-white outline-none"
                />
              </label>
              <button
                onClick={() => onUpdate(stage, lora.id, { enabled: !lora.enabled })}
                className={`shrink-0 rounded px-1.5 py-1 text-[9px] ${lora.enabled ? "bg-sky-500/20 text-sky-300" : "bg-white/5 text-zinc-600"}`}
              >
                {lora.enabled ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => onRemove(stage, lora.id)}
                className="shrink-0 text-zinc-600 hover:text-rose-400 transition"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KSampler JSON editor (collapsible)
// ---------------------------------------------------------------------------

function KSamplerEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(!!value);
  const [text, setText] = useState(value ? JSON.stringify(value, null, 2) : "");

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setText(value ? JSON.stringify(value, null, 2) : "");
          setIsOpen(true);
        }}
        className="w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5 text-left text-[11px] text-zinc-500 transition hover:bg-white/[0.04]"
      >
        {label}: {value ? "已配置" : "使用默认"}
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              try {
                const parsed = JSON.parse(text);
                onChange(parsed);
                toast.success("已应用");
              } catch {
                toast.error("JSON 格式错误");
              }
            }}
            className="rounded px-2 py-0.5 text-[10px] text-sky-400 hover:bg-sky-500/10 transition"
          >
            应用
          </button>
          <button
            onClick={() => {
              onChange(null);
              setText("");
              setIsOpen(false);
            }}
            className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/[0.04] transition"
          >
            重置
          </button>
          <button onClick={() => setIsOpen(false)} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">
            收起
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-white outline-none placeholder:text-zinc-600"
        placeholder='{"steps": 30, "cfg": 7, ...}'
      />
    </div>
  );
}

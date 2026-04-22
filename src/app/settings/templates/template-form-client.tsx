"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Download } from "lucide-react";
import { toast } from "sonner";
import {
  createProjectTemplate,
  updateProjectTemplate,
} from "@/lib/actions";
import { ASPECT_RATIOS, resolveResolution } from "@/lib/aspect-ratio-utils";
import { generateLoraEntryId, type LoraEntry } from "@/lib/lora-types";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import { ImportPresetPanel, type ImportCategory } from "@/components/section-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import { TemplatePromptBlockEditor, type TemplateBlockData } from "@/components/template-prompt-block-editor";
import type { PromptLibraryV2 } from "@/components/prompt-block-editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  templateId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialSections?: ProjectTemplateSectionData[];
  library?: PromptLibraryV2;
};

const RATIO_OPTIONS = Object.keys(ASPECT_RATIOS);

type CategoryConfig = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

// ---------------------------------------------------------------------------
// TemplateFormClient
// ---------------------------------------------------------------------------

export function TemplateFormClient({
  templateId,
  initialName = "",
  initialDescription = null,
  initialSections = [],
  library,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [sections, setSections] = useState<ProjectTemplateSectionData[]>(initialSections);
  const [isPending, startTransition] = useTransition();

  const isEdit = !!templateId;

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryConfig>();
    for (const cat of library?.categories ?? []) {
      map.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon });
    }
    return map;
  }, [library]);

  const importCategories: ImportCategory[] = library?.categories ?? [];

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
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
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
            categoryMap={categoryMap}
            importCategories={importCategories}
            library={library}
            onUpdate={(patch) => updateSection(si, patch)}
            onRemove={() => removeSection(si)}
            onMove={(dir) => moveSection(si, dir)}
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
  categoryMap,
  importCategories,
  library,
  onUpdate,
  onRemove,
  onMove,
}: {
  index: number;
  section: ProjectTemplateSectionData;
  isFirst: boolean;
  isLast: boolean;
  categoryMap: Map<string, CategoryConfig>;
  importCategories: ImportCategory[];
  library?: PromptLibraryV2;
  onUpdate: (patch: Partial<ProjectTemplateSectionData>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [showImport, setShowImport] = useState(false);
  const aspectRatio = section.aspectRatio || "2:3";
  const res = resolveResolution(aspectRatio, section.shortSidePx ?? 512);
  const resDisplay = `${res.width}x${res.height}`;

  const loraConfig = (section.loraConfig as { lora1: LoraEntry[]; lora2: LoraEntry[] }) || { lora1: [], lora2: [] };

  // ── Prompt blocks change handler ──

  function handleBlocksChange(blocks: TemplateBlockData[]) {
    onUpdate({ promptBlocks: blocks });
  }

  // ── LoRA change handlers ──

  function handleLora1Change(entries: LoraEntry[]) {
    onUpdate({ loraConfig: { ...loraConfig, lora1: entries } });
  }

  function handleLora2Change(entries: LoraEntry[]) {
    onUpdate({ loraConfig: { ...loraConfig, lora2: entries } });
  }

  // ── Preset import handler ──

  function handleImportPreset(
    presetId: string,
    presetName: string,
    variantId: string,
    variantName: string,
    prompt: string,
    negativePrompt: string | null,
    lora1: unknown,
    lora2: unknown,
    categoryId: string,
    categoryName: string,
    categoryColor: string | null,
  ) {
    importPresets([
      { presetName, prompt, negativePrompt, lora1, lora2, categoryId, categoryName, categoryColor },
    ]);
  }

  /** Import multiple presets at once — avoids stale closure state */
  function importPresets(
    items: Array<{
      presetName: string;
      prompt: string;
      negativePrompt: string | null;
      lora1: unknown;
      lora2: unknown;
      categoryId: string;
      categoryName: string;
      categoryColor: string | null;
    }>,
  ) {
    const currentBlocks = [...(section.promptBlocks || [])];
    const currentLora1 = [...loraConfig.lora1];
    const currentLora2 = [...loraConfig.lora2];

    const parseLoraEntries = (arr: unknown, categoryName: string, categoryColor: string | null, presetName: string): LoraEntry[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null && typeof e.path === "string")
        .map((e) => ({
          id: generateLoraEntryId(),
          path: e.path as string,
          weight: typeof e.weight === "number" ? Math.round(e.weight * 100) / 100 : 1,
          enabled: typeof e.enabled === "boolean" ? e.enabled : true,
          source: "preset" as const,
          sourceLabel: categoryName,
          sourceColor: categoryColor ?? undefined,
          sourceName: presetName,
        }));
    };

    for (const item of items) {
      currentBlocks.push({
        label: item.presetName,
        positive: item.prompt,
        negative: item.negativePrompt,
        sortOrder: currentBlocks.length,
        categoryId: item.categoryId,
      });
      currentLora1.push(...parseLoraEntries(item.lora1, item.categoryName, item.categoryColor, item.presetName));
      currentLora2.push(...parseLoraEntries(item.lora2, item.categoryName, item.categoryColor, item.presetName));
    }

    onUpdate({
      promptBlocks: currentBlocks,
      loraConfig: { lora1: currentLora1, lora2: currentLora2 },
    });

    if (items.length === 1) {
      toast.success(`已导入「${items[0].presetName}」`);
    } else {
      toast.success(`已导入 ${items.length} 个预制`);
    }
  }

  function handleImportGroup(groupId: string) {
    const allCategories = library?.categories ?? [];

    for (const cat of allCategories) {
      const group = (cat.groups ?? []).find((g) => g.id === groupId);
      if (!group) continue;

      const items: Array<{
        presetName: string;
        prompt: string;
        negativePrompt: string | null;
        lora1: unknown;
        lora2: unknown;
        categoryId: string;
        categoryName: string;
        categoryColor: string | null;
      }> = [];

      for (const member of group.members) {
        if (!member.presetId) continue;

        let foundPreset: { preset: typeof cat.presets[number]; cat: typeof cat } | null = null;
        for (const c of allCategories) {
          const p = c.presets.find((pr) => pr.id === member.presetId);
          if (p) { foundPreset = { preset: p, cat: c }; break; }
        }
        if (!foundPreset) continue;

        const variant = member.variantId
          ? foundPreset.preset.variants.find((v) => v.id === member.variantId)
          : foundPreset.preset.variants[0];
        if (!variant) continue;

        items.push({
          presetName: foundPreset.preset.name,
          prompt: variant.prompt,
          negativePrompt: variant.negativePrompt,
          lora1: variant.lora1,
          lora2: variant.lora2,
          categoryId: foundPreset.cat.id,
          categoryName: foundPreset.cat.name,
          categoryColor: foundPreset.cat.color,
        });
      }

      if (items.length > 0) {
        importPresets(items);
      }
      return;
    }
    toast.error("未找到预制组");
  }

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
          <input type="number" value={section.shortSidePx ?? 512} onChange={(e) => onUpdate({ shortSidePx: parseInt(e.target.value, 10) || 512 })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">Batch Size</label>
          <input type="number" min={1} value={section.batchSize ?? 2} onChange={(e) => onUpdate({ batchSize: parseInt(e.target.value, 10) || 2 })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">放大倍数</label>
          <select value={section.upscaleFactor ?? 2} onChange={(e) => onUpdate({ upscaleFactor: parseFloat(e.target.value) })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none">
            <option value={1}>1 (跳过)</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
            <option value={2.5}>2.5x</option>
            <option value={3}>3x</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">种子策略 1</label>
          <select value={section.seedPolicy1 ?? "random"} onChange={(e) => onUpdate({ seedPolicy1: e.target.value })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none">
            <option value="random">随机</option>
            <option value="fixed">固定</option>
            <option value="increment">递增</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500">种子策略 2</label>
          <select value={section.seedPolicy2 ?? "random"} onChange={(e) => onUpdate({ seedPolicy2: e.target.value })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white outline-none">
            <option value="random">随机</option>
            <option value="fixed">固定</option>
            <option value="increment">递增</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-zinc-500">分辨率</label>
          <div className="mt-0.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-400">{resDisplay}</div>
        </div>
      </div>

      {/* KSampler params */}
      <KSamplerEditor label="KSampler 1" value={section.ksampler1} onChange={(v) => onUpdate({ ksampler1: v })} />
      <KSamplerEditor label="KSampler 2" value={section.ksampler2} onChange={(v) => onUpdate({ ksampler2: v })} />

      {/* Import preset button */}
      {importCategories.length > 0 && (
        <>
          {showImport ? (
            <ImportPresetPanel
              categories={importCategories}
              onImport={handleImportPreset}
              onImportGroup={handleImportGroup}
              onClose={() => setShowImport(false)}
              isPending={false}
            />
          ) : (
            <button
              onClick={() => setShowImport(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-3 py-2 text-xs text-sky-400 transition hover:bg-sky-500/[0.08]"
            >
              <Download className="size-3.5" /> 导入预制
            </button>
          )}
        </>
      )}

      {/* Prompt blocks — uses TemplatePromptBlockEditor */}
      <TemplatePromptBlockEditor
        blocks={section.promptBlocks || []}
        onChange={handleBlocksChange}
        categoryMap={categoryMap}
      />

      {/* LoRA config — uses LoraListEditor */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-zinc-400">LoRA 配置</span>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-sky-400">LoRA 1</div>
            <LoraListEditor entries={loraConfig.lora1} onChange={handleLora1Change} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-violet-400">LoRA 2</div>
            <LoraListEditor entries={loraConfig.lora2} onChange={handleLora2Change} />
          </div>
        </div>
      </div>
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
        onClick={() => { setText(value ? JSON.stringify(value, null, 2) : ""); setIsOpen(true); }}
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
          <button onClick={() => { try { onChange(JSON.parse(text)); toast.success("已应用"); } catch { toast.error("JSON 格式错误"); } }} className="rounded px-2 py-0.5 text-[10px] text-sky-400 hover:bg-sky-500/10 transition">应用</button>
          <button onClick={() => { onChange(null); setText(""); setIsOpen(false); }} className="rounded px-2 py-0.5 text-[10px] text-zinc-500 hover:bg-white/[0.04] transition">重置</button>
          <button onClick={() => setIsOpen(false)} className="text-[10px] text-zinc-600 hover:text-zinc-400 transition">收起</button>
        </div>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-[11px] text-white outline-none placeholder:text-zinc-600" placeholder='{"steps": 30, "cfg": 7, ...}' />
    </div>
  );
}

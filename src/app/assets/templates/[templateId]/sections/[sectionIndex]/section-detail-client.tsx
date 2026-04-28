"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Save, Download, X } from "lucide-react";
import { toast } from "sonner";
import { updateProjectTemplate } from "@/lib/actions";
import { AspectRatioPicker } from "@/components/aspect-ratio-picker";
import { BatchSizeQuickFill } from "@/components/batch-size-quick-fill";
import { UpscaleFactorQuickFill } from "@/components/upscale-factor-quick-fill";
import { KSamplerPanel, parseInitialKSampler } from "@/components/ksampler-panel";
import { ImportPresetPanel, type ImportCategory } from "@/components/section-editor";
import { LoraListEditor } from "@/components/lora-list-editor";
import { TemplatePromptBlockEditor, type TemplateBlockData } from "@/components/template-prompt-block-editor";
import { generateLoraEntryId, type LoraEntry, DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2, type KSamplerParams } from "@/lib/lora-types";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import type { PresetLibraryV2 } from "@/components/prompt-block-editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryConfig = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
};

type Props = {
  templateId: string;
  sectionIndex: number;
  totalSections: number;
  section: ProjectTemplateSectionData;
  allSections: ProjectTemplateSectionData[];
  library?: PresetLibraryV2;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateSectionDetailClient({
  templateId,
  sectionIndex,
  totalSections,
  section: initialSection,
  allSections,
  library,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Local state for the section ──
  // For template sections, null means "not set" (will not override on import)
  const [name, setName] = useState(initialSection.name ?? "");
  const [aspectRatio, setAspectRatio] = useState<string | null>(initialSection.aspectRatio ?? null);
  const [shortSidePx, setShortSidePx] = useState<number | null>(initialSection.shortSidePx ?? null);
  const [batchSize, setBatchSize] = useState<string | null>(initialSection.batchSize?.toString() ?? null);
  const [upscaleFactor, setUpscaleFactor] = useState<string | null>(initialSection.upscaleFactor?.toString() ?? null);
  const [ks1, setKs1] = useState<KSamplerParams | null>(() => {
    if (!initialSection.ksampler1) return null;
    return parseInitialKSampler(initialSection.ksampler1, DEFAULT_KSAMPLER1);
  });
  const [ks2, setKs2] = useState<KSamplerParams | null>(() => {
    if (!initialSection.ksampler2) return null;
    return parseInitialKSampler(initialSection.ksampler2, DEFAULT_KSAMPLER2);
  });
  const [promptBlocks, setPromptBlocks] = useState<TemplateBlockData[]>(
    initialSection.promptBlocks || [],
  );
  const [loraConfig, setLoraConfig] = useState<{ lora1: LoraEntry[]; lora2: LoraEntry[] }>(
    (initialSection.loraConfig as { lora1: LoraEntry[]; lora2: LoraEntry[] }) || { lora1: [], lora2: [] },
  );
  const [showImport, setShowImport] = useState(false);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryConfig>();
    for (const cat of library?.categories ?? []) {
      map.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon });
    }
    return map;
  }, [library]);

  const importCategories: ImportCategory[] = library?.categories ?? [];

  // ── Save ──

  function buildUpdatedSection(): ProjectTemplateSectionData {
    return {
      id: initialSection.id,
      sortOrder: sectionIndex,
      name: name.trim() || null,
      aspectRatio, // null means not set
      shortSidePx,
      batchSize: batchSize ? parseInt(batchSize, 10) : null,
      seedPolicy1: ks1?.seedPolicy ?? null,
      seedPolicy2: ks2?.seedPolicy ?? null,
      ksampler1: ks1 as unknown as Record<string, unknown> | null,
      ksampler2: ks2 as unknown as Record<string, unknown> | null,
      upscaleFactor: upscaleFactor ? parseFloat(upscaleFactor) : null,
      loraConfig: loraConfig as unknown as Record<string, unknown>,
      extraParams: initialSection.extraParams,
      promptBlocks,
    };
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const updated = buildUpdatedSection();
        const newSections = allSections.map((s, i) =>
          i === sectionIndex ? updated : s,
        );
        await updateProjectTemplate({
          id: templateId,
          sections: newSections,
        });
        toast.success("小节已保存");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }

  // ── Navigation ──

  const basePath = `/assets/templates/${templateId}/edit`;

  function navigateToSection(index: number) {
    router.push(`/assets/templates/${templateId}/sections/${index}`);
  }

  // ── LoRA change handlers ──

  function handleLora1Change(entries: LoraEntry[]) {
    setLoraConfig((prev) => ({ ...prev, lora1: entries }));
  }

  function handleLora2Change(entries: LoraEntry[]) {
    setLoraConfig((prev) => ({ ...prev, lora2: entries }));
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
    groupBindingId?: string,
  ) {
    const currentBlocks = [...promptBlocks];
    const currentLora1 = [...loraConfig.lora1];
    const currentLora2 = [...loraConfig.lora2];

    for (const item of items) {
      // Generate a bindingId for this preset import
      const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
            bindingId,
            groupBindingId,
          }));
      };

      currentBlocks.push({
        label: item.presetName,
        positive: item.prompt,
        negative: item.negativePrompt,
        sortOrder: currentBlocks.length,
        type: "preset",
        categoryId: item.categoryId,
        bindingId,
        groupBindingId,
      });
      currentLora1.push(...parseLoraEntries(item.lora1, item.categoryName, item.categoryColor, item.presetName));
      currentLora2.push(...parseLoraEntries(item.lora2, item.categoryName, item.categoryColor, item.presetName));
    }

    setPromptBlocks(currentBlocks);
    setLoraConfig({ lora1: currentLora1, lora2: currentLora2 });

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
        // Generate a groupBindingId for all presets in this group
        const groupBindingId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        importPresets(items, groupBindingId);
      }
      return;
    }
    toast.error("未找到预制组");
  }

  // ── Render ──

  const inputCls =
    "input-number w-full rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-sky-500/30 disabled:opacity-70";

  return (
    <div className="space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" /> 返回模板
        </Link>
        <div className="flex items-center gap-2">
          <button
            disabled={sectionIndex === 0}
            onClick={() => navigateToSection(sectionIndex - 1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs text-zinc-400">
            {sectionIndex + 1} / {totalSections}
          </span>
          <button
            disabled={sectionIndex >= totalSections - 1}
            onClick={() => navigateToSection(sectionIndex + 1)}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Section name */}
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <label className="text-xs text-zinc-500">小节名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="小节名称"
          className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Run params — same layout as blocks page */}
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-400">运行参数</div>
          <div className="text-[10px] text-zinc-500">空值参数在导入时不会覆盖项目设置</div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">画幅比例</div>
              {aspectRatio !== null && (
                <button
                  type="button"
                  onClick={() => { setAspectRatio(null); setShortSidePx(null); }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {aspectRatio === null ? (
              <button
                type="button"
                onClick={() => { setAspectRatio("2:3"); setShortSidePx(512); }}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <AspectRatioPicker
                name="aspectRatio"
                defaultValue={aspectRatio}
                defaultShortSidePx={shortSidePx}
                disabled={isPending}
                onChange={() => {}}
                onValueChange={(ratio, px) => {
                  setAspectRatio(ratio || "2:3");
                  setShortSidePx(px);
                }}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">Batch Size</div>
              {batchSize !== null && (
                <button
                  type="button"
                  onClick={() => setBatchSize(null)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {batchSize === null ? (
              <button
                type="button"
                onClick={() => setBatchSize("")}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  disabled={isPending}
                  value={batchSize}
                  onChange={(e) => setBatchSize(e.target.value || null)}
                  placeholder="不设置"
                  className={inputCls}
                />
                <BatchSizeQuickFill
                  onSelect={(val) => setBatchSize(String(val))}
                  currentValue={batchSize ? parseInt(batchSize, 10) : null}
                  disabled={isPending}
                  size="sm"
                />
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">放大倍数</div>
              {upscaleFactor !== null && (
                <button
                  type="button"
                  onClick={() => setUpscaleFactor(null)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {upscaleFactor === null ? (
              <button
                type="button"
                onClick={() => setUpscaleFactor("2")}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  max={4}
                  step={0.5}
                  value={upscaleFactor}
                  onChange={(v) => setUpscaleFactor(v.target.value || null)}
                  disabled={isPending}
                  className={inputCls}
                />
                <UpscaleFactorQuickFill
                  onSelect={(val) => setUpscaleFactor(String(val))}
                  currentValue={upscaleFactor ? parseFloat(upscaleFactor) : null}
                  disabled={isPending}
                  size="sm"
                />
                {upscaleFactor === "1" && (
                  <p className="text-[10px] text-amber-400/70">
                    1x 模式将跳过 Upscale Latent 和 KSampler2（无高清修复）
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* KSampler panels */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">KSampler1（第一阶段）</div>
              {ks1 !== null && (
                <button
                  type="button"
                  onClick={() => setKs1(null)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {ks1 === null ? (
              <button
                type="button"
                onClick={() => setKs1({ ...DEFAULT_KSAMPLER1 })}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <KSamplerPanel
                label=""
                subtitle={`steps ${ks1.steps ?? DEFAULT_KSAMPLER1.steps} · cfg ${ks1.cfg ?? DEFAULT_KSAMPLER1.cfg} · ${ks1.sampler_name ?? DEFAULT_KSAMPLER1.sampler_name}`}
                params={ks1}
                defaults={DEFAULT_KSAMPLER1}
                onChange={setKs1}
                onFieldBlur={() => {}}
                disabled={isPending}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-zinc-500">KSampler2（高清修复）</div>
              {ks2 !== null && (
                <button
                  type="button"
                  onClick={() => setKs2(null)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  清除
                </button>
              )}
            </div>
            {ks2 === null ? (
              <button
                type="button"
                onClick={() => setKs2({ ...DEFAULT_KSAMPLER2 })}
                className="w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                点击设置
              </button>
            ) : (
              <KSamplerPanel
                label=""
                subtitle={upscaleFactor === "1" ? "1x 模式下不使用" : `steps ${ks2.steps ?? DEFAULT_KSAMPLER2.steps} · cfg ${ks2.cfg ?? DEFAULT_KSAMPLER2.cfg} · ${ks2.sampler_name ?? DEFAULT_KSAMPLER2.sampler_name}`}
                params={ks2}
                defaults={DEFAULT_KSAMPLER2}
                onChange={setKs2}
                onFieldBlur={() => {}}
                disabled={isPending || upscaleFactor === "1"}
              />
            )}
          </div>
        </div>
      </div>

      {/* Import preset */}
      {importCategories.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {showImport ? (
            <ImportPresetPanel
              categories={importCategories}
              onImport={handleImportPreset}
              onImportGroup={handleImportGroup}
              onClose={() => setShowImport(false)}
              isPending={isPending}
            />
          ) : (
            <button
              onClick={() => setShowImport(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/20 bg-sky-500/[0.03] px-3 py-2 text-xs text-sky-400 transition hover:bg-sky-500/[0.08]"
            >
              <Download className="size-3.5" /> 导入预制
            </button>
          )}
        </div>
      )}

      {/* Prompt blocks */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="text-xs font-medium text-zinc-400">Prompt Blocks</div>
        <TemplatePromptBlockEditor
          blocks={promptBlocks}
          onChange={setPromptBlocks}
          categoryMap={categoryMap}
        />
      </div>

      {/* LoRA config */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="text-xs font-medium text-zinc-400">LoRA 配置</div>
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

      {/* Save button */}
      <button
        disabled={isPending}
        onClick={handleSave}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
      >
        <Save className="size-4" /> {isPending ? "保存中…" : "保存小节"}
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { resolveTemplatePresetImports, updateProjectTemplateSection } from "@/lib/actions/template-crud";
import { parseInitialKSampler } from "@/components/ksampler-panel";
import type { ImportCategory } from "@/components/section-editor";
import {
  getSectionPresetBindingGroupName,
  getSectionPresetManagerHref,
} from "@/components/section-editor-binding-rules";
import { NeighborNavigation } from "@/components/neighbor-navigation";
import { generateLoraEntryId, type LoraEntry, DEFAULT_KSAMPLER1, DEFAULT_KSAMPLER2, type KSamplerParams } from "@/lib/lora-types";
import { hrefWithFolderQuery } from "@/lib/folder-navigation";
import { normalizeAspectRatioList } from "@/lib/aspect-ratio-utils";
import type { ProjectTemplateSectionData } from "@/lib/server-data";
import type { PresetLibraryV2 } from "@/components/prompt-block-editor";
import {
  TemplateSectionPromptBlocks,
  type TemplateBlockData,
  type TemplateSectionPromptCategoryConfig,
} from "./template-section-prompt-blocks";
import { TemplateSectionLoraEditor } from "./template-section-lora-editor";
import {
  TemplateSectionPresetBindings,
  type TemplateSectionPresetBindingInfo,
} from "./template-section-preset-bindings";
import { TemplateSectionForm } from "./template-section-form";

const AUTO_SAVE_DELAY = 600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PresetImportItem = {
  presetId: string;
  presetName: string;
  variantId: string;
  variantName: string;
  label: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: Array<{ path: string; weight: number; enabled: boolean }>;
  lora2: Array<{ path: string; weight: number; enabled: boolean }>;
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  categoryOrders: {
    positivePromptOrder: number;
    lora1Order: number;
    lora2Order: number;
  };
};

type Props = {
  templateId: string;
  sectionIndex: number;
  sectionPosition: number;
  totalSections: number;
  previousSectionIndex: number | null;
  nextSectionIndex: number | null;
  section: ProjectTemplateSectionData;
  library?: PresetLibraryV2;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateSectionDetailClient({
  templateId,
  sectionIndex,
  sectionPosition,
  totalSections,
  previousSectionIndex,
  nextSectionIndex,
  section: initialSection,
  library,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ── Local state for the section ──
  // For template sections, null means "not set" (will not override on import)
  const [name, setName] = useState(initialSection.name ?? "");
  const [notes, setNotes] = useState(initialSection.notes ?? "");
  const [aspectRatios, setAspectRatios] = useState<string[] | null>(() => {
    const values = normalizeAspectRatioList(initialSection.aspectRatios, initialSection.aspectRatio);
    return values.length > 0 ? values : null;
  });
  const [shortSidePx, setShortSidePx] = useState<number | null>(initialSection.shortSidePx ?? null);
  const [batchSize, setBatchSize] = useState<string | null>(initialSection.batchSize?.toString() ?? null);
  const [upscaleFactor, setUpscaleFactor] = useState<string | null>(initialSection.upscaleFactor?.toString() ?? null);
  const [useTwoStageKSampler, setUseTwoStageKSampler] = useState<boolean>(
    initialSection.useTwoStageKSampler ?? true,
  );
  const [checkpointName, setCheckpointName] = useState<string | null>(initialSection.checkpointName ?? null);
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const aspectRatio = aspectRatios?.[0] ?? null;

  const categoryMap = useMemo(() => {
    const map = new Map<string, TemplateSectionPromptCategoryConfig>();
    for (const cat of library?.categories ?? []) {
      map.set(cat.id, { id: cat.id, name: cat.name, slug: cat.slug, color: cat.color, icon: cat.icon });
    }
    return map;
  }, [library]);

  const importCategories: ImportCategory[] = useMemo(
    () => (library?.categories ?? []).filter((cat) =>
      cat.type === "group"
        ? (cat.groups ?? []).length > 0
        : cat.presets.some((preset) => preset.variants.length > 0),
    ),
    [library],
  );

  const presetBindings = useMemo<TemplateSectionPresetBindingInfo[]>(() => {
    const map = new Map<string, TemplateSectionPresetBindingInfo>();
    const groupNamesByBindingId = new Map<string, string>();
    const blocksByGroupBindingId = new Map<string, TemplateBlockData[]>();
    const categoryOrderById = new Map<string, number>();

    (library?.categories ?? []).forEach((cat, index) => {
      categoryOrderById.set(cat.id, cat.positivePromptOrder ?? index);
    });

    for (const block of promptBlocks) {
      if (block.bindingId && block.groupBindingId && block.type === "preset") {
        const groupBlocks = blocksByGroupBindingId.get(block.groupBindingId) ?? [];
        groupBlocks.push(block);
        blocksByGroupBindingId.set(block.groupBindingId, groupBlocks);
      }
    }

    for (const groupBlocks of blocksByGroupBindingId.values()) {
      const seenBindingIds = new Set<string>();
      const names = [...groupBlocks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((block) => {
          if (!block.bindingId || seenBindingIds.has(block.bindingId)) return false;
          seenBindingIds.add(block.bindingId);
          return true;
        })
        .map((block) => block.label.trim())
        .filter(Boolean);
      const groupName = names.join(" · ");
      if (groupName) {
        for (const block of groupBlocks) {
          if (block.bindingId) groupNamesByBindingId.set(block.bindingId, groupName);
        }
      }
    }

    for (const block of promptBlocks) {
      if (!block.bindingId || block.type !== "preset") continue;
      const existing = map.get(block.bindingId);
      if (existing) {
        existing.blockCount++;
        continue;
      }

      let availableVariants: Array<{ id: string; name: string }> = [];
      let categoryName: string | undefined;
      let categoryColor: string | undefined;
      let sourceId = block.sourceId ?? null;
      let variantId = block.variantId ?? null;
      const presetGroupId = block.presetGroupId ?? null;
      if (library) {
        if (presetGroupId) {
          for (const cat of library.categories) {
            const group = (cat.groups ?? []).find((item) => item.id === presetGroupId);
            if (group) {
              categoryName = cat.name;
              categoryColor = cat.color ?? undefined;
              break;
            }
          }
          sourceId = null;
          variantId = null;
        } else if (!sourceId && block.categoryId) {
          const cat = library.categories.find((item) => item.id === block.categoryId);
          const preset = cat?.presets.find((item) => block.label === item.name || block.label.startsWith(`${item.name} /`));
          if (preset) {
            sourceId = preset.id;
            const variantName = block.label.startsWith(`${preset.name} /`)
              ? block.label.slice(preset.name.length + 3)
              : "";
            variantId = preset.variants.find((item) => item.name === variantName)?.id ?? variantId;
          }
        }
        if (!presetGroupId && sourceId) {
          for (const cat of library.categories) {
            const preset = sourceId ? cat.presets.find((item) => item.id === sourceId) : undefined;
            if (preset) {
              availableVariants = preset.variants.map((variant) => ({ id: variant.id, name: variant.name }));
              categoryName = cat.name;
              categoryColor = cat.color ?? undefined;
              break;
            }
          }
        }
        if (!categoryName && block.categoryId) {
          const cat = library.categories.find((item) => item.id === block.categoryId);
          if (cat) {
            categoryName = cat.name;
            categoryColor = cat.color ?? undefined;
          }
        }
      }

      map.set(block.bindingId, {
        bindingId: block.bindingId,
        presetName: block.label,
        groupName: getSectionPresetBindingGroupName({ presetGroupId }, library) ??
          groupNamesByBindingId.get(block.bindingId),
        sourceId,
        variantId,
        presetGroupId,
        categoryId: block.categoryId ?? null,
        categoryName,
        categoryColor,
        groupBindingId: block.groupBindingId ?? null,
        blockCount: 1,
        loraCount: 0,
        sortOrder: block.sortOrder,
        availableVariants,
      });
    }

    for (const entry of [...loraConfig.lora1, ...loraConfig.lora2]) {
      if (!entry.bindingId) continue;
      const existing = map.get(entry.bindingId);
      if (existing) existing.loraCount++;
    }

    return [...map.values()].sort((a, b) => {
      const orderA = a.categoryId ? (categoryOrderById.get(a.categoryId) ?? 999) : 999;
      const orderB = b.categoryId ? (categoryOrderById.get(b.categoryId) ?? 999) : 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.sortOrder - b.sortOrder;
    });
  }, [promptBlocks, loraConfig, library]);

  // ── Save ──

  const buildUpdatedSection = useCallback((): ProjectTemplateSectionData => {
    return {
      id: initialSection.id,
      folderId: initialSection.folderId,
      sortOrder: sectionIndex,
      name: name.trim() || null,
      notes: notes.trim() || null,
      aspectRatio,
      aspectRatios,
      shortSidePx,
      batchSize: batchSize ? parseInt(batchSize, 10) : null,
      seedPolicy1: ks1?.seedPolicy ?? null,
      seedPolicy2: ks2?.seedPolicy ?? null,
      ksampler1: ks1 as unknown as Record<string, unknown> | null,
      ksampler2: ks2 as unknown as Record<string, unknown> | null,
      upscaleFactor: upscaleFactor ? parseFloat(upscaleFactor) : null,
      useTwoStageKSampler,
      checkpointName: checkpointName?.trim() ? checkpointName.trim() : null,
      loraConfig: loraConfig as unknown as Record<string, unknown>,
      extraParams: initialSection.extraParams,
      promptBlocks,
    };
  }, [
    aspectRatio,
    aspectRatios,
    batchSize,
    initialSection.extraParams,
    initialSection.folderId,
    initialSection.id,
    ks1,
    ks2,
    loraConfig,
    name,
    notes,
    checkpointName,
    promptBlocks,
    sectionIndex,
    shortSidePx,
    upscaleFactor,
    useTwoStageKSampler,
  ]);

  const saveCurrentSection = useCallback(() => {
    startTransition(async () => {
      try {
        const updated = buildUpdatedSection();
        await updateProjectTemplateSection({
          templateId,
          sectionId: initialSection.id,
          section: updated,
        });
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "保存失败");
      }
    });
  }, [buildUpdatedSection, initialSection.id, templateId]);

  useEffect(() => {
    saveRef.current = saveCurrentSection;
  }, [saveCurrentSection]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveRef.current();
    }, AUTO_SAVE_DELAY);
  }, []);

  const saveOnBlur = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveRef.current();
  }, []);

  const scheduleSaveAfterState = useCallback(() => {
    setTimeout(scheduleSave, 0);
  }, [scheduleSave]);

  // ── Navigation ──

  const basePath = hrefWithFolderQuery(
    `/assets/templates/${templateId}/edit`,
    "sectionFolder",
    initialSection.folderId,
  );

  function navigateToSection(index: number | null) {
    if (index === null) return;
    router.push(`/assets/templates/${templateId}/sections/${index}`);
  }

  // ── LoRA change handlers ──

  function handleLora1Change(entries: LoraEntry[]) {
    setLoraConfig((prev) => ({ ...prev, lora1: entries }));
    scheduleSaveAfterState();
  }

  function handleLora2Change(entries: LoraEntry[]) {
    setLoraConfig((prev) => ({ ...prev, lora2: entries }));
    scheduleSaveAfterState();
  }

  function detachLoraEntryFromBinding(entry: LoraEntry, bindingId: string): LoraEntry {
    if (entry.bindingId !== bindingId) return entry;
    return {
      ...entry,
      source: "manual",
      sourceLabel: undefined,
      sourceColor: undefined,
      sourceName: undefined,
      detachedBindingId: entry.detachedBindingId ?? entry.bindingId,
      detachedGroupBindingId: entry.detachedGroupBindingId ?? entry.groupBindingId,
      detachedPresetPath: entry.detachedPresetPath ?? entry.path,
      bindingId: undefined,
      groupBindingId: undefined,
    };
  }

  function detachLorasForPromptBinding(bindingId: string) {
    setLoraConfig((prev) => ({
      lora1: prev.lora1.map((entry) => detachLoraEntryFromBinding(entry, bindingId)),
      lora2: prev.lora2.map((entry) => detachLoraEntryFromBinding(entry, bindingId)),
    }));
    scheduleSaveAfterState();
  }

  // ── Preset import handler ──

  function parseLoraEntries(
    arr: unknown,
    item: PresetImportItem,
    bindingId: string,
    groupBindingId?: string,
  ): LoraEntry[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && typeof entry.path === "string")
      .map((entry) => ({
        id: generateLoraEntryId(),
        path: entry.path as string,
        weight: typeof entry.weight === "number" ? Math.round(entry.weight * 100) / 100 : 1,
        enabled: typeof entry.enabled === "boolean" ? entry.enabled : true,
        source: "preset" as const,
        sourceLabel: item.categoryName,
        sourceColor: item.categoryColor ?? undefined,
        sourceName: item.presetName,
        bindingId,
        groupBindingId,
      }));
  }

  function getPresetCategoryOrder(categoryId: string): number {
    const categoryIndex = library?.categories.findIndex((cat) => cat.id === categoryId) ?? -1;
    const category = categoryIndex >= 0 ? library?.categories[categoryIndex] : undefined;
    return category?.positivePromptOrder ?? (categoryIndex >= 0 ? categoryIndex : 999);
  }

  function getLoraCategoryOrder(entry: LoraEntry, dimension: "lora1" | "lora2"): number {
    if (entry.source !== "preset" || !entry.sourceLabel) return 999;
    const category = library?.categories.find((cat) => cat.name === entry.sourceLabel);
    if (!category) return 999;
    return dimension === "lora1" ? (category.lora1Order ?? 999) : (category.lora2Order ?? 999);
  }

  function sortLoraEntries(entries: LoraEntry[], dimension: "lora1" | "lora2") {
    return entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => getLoraCategoryOrder(a.entry, dimension) - getLoraCategoryOrder(b.entry, dimension) || a.index - b.index)
      .map(({ entry }) => entry);
  }

  function getPresetManagerHref(binding: TemplateSectionPresetBindingInfo): string {
    return getSectionPresetManagerHref(binding, library);
  }

  function handleImportPreset(
    presetId: string,
    variantId: string,
  ) {
    startTransition(async () => {
      const [item] = await resolveTemplatePresetImports([{ presetId, variantId }]);
      if (item) importPresets([item]);
    });
  }

  function importPresets(items: PresetImportItem[], groupBindingId?: string) {
    const orderedItems = items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const orderA = getPresetCategoryOrder(a.item.categoryId);
        const orderB = getPresetCategoryOrder(b.item.categoryId);
        if (orderA !== orderB) return orderA - orderB;
        return a.index - b.index;
      })
      .map(({ item }) => item);
    const currentBlocks = [...promptBlocks];
    const currentLora1 = [...loraConfig.lora1];
    const currentLora2 = [...loraConfig.lora2];

    for (const item of orderedItems) {
      // Generate a bindingId for this preset import
      const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      currentBlocks.push({
        label: item.label,
        positive: item.prompt,
        negative: item.negativePrompt,
        sortOrder: currentBlocks.length,
        type: "preset",
        sourceId: item.presetId,
        variantId: item.variantId,
        categoryId: item.categoryId,
        bindingId,
        groupBindingId,
      });
      currentLora1.push(...parseLoraEntries(item.lora1, item, bindingId, groupBindingId));
      currentLora2.push(...parseLoraEntries(item.lora2, item, bindingId, groupBindingId));
    }

    const sortedBlocks = currentBlocks
      .map((block, index) => ({
        block,
        index,
        order: block.categoryId ? getPresetCategoryOrder(block.categoryId) : 999,
      }))
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ block }, index) => ({ ...block, sortOrder: index }));

    setPromptBlocks(sortedBlocks);
    setLoraConfig({
      lora1: sortLoraEntries(currentLora1, "lora1"),
      lora2: sortLoraEntries(currentLora2, "lora2"),
    });
    setShowImport(false);
    scheduleSaveAfterState();

    if (items.length === 1) {
      toast.success(`已导入「${items[0].presetName}」`);
    } else {
      toast.success(`已导入 ${items.length} 个预制`);
    }
  }

  function handleImportGroup(groupId: string) {
    startTransition(() => {
      let selectedCategory: ImportCategory | null = null;
      let selectedGroup: NonNullable<ImportCategory["groups"]>[number] | null = null;
      for (const cat of library?.categories ?? []) {
        const group = (cat.groups ?? []).find((item) => item.id === groupId);
        if (group) {
          selectedCategory = cat;
          selectedGroup = group;
          break;
        }
      }

      if (!selectedCategory || !selectedGroup) {
        toast.error("未找到预制组");
        return;
      }

      const positiveParts: string[] = [];
      const negativeParts: string[] = [];
      for (const member of selectedGroup.members) {
        if (!member.presetId) continue;
        for (const cat of library?.categories ?? []) {
          const preset = cat.presets.find((item) => item.id === member.presetId);
          if (!preset) continue;
          const variant = member.variantId
            ? preset.variants.find((item) => item.id === member.variantId)
            : preset.variants[0];
          if (variant?.prompt.trim()) positiveParts.push(variant.prompt.trim());
          if (variant?.negativePrompt?.trim()) negativeParts.push(variant.negativePrompt.trim());
          break;
        }
      }

      const bindingId = `bind-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const groupBindingId = `group-${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const groupBlock: TemplateBlockData = {
        label: selectedGroup.name,
        positive: positiveParts.join("\n"),
        negative: negativeParts.length > 0 ? negativeParts.join("\n") : null,
        sortOrder: promptBlocks.length,
        type: "preset",
        sourceId: null,
        variantId: null,
        presetGroupId: groupId,
        categoryId: selectedCategory.id,
        bindingId,
        groupBindingId,
      };
      const currentBlocks = [...promptBlocks, groupBlock];
      const sortedBlocks = currentBlocks
        .map((block, index) => ({
          block,
          index,
          order: block.categoryId ? getPresetCategoryOrder(block.categoryId) : 999,
        }))
        .sort((a, b) => a.order - b.order || a.index - b.index)
        .map(({ block }, index) => ({ ...block, sortOrder: index }));

      setPromptBlocks(sortedBlocks);
      setShowImport(false);
      scheduleSaveAfterState();
      toast.success(selectedGroup.name);
    });
  }

  // ── Render ──

  function handleSwitchVariant(bindingId: string, newVariantId: string) {
    const binding = presetBindings.find((item) => item.bindingId === bindingId);
    if (!binding?.sourceId) return;
    startTransition(async () => {
      const [item] = await resolveTemplatePresetImports([
        { presetId: binding.sourceId!, variantId: newVariantId },
      ]);
      if (!item) return;

      const groupBindingId = binding.groupBindingId ?? undefined;
      setPromptBlocks((prev) =>
        prev.map((block) =>
          block.bindingId === bindingId
            ? {
                ...block,
                label: item.label,
                positive: item.prompt,
                negative: item.negativePrompt,
                sourceId: item.presetId,
                variantId: item.variantId,
                categoryId: item.categoryId,
              }
            : block,
        ),
      );

      const nextLora1 = loraConfig.lora1.filter((entry) => entry.bindingId !== bindingId);
      const nextLora2 = loraConfig.lora2.filter((entry) => entry.bindingId !== bindingId);
      nextLora1.push(...parseLoraEntries(item.lora1, item, bindingId, groupBindingId));
      nextLora2.push(...parseLoraEntries(item.lora2, item, bindingId, groupBindingId));
      setLoraConfig({
        lora1: sortLoraEntries(nextLora1, "lora1"),
        lora2: sortLoraEntries(nextLora2, "lora2"),
      });
      scheduleSaveAfterState();
    });
  }

  function handleDeleteBinding(bindingId: string) {
    const binding = presetBindings.find((item) => item.bindingId === bindingId);
    if (!binding) return;

    const bindingIds = new Set<string>([bindingId]);
    if (binding.groupBindingId) {
      for (const block of promptBlocks) {
        if (block.groupBindingId === binding.groupBindingId && block.bindingId) {
          bindingIds.add(block.bindingId);
        }
      }
    }

    setPromptBlocks((prev) =>
      prev
        .filter((block) => !block.bindingId || !bindingIds.has(block.bindingId))
        .map((block, index) => ({ ...block, sortOrder: index })),
    );
    setLoraConfig({
      lora1: loraConfig.lora1.filter((entry) => !entry.bindingId || !bindingIds.has(entry.bindingId)),
      lora2: loraConfig.lora2.filter((entry) => !entry.bindingId || !bindingIds.has(entry.bindingId)),
    });
    scheduleSaveAfterState();
  }

  function handleStandaloneDeleteBinding(bindingId: string) {
    setPromptBlocks((prev) =>
      prev
        .filter((block) => block.bindingId !== bindingId)
        .map((block, index) => ({ ...block, sortOrder: index })),
    );
    setLoraConfig({
      lora1: loraConfig.lora1.filter((entry) => entry.bindingId !== bindingId),
      lora2: loraConfig.lora2.filter((entry) => entry.bindingId !== bindingId),
    });
    scheduleSaveAfterState();
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      {/* Navigation bar */}
      <div className="flex items-center justify-between">
        <Link
          href={basePath}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" /> 返回模板
        </Link>
        <NeighborNavigation
          previousOnClick={() => navigateToSection(previousSectionIndex)}
          nextOnClick={() => navigateToSection(nextSectionIndex)}
          previousDisabled={previousSectionIndex === null}
          nextDisabled={nextSectionIndex === null}
          previousLabel={null}
          nextLabel={null}
          previousTitle="上一节"
          nextTitle="下一节"
          previousAriaLabel="上一节"
          nextAriaLabel="下一节"
          positionText={`${sectionPosition + 1} / ${totalSections}`}
          className="gap-2"
          controlClassName="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 transition hover:bg-white/[0.08] disabled:opacity-30"
          disabledControlClassName="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 opacity-30"
          iconClassName="size-4"
        />
      </div>

      <TemplateSectionForm
        name={name}
        notes={notes}
        aspectRatio={aspectRatio}
        aspectRatios={aspectRatios}
        shortSidePx={shortSidePx}
        batchSize={batchSize}
        upscaleFactor={upscaleFactor}
        useTwoStageKSampler={useTwoStageKSampler}
        checkpointName={checkpointName}
        ks1={ks1}
        ks2={ks2}
        isPending={isPending}
        onNameChange={setName}
        onNotesChange={setNotes}
        onAspectRatiosChange={setAspectRatios}
        onShortSidePxChange={setShortSidePx}
        onBatchSizeChange={setBatchSize}
        onUpscaleFactorChange={setUpscaleFactor}
        onUseTwoStageKSamplerChange={setUseTwoStageKSampler}
        onCheckpointNameChange={setCheckpointName}
        onKSampler1Change={setKs1}
        onKSampler2Change={setKs2}
        onSaveNow={saveOnBlur}
        onScheduleSaveAfterState={scheduleSaveAfterState}
      />

      <TemplateSectionPresetBindings
        presetBindings={presetBindings}
        importCategories={importCategories}
        showImport={showImport}
        isPending={isPending}
        getDetailHref={getPresetManagerHref}
        onToggleImport={() => setShowImport((current) => !current)}
        onCloseImport={() => setShowImport(false)}
        onImportPreset={handleImportPreset}
        onImportGroup={handleImportGroup}
        onUseBindingName={(binding) => {
          setName(binding.groupName ?? binding.presetName);
          scheduleSaveAfterState();
        }}
        onSwitchVariant={handleSwitchVariant}
        onStandaloneDeleteBinding={handleStandaloneDeleteBinding}
        onDeleteBinding={handleDeleteBinding}
      />

      <TemplateSectionPromptBlocks
        blocks={promptBlocks}
        onChange={(nextBlocks) => {
          setPromptBlocks(nextBlocks);
          scheduleSaveAfterState();
        }}
        onDetachBinding={detachLorasForPromptBinding}
        categoryMap={categoryMap}
      />

      <TemplateSectionLoraEditor
        loraConfig={loraConfig}
        onLora1Change={handleLora1Change}
        onLora2Change={handleLora2Change}
        presetBindings={presetBindings}
      />

      {isPending && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-center text-[11px] text-zinc-500">
          保存中…
        </div>
      )}
    </div>
  );
}

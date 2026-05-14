"use client";

import { useCallback, useMemo, useState } from "react";

import type { DemoImage } from "../../../data";
import { demoHref, rawSectionId } from "../../../routing";
import {
  type HistoryDiffChange,
  type ImportCategory,
  type KSamplerFull,
  type LoraRowData,
  type PresetBinding,
  type PresetImportSelection,
  type PromptBlockRowData,
  type SaveStatus,
  type SectionTabValue,
} from "./editor-parts";
import {
  buildBindings,
  groupImagesByRun,
  initialLora1,
  initialLora2,
  initialPromptBlocks,
  mockVariants,
} from "./editor-page-data";
import type { HistoryDimKey, ImageStatus, ResultsFilter, SectionEditorLoadedProps } from "./types";

export function useSectionEditorState({ data, project, section }: SectionEditorLoadedProps) {
  const [tab, setTab] = useState<SectionTabValue>("params");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [aspectRatio, setAspectRatio] = useState(section.aspectRatio || "2:3");
  const [shortSidePx, setShortSidePx] = useState(section.shortSidePx || 768);
  const [batchSize, setBatchSize] = useState(section.batchSize || 2);
  const [checkpointName, setCheckpointName] = useState(section.checkpointName || "");
  const [upscaleFactor, setUpscaleFactor] = useState(Number(section.upscaleFactor) || 2);

  const [ksampler1, setKsampler1] = useState<KSamplerFull>(() => ({
    steps: section.ksampler1?.steps ?? 28,
    cfg: section.ksampler1?.cfg ?? 7,
    sampler_name: section.ksampler1?.sampler_name ?? "euler_ancestral",
    scheduler: section.ksampler1?.scheduler ?? "normal",
    denoise: 1,
    seedPolicy: section.seedPolicy1 ?? "random",
  }));
  const [ksampler2, setKsampler2] = useState<KSamplerFull>(() => ({
    steps: section.ksampler2?.steps ?? 18,
    cfg: section.ksampler2?.cfg ?? 5.5,
    sampler_name: section.ksampler2?.sampler_name ?? "dpmpp_2m_sde",
    scheduler: section.ksampler2?.scheduler ?? "karras",
    denoise: 0.5,
    seedPolicy: section.seedPolicy2 ?? "random",
  }));

  const [bindings, setBindings] = useState<PresetBinding[]>(() => buildBindings(section, project));
  const [importOpen, setImportOpen] = useState(false);
  const [importSelection, setImportSelection] = useState<PresetImportSelection | null>(null);

  const [promptBlocks, setPromptBlocks] = useState<PromptBlockRowData[]>(initialPromptBlocks);
  const [expandedBlockKey, setExpandedBlockKey] = useState<string | null>(null);

  const [lora1, setLora1] = useState<LoraRowData[]>(initialLora1);
  const [lora2, setLora2] = useState<LoraRowData[]>(initialLora2);

  const [historyDim, setHistoryDim] = useState<HistoryDimKey>("all");

  const [images, setImages] = useState<DemoImage[]>(section.images);
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>("all");
  const [lightboxImageId, setLightboxImageId] = useState<string | null>(null);

  const flashSave = useCallback(() => {
    setSaveStatus("saving");
    window.setTimeout(() => {
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1200);
    }, 450);
  }, []);

  const sectionIdx = project.sections.findIndex(
    (sec) => rawSectionId(sec) === rawSectionId(section),
  );
  const prevSection = sectionIdx > 0 ? project.sections[sectionIdx - 1] : null;
  const nextSection =
    sectionIdx >= 0 && sectionIdx < project.sections.length - 1
      ? project.sections[sectionIdx + 1]
      : null;

  const importCategories: ImportCategory[] = useMemo(
    () =>
      data.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        presets: cat.presets.map((p) => ({
          id: p.id,
          name: p.name,
          variantCount: p.variantCount,
        })),
        groups: cat.groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        })),
      })),
    [data.categories],
  );

  const commitPresetImport = useCallback(
    (selection: PresetImportSelection) => {
      const cat = importCategories.find((c) => c.id === selection.categoryId);
      if (!cat) return;

      if (selection.type === "preset") {
        const preset = cat.presets.find((p) => p.id === selection.id);
        if (!preset) return;
        setBindings((prev) => [
          ...prev,
          {
            id: `binding-${Date.now()}`,
            kind: "preset",
            scope: "section",
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            name: preset.name,
            variantId: "v-default",
            variantName: "默认",
            blockCount: 1,
            loraCount: 1,
            variants: mockVariants(),
            detailHref: demoHref(`/presets/${preset.id}`),
          },
        ]);
      } else {
        const group = cat.groups?.find((g) => g.id === selection.id);
        if (!group) return;
        const variants = mockVariants();
        setBindings((prev) => [
          ...prev,
          ...Array.from({ length: group.memberCount }).map((_, i) => ({
            id: `binding-${Date.now()}-${i}`,
            kind: "group" as const,
            scope: "section" as const,
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            name: `${group.name} #${i + 1}`,
            variantId: variants[0]?.id,
            variantName: variants[0]?.name,
            blockCount: 1,
            loraCount: i === 0 ? 1 : 0,
            variants,
            detailHref: demoHref(`/presets/${group.id}-${i}`),
          })),
        ]);
        flashSave();
        return;
      }

      flashSave();
    },
    [flashSave, importCategories],
  );

  const compiledPromptGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string;
        presetName?: string;
        variantName?: string;
        categoryName: string;
        positive: string[];
        negative: string[];
      }
    >();

    for (const block of promptBlocks) {
      const positive = block.positive.trim();
      const negative = block.negative.trim();
      if (!positive && !negative) continue;

      const groupName = block.presetName ?? block.label ?? block.categoryName;
      const key = `${groupName}::${block.variantName ?? ""}`;
      const group =
        groups.get(key) ??
        {
          id: key,
          presetName: block.presetName ?? block.label,
          variantName: block.variantName,
          categoryName: block.categoryName,
          positive: [],
          negative: [],
        };

      if (positive) group.positive.push(positive);
      if (negative) group.negative.push(negative);
      groups.set(key, group);
    }

    return Array.from(groups.values());
  }, [promptBlocks]);

  const history: HistoryDiffChange[] = useMemo(() => {
    if (section.changeHistory?.length) {
      return section.changeHistory.map((c) => ({ ...c }));
    }

    return [
      {
        id: `${section.id}-change-params`,
        timestamp: "2 小时前",
        dimension: "params",
        title: "更新运行参数",
        before: JSON.stringify({ batchSize: 2, shortSidePx: 512, upscaleFactor: 1.5 }),
        after: JSON.stringify({
          batchSize: section.batchSize,
          shortSidePx: section.shortSidePx,
          upscaleFactor: section.upscaleFactor,
        }),
        diff: [
          { field: "batchSize", before: "2", after: String(section.batchSize) },
          { field: "shortSidePx", before: "512", after: String(section.shortSidePx) },
          { field: "upscaleFactor", before: "1.5", after: String(section.upscaleFactor) },
        ],
      },
      {
        id: `${section.id}-change-preset`,
        timestamp: "昨天",
        dimension: "preset",
        title: "导入小节预制",
        before: null,
        after: JSON.stringify({ bindings: bindings.slice(0, 2).map((b) => b.name) }),
        diff: [
          {
            field: "presetBindings",
            before: "—",
            after: bindings.slice(0, 2).map((b) => b.name).join("、") || "默认预制",
          },
        ],
      },
      {
        id: `${section.id}-change-prompt`,
        timestamp: "昨天",
        dimension: "prompt",
        title: "调整提示词块",
        before: JSON.stringify({ positive: "1girl, solo" }),
        after: JSON.stringify({ positive: promptBlocks[0]?.positive ?? "1girl, solo" }),
        diff: [
          {
            field: "promptBlocks[0].positive",
            before: "1girl, solo",
            after: promptBlocks[0]?.positive || "1girl, solo",
          },
        ],
      },
      {
        id: `${section.id}-change-lora`,
        timestamp: "2 天前",
        dimension: "lora",
        title: "更新 LoRA 权重",
        before: JSON.stringify({ lora1: [] }),
        after: JSON.stringify({ lora1: lora1.map((item) => ({ path: item.filePath, weight: item.weight })) }),
        diff: [
          {
            field: "lora1[0].path",
            before: "—",
            after: lora1[0]?.filePath || lora1[0]?.fileName || "未选择",
          },
          {
            field: "lora1[0].weight",
            before: "—",
            after: String(lora1[0]?.weight ?? 0.5),
          },
        ],
      },
    ];
  }, [bindings, lora1, promptBlocks, section]);

  const filteredHistory = useMemo(() => {
    if (historyDim === "all") return history;
    return history.filter((h) => h.dimension === historyDim);
  }, [history, historyDim]);

  const historyCounts = useMemo(() => {
    const counts = { params: 0, preset: 0, prompt: 0, lora: 0 } as Record<string, number>;
    for (const c of history) counts[c.dimension] = (counts[c.dimension] ?? 0) + 1;
    return counts;
  }, [history]);

  const tabs: Array<{ value: SectionTabValue; label: string; count?: number }> = [
    { value: "params", label: "Comfy 参数" },
    { value: "presets", label: "预制", count: bindings.length },
    { value: "prompts", label: "提示词块", count: promptBlocks.length },
    { value: "lora", label: "LoRA", count: lora1.length + lora2.length },
    { value: "history", label: "变更记录", count: history.length },
    { value: "results", label: "运行结果", count: images.length },
  ];

  const runs = useMemo(() => groupImagesByRun(images, section.latestRunIndex), [images, section.latestRunIndex]);

  const keptCount = images.filter((i) => i.status === "kept").length;
  const pendingCount = images.filter((i) => i.status === "pending").length;

  const filteredImages = useMemo(() => {
    return images.filter((img) => {
      if (resultsFilter === "all") return true;
      if (resultsFilter === "featured") return img.featured;
      return img.status === resultsFilter;
    });
  }, [images, resultsFilter]);
  const filteredImageIds = useMemo(() => new Set(filteredImages.map((img) => img.id)), [filteredImages]);

  const lightboxImage = lightboxImageId
    ? images.find((i) => i.id === lightboxImageId) ?? null
    : null;
  const lightboxImageIndex = lightboxImage
    ? filteredImages.findIndex((image) => image.id === lightboxImage.id)
    : -1;

  const updateBatchSize = (value: number) => {
    setBatchSize(value);
    flashSave();
  };

  const updateAspectRatio = (value: string) => {
    setAspectRatio(value);
    flashSave();
  };

  const updateShortSidePx = (value: number) => {
    setShortSidePx(value);
    flashSave();
  };

  const updateUpscaleFactor = (value: number) => {
    setUpscaleFactor(value);
    flashSave();
  };

  const updateCheckpointName = (value: string) => {
    setCheckpointName(value);
    flashSave();
  };

  const updateKSampler1 = (next: KSamplerFull) => {
    setKsampler1(next);
    flashSave();
  };

  const updateKSampler2 = (next: KSamplerFull) => {
    setKsampler2(next);
    flashSave();
  };

  const handleBindingVariantChange = (bindingId: string, variantId: string, memberId?: string) => {
    setBindings((prev) =>
      prev.map((binding) => {
        if (binding.id !== bindingId) return binding;
        if (memberId && binding.members) {
          return {
            ...binding,
            members: binding.members.map((member) =>
              member.id === memberId
                ? {
                    ...member,
                    variantId,
                    variantName:
                      member.variants?.find((variant) => variant.id === variantId)?.name ??
                      member.variantName,
                  }
                : member,
            ),
          };
        }
        return {
          ...binding,
          variantId,
          variantName:
            binding.variants?.find((variant) => variant.id === variantId)?.name ??
            binding.variantName,
        };
      }),
    );
    flashSave();
  };

  const handleBindingUnlink = (binding: PresetBinding, memberId?: string) => {
    if (memberId) {
      setBindings((prev) =>
        prev.map((item) =>
          item.id === binding.id
            ? { ...item, members: item.members?.filter((member) => member.id !== memberId) }
            : item,
        ),
      );
    } else {
      setBindings((prev) => prev.filter((item) => item.id !== binding.id));
    }
    flashSave();
  };

  const handleBindingDelete = (binding: PresetBinding) => {
    setBindings((prev) => prev.filter((item) => item.id !== binding.id));
    flashSave();
  };

  const togglePromptBlock = (column: "positive" | "negative", blockId: string) => {
    const key = `${column}:${blockId}`;
    setExpandedBlockKey((current) => (current === key ? null : key));
  };

  const updatePromptPositive = (blockId: string, value: string) => {
    setPromptBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, positive: value } : block)),
    );
    flashSave();
  };

  const updatePromptNegative = (blockId: string, value: string) => {
    setPromptBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, negative: value } : block)),
    );
    flashSave();
  };

  const unlinkPromptBlock = (blockId: string) => {
    setPromptBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? { ...block, kind: "manual", presetName: undefined, variantName: undefined }
          : block,
      ),
    );
    flashSave();
  };

  const deletePromptBlock = (blockId: string) => {
    setPromptBlocks((prev) => prev.filter((block) => block.id !== blockId));
    flashSave();
  };

  const addPromptBlock = () => {
    const id = `block-${Date.now()}`;
    setPromptBlocks((prev) => [
      ...prev,
      {
        id,
        label: "新 Block",
        categoryName: "自定义",
        categoryColor: "220 10% 60%",
        positive: "",
        negative: "",
        kind: "manual",
      },
    ]);
    setExpandedBlockKey(`positive:${id}`);
    flashSave();
  };

  const addLora1 = () => {
    setLora1((prev) => [
      ...prev,
      {
        id: `lora1-${Date.now()}`,
        fileName: "未选择",
        filePath: "",
        weight: 0.5,
        enabled: true,
        kind: "manual",
      },
    ]);
  };

  const addLora2 = () => {
    setLora2((prev) => [
      ...prev,
      {
        id: `lora2-${Date.now()}`,
        fileName: "未选择",
        filePath: "",
        weight: 0.5,
        enabled: true,
        kind: "manual",
      },
    ]);
  };

  const updateLora1Weight = (id: string, weight: number) => {
    setLora1((prev) => prev.map((entry) => (entry.id === id ? { ...entry, weight } : entry)));
    flashSave();
  };

  const updateLora2Weight = (id: string, weight: number) => {
    setLora2((prev) => prev.map((entry) => (entry.id === id ? { ...entry, weight } : entry)));
    flashSave();
  };

  const toggleLora1 = (id: string) => {
    setLora1((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, enabled: !entry.enabled } : entry)),
    );
    flashSave();
  };

  const toggleLora2 = (id: string) => {
    setLora2((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, enabled: !entry.enabled } : entry)),
    );
    flashSave();
  };

  const updateLora1Path = (id: string, path: string) => {
    setLora1((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, filePath: path, fileName: path.split("/").pop() || path }
          : entry,
      ),
    );
    flashSave();
  };

  const updateLora2Path = (id: string, path: string) => {
    setLora2((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, filePath: path, fileName: path.split("/").pop() || path }
          : entry,
      ),
    );
    flashSave();
  };

  const removeLora1 = (id: string) => {
    setLora1((prev) => prev.filter((entry) => entry.id !== id));
    flashSave();
  };

  const removeLora2 = (id: string) => {
    setLora2((prev) => prev.filter((entry) => entry.id !== id));
    flashSave();
  };

  const markStatus = (imageId: string, status: ImageStatus) => {
    setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, status } : img)));
    flashSave();
  };

  const toggleFeatured = (imageId: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, featured: !img.featured } : img)),
    );
    flashSave();
  };

  const bulkStatusForRun = (runIdx: number, status: ImageStatus) => {
    const runImgIds = new Set(runs.find((run) => run.runIndex === runIdx)?.images.map((img) => img.id) ?? []);
    setImages((prev) => prev.map((img) => (runImgIds.has(img.id) ? { ...img, status } : img)));
    flashSave();
  };

  const downloadHref = `/api/projects/${project.id}/section-workflow/${rawSectionId(section)}`;

  return {
    project,
    section,
    tab,
    setTab,
    saveStatus,
    setSaveStatus,
    flashSave,
    prevSection,
    nextSection,
    downloadHref,
    tabs,
    aspectRatio,
    shortSidePx,
    batchSize,
    checkpointName,
    upscaleFactor,
    ksampler1,
    ksampler2,
    updateAspectRatio,
    updateShortSidePx,
    updateBatchSize,
    updateUpscaleFactor,
    updateCheckpointName,
    updateKSampler1,
    updateKSampler2,
    bindings,
    importOpen,
    setImportOpen,
    importSelection,
    setImportSelection,
    importCategories,
    commitPresetImport,
    handleBindingVariantChange,
    handleBindingUnlink,
    handleBindingDelete,
    promptBlocks,
    expandedBlockKey,
    compiledPromptGroups,
    togglePromptBlock,
    updatePromptPositive,
    updatePromptNegative,
    unlinkPromptBlock,
    deletePromptBlock,
    addPromptBlock,
    lora1,
    lora2,
    addLora1,
    addLora2,
    updateLora1Weight,
    updateLora2Weight,
    toggleLora1,
    toggleLora2,
    updateLora1Path,
    updateLora2Path,
    removeLora1,
    removeLora2,
    history,
    historyDim,
    setHistoryDim,
    filteredHistory,
    historyCounts,
    images,
    resultsFilter,
    setResultsFilter,
    runs,
    keptCount,
    pendingCount,
    filteredImages,
    filteredImageIds,
    lightboxImage,
    lightboxImageIndex,
    setLightboxImageId,
    markStatus,
    toggleFeatured,
    bulkStatusForRun,
  };
}

export type SectionEditorModel = ReturnType<typeof useSectionEditorState>;

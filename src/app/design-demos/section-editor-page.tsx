"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, Plus, Star, Trash2, Check, Image as ImageIcon } from "lucide-react";

import type { DemoData, DemoImage, DemoProject, DemoSection } from "./design-demo-data";
import { cx, demoHref, rawSectionId } from "./design-demo-utils";
import {
  type SaveStatus,
  type SectionTabValue,
  type PresetBinding,
  type PromptBlockRowData,
  type LoraRowData,
  type HistoryDiffChange,
  type PresetImportSelection,
  SectionHeader,
  SectionTabs,
  SpecSection,
  SpecRow,
  CheckpointPicker,
  AspectChips,
  StepperInput,
  UpscaleControl,
  DimensionsReadout,
  KSamplerCard,
  PresetBindingRow,
  PresetImportInline,
  PromptBlockRow,
  CompiledPromptPreview,
  HistoryDiffRow,
  dimensionLabel,
  type KSamplerFull,
  type ImportCategory,
} from "./section-editor-components";
import s from "./design-demo-styles";
import { LoraColumn } from "./section-editor-lora-column";
import {
  CHECKPOINT_OPTIONS,
  buildBindings,
  groupImagesByRun,
  initialLora1,
  initialLora2,
  initialPromptBlocks,
  mockVariants,
} from "./section-editor-page-data";
import { ImagePreviewLarge, ImageThumbMedium } from "./design-demo-ui";

type SectionEditorPageProps = {
  data: DemoData;
  project: DemoProject | undefined;
  section: DemoSection | undefined;
};

type HistoryDimKey = "all" | "params" | "preset" | "prompt" | "lora";

export function SectionEditorPage({ data, project, section }: SectionEditorPageProps) {
  if (!project || !section) {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <Link href={demoHref("/projects")} className={s.pageBackLink}>
            <ChevronLeft className="size-4" />
            返回项目
          </Link>
          <div className={s.pageTitleBlock}>
            <span className={s.eyebrow}>小节</span>
            <h1 className={s.pageTitle}>未找到小节</h1>
          </div>
        </div>
      </div>
    );
  }
  return <SectionEditorInner data={data} project={project} section={section} />;
}

function SectionEditorInner({
  data,
  project,
  section,
}: {
  data: DemoData;
  project: DemoProject;
  section: DemoSection;
}) {
  const [tab, setTab] = useState<SectionTabValue>("params");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Run params state
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

  // Preset bindings
  const [bindings, setBindings] = useState<PresetBinding[]>(() => buildBindings(section, project));
  const [importOpen, setImportOpen] = useState(false);
  const [importSelection, setImportSelection] = useState<PresetImportSelection | null>(null);

  // Prompt blocks
  const [promptBlocks, setPromptBlocks] = useState<PromptBlockRowData[]>(initialPromptBlocks);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  // LoRA
  const [lora1, setLora1] = useState<LoraRowData[]>(initialLora1);
  const [lora2, setLora2] = useState<LoraRowData[]>(initialLora2);

  // History
  const [historyDim, setHistoryDim] = useState<HistoryDimKey>("all");

  // Results (images)
  const [images, setImages] = useState<DemoImage[]>(section.images);
  const [resultsFilter, setResultsFilter] = useState<"all" | "pending" | "kept" | "trashed" | "featured">("all");
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

  // Build preset import data
  const importCategories: ImportCategory[] = data.categories.map((cat) => ({
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
  }));

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
        setBindings((prev) => [
          ...prev,
          {
            id: `binding-${Date.now()}`,
            kind: "group",
            scope: "section",
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            name: group.name,
            blockCount: group.memberCount * 2,
            loraCount: group.memberCount,
            members: Array.from({ length: group.memberCount }).map((_, i) => ({
              id: `m-${Date.now()}-${i}`,
              presetName: `${group.name} 成员 ${i + 1}`,
              variantName: "默认",
              variants: mockVariants(),
              detailHref: demoHref(`/presets/${group.id}`),
            })),
          },
        ]);
      }

      flashSave();
    },
    [flashSave, importCategories],
  );

  // Compiled prompt preview data — grouped by preset, preserving preset order.
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

  // History
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

  // Tabs and counts
  const tabs: Array<{ value: SectionTabValue; label: string; count?: number }> = [
    { value: "params", label: "Comfy 参数" },
    { value: "presets", label: "预制", count: bindings.length },
    { value: "prompts", label: "提示词块", count: promptBlocks.length },
    { value: "lora", label: "LoRA", count: lora1.length + lora2.length },
    { value: "history", label: "变更记录", count: history.length },
    { value: "results", label: "运行结果", count: images.length },
  ];

  // Results grouped by run
  const runs = useMemo(() => groupImagesByRun(images, section.latestRunIndex), [images, section.latestRunIndex]);

  const keptCount = images.filter((i) => i.status === "kept").length;
  const pendingCount = images.filter((i) => i.status === "pending").length;

  const filteredImageIds = useMemo(() => {
    return new Set(
      images
        .filter((img) => {
          if (resultsFilter === "all") return true;
          if (resultsFilter === "featured") return img.featured;
          return img.status === resultsFilter;
        })
        .map((img) => img.id),
    );
  }, [images, resultsFilter]);

  const lightboxImage = lightboxImageId
    ? images.find((i) => i.id === lightboxImageId) ?? null
    : null;

  const markStatus = (imageId: string, status: DemoImage["status"]) => {
    setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, status } : img)));
    flashSave();
  };
  const toggleFeatured = (imageId: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, featured: !img.featured } : img)),
    );
    flashSave();
  };
  const bulkStatusForRun = (runIdx: number, status: DemoImage["status"]) => {
    const runImgIds = new Set(runs.find((r) => r.runIndex === runIdx)?.images.map((i) => i.id) ?? []);
    setImages((prev) => prev.map((img) => (runImgIds.has(img.id) ? { ...img, status } : img)));
    flashSave();
  };

  const downloadHref = `/api/projects/${project.id}/section-workflow/${rawSectionId(section)}`;

  return (
    <div className={s.page}>
      <SectionHeader
        backHref={demoHref(`/projects/${project.id}`)}
        backLabel={project.title}
        prev={
          prevSection
            ? {
                name: prevSection.name,
                href: demoHref(
                  `/projects/${project.id}/sections/${rawSectionId(prevSection)}`,
                ),
              }
            : null
        }
        next={
          nextSection
            ? {
                name: nextSection.name,
                href: demoHref(
                  `/projects/${project.id}/sections/${rawSectionId(nextSection)}`,
                ),
              }
            : null
        }
        workflowDownloadHref={downloadHref}
        initialName={section.name}
        saveStatus={saveStatus}
        onSavingChange={setSaveStatus}
        onRename={() => undefined}
        batchSize={batchSize}
        onBatchSizeChange={(n) => {
          setBatchSize(n);
          flashSave();
        }}
        onRun={flashSave}
      />

      <SectionTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "params" ? (
        <div className={s.sectionTabBody}>
          <SpecSection title="图像输出" hint="决定最终画幅尺寸与批量数。">
            <SpecRow label="画幅比例">
              <AspectChips
                value={aspectRatio}
                onChange={(v) => {
                  setAspectRatio(v);
                  flashSave();
                }}
              />
            </SpecRow>
            <SpecRow label="短边像素" description="小于最终像素维度的一侧">
              <StepperInput
                value={shortSidePx}
                onChange={(v) => {
                  setShortSidePx(v);
                  flashSave();
                }}
                min={256}
                max={2048}
                step={64}
                suffix="px"
                width={130}
              />
              <DimensionsReadout
                aspect={aspectRatio}
                shortSide={shortSidePx}
                upscale={upscaleFactor}
              />
            </SpecRow>
            <SpecRow label="放大倍数">
              <UpscaleControl
                value={upscaleFactor}
                onChange={(v) => {
                  setUpscaleFactor(v);
                  flashSave();
                }}
              />
            </SpecRow>
          </SpecSection>

          <SpecSection title="模型" hint="checkpoint 支持继承项目设置。">
            <SpecRow label="Checkpoint">
              <CheckpointPicker
                value={checkpointName}
                projectCheckpoint={section.projectCheckpointName}
                options={CHECKPOINT_OPTIONS}
                onChange={(v) => {
                  setCheckpointName(v);
                  flashSave();
                }}
              />
            </SpecRow>
          </SpecSection>

          <SpecSection title="采样器" hint="两个 KSampler 分别控制首次采样与放大后精修。">
            <div style={{ display: "grid", gap: 10 }}>
              <KSamplerCard
                label="KSampler 1"
                hint="首次生成"
                params={ksampler1}
                onChange={(next) => {
                  setKsampler1(next);
                  flashSave();
                }}
              />
              <KSamplerCard
                label="KSampler 2"
                hint={upscaleFactor === 1 ? "1× 模式未启用" : "放大后精修"}
                params={ksampler2}
                disabled={upscaleFactor === 1}
                onChange={(next) => {
                  setKsampler2(next);
                  flashSave();
                }}
              />
            </div>
          </SpecSection>
        </div>
      ) : null}

      {tab === "presets" ? (
        <div className={s.sectionTabBody}>
          <div className={s.tabPanelHeader}>
            <div className={s.tabPanelTitle}>
              <h3>已绑定的预制</h3>
              <span>{bindings.length} 项（含项目级与小节级）</span>
            </div>
            <div className={s.tabPanelSpacer} />
            <div className={s.importHeaderActions}>
              {importOpen ? (
                <>
                  <button
                    type="button"
                    className={s.btnGhost}
                    onClick={() => {
                      setImportOpen(false);
                      setImportSelection(null);
                    }}
                  >
                    收起
                  </button>
                  <button
                    type="button"
                    className={s.btnPrimary}
                    disabled={!importSelection}
                    onClick={() => {
                      if (!importSelection) return;
                      commitPresetImport(importSelection);
                      setImportSelection(null);
                      setImportOpen(false);
                    }}
                  >
                    <Check className="size-4" />
                    确认
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={s.btnPrimary}
                  onClick={() => setImportOpen(true)}
                >
                  <Plus className="size-4" />
                  导入预制
                </button>
              )}
            </div>
          </div>

          <PresetImportInline
            open={importOpen}
            categories={importCategories}
            selected={importSelection}
            onSelect={setImportSelection}
          />

          {bindings.length === 0 ? (
            <div className={s.bindEmpty}>
              <b>该小节还没有预制绑定</b>
              <span>你可以点击「导入预制」添加预制或预制组，变更会生效到所有运行任务。</span>
            </div>
          ) : (
            <div className={s.bindList}>
              {bindings.map((binding) => (
                <PresetBindingRow
                  key={binding.id}
                  binding={binding}
                  onVariantChange={(bid, vid, memberId) => {
                    setBindings((prev) =>
                      prev.map((b) => {
                        if (b.id !== bid) return b;
                        if (memberId && b.members) {
                          return {
                            ...b,
                            members: b.members.map((m) =>
                              m.id === memberId
                                ? {
                                    ...m,
                                    variantId: vid,
                                    variantName:
                                      m.variants?.find((v) => v.id === vid)?.name ??
                                      m.variantName,
                                  }
                                : m,
                            ),
                          };
                        }
                        return {
                          ...b,
                          variantId: vid,
                          variantName:
                            b.variants?.find((v) => v.id === vid)?.name ?? b.variantName,
                        };
                      }),
                    );
                    flashSave();
                  }}
                  onCopyName={() => flashSave()}
                  onUnlink={(b, memberId) => {
                    if (memberId) {
                      setBindings((prev) =>
                        prev.map((x) =>
                          x.id === b.id
                            ? { ...x, members: x.members?.filter((m) => m.id !== memberId) }
                            : x,
                        ),
                      );
                    } else {
                      setBindings((prev) => prev.filter((x) => x.id !== b.id));
                    }
                    flashSave();
                  }}
                  onDelete={(b) => {
                    setBindings((prev) => prev.filter((x) => x.id !== b.id));
                    flashSave();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "prompts" ? (
        <div className={cx(s.sectionTabBody, s.promptTabBody)}>
          <div className={s.tabPanelHeader}>
            <div className={s.tabPanelTitle}>
              <h3>提示词块</h3>
              <span>{promptBlocks.length} 块 · 支持拖动排序</span>
            </div>
          </div>
          <div className={s.promptTwoColumn}>
            <div>
              <div className={s.pbColumnHead}>
                <h4>正向</h4>
              </div>
              <div className={s.pbList}>
                {promptBlocks.map((block) => (
                  <PromptBlockRow
                    key={`pos-${block.id}`}
                    block={block}
                    expanded={expandedBlockId === block.id}
                    onToggle={() =>
                      setExpandedBlockId((id) => (id === block.id ? null : block.id))
                    }
                    onLabelChange={(v) => {
                      setPromptBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, label: v } : b)),
                      );
                      flashSave();
                    }}
                    onPositiveChange={(v) => {
                      setPromptBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, positive: v } : b)),
                      );
                      flashSave();
                    }}
                    onNegativeChange={(v) => {
                      setPromptBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, negative: v } : b)),
                      );
                      flashSave();
                    }}
                    onUnlink={() => {
                      setPromptBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id
                            ? { ...b, kind: "manual", presetName: undefined, variantName: undefined }
                            : b,
                        ),
                      );
                      flashSave();
                    }}
                    onDelete={() => {
                      setPromptBlocks((prev) => prev.filter((b) => b.id !== block.id));
                      flashSave();
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className={s.pbColumnHead}>
                <h4>负向</h4>
              </div>
              <div className={s.pbList}>
                {promptBlocks
                  .filter((b) => b.negative.trim().length > 0)
                  .map((block) => (
                    <PromptBlockRow
                      key={`neg-${block.id}`}
                      block={{ ...block, positive: block.negative, negative: "" }}
                      expanded={false}
                      onToggle={() =>
                        setExpandedBlockId((id) => (id === block.id ? null : block.id))
                      }
                    />
                  ))}
              </div>
            </div>
          </div>
          <div className={s.addRow}>
            <button
              type="button"
              onClick={() => {
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
                setExpandedBlockId(id);
                flashSave();
              }}
            >
              <Plus className="size-4" />
              新增自定义 Block
            </button>
          </div>
          <CompiledPromptPreview groups={compiledPromptGroups} />
        </div>
      ) : null}

      {tab === "lora" ? (
        <div className={s.sectionTabBody}>
          <div className={s.tabPanelHeader}>
            <div className={s.tabPanelTitle}>
              <h3>LoRA 配置</h3>
              <span>
                两段采样分别装载：LoRA 1 用于首次采样，LoRA 2 用于放大精修
              </span>
            </div>
          </div>
          <div className={s.loraPair}>
            <LoraColumn
              label="LoRA 1"
              entries={lora1}
              onAdd={() =>
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
                ])
              }
              onWeight={(id, w) => {
                setLora1((prev) => prev.map((e) => (e.id === id ? { ...e, weight: w } : e)));
                flashSave();
              }}
              onToggle={(id) => {
                setLora1((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
                );
                flashSave();
              }}
              onPath={(id, path) => {
                setLora1((prev) =>
                  prev.map((e) =>
                    e.id === id
                      ? { ...e, filePath: path, fileName: path.split("/").pop() || path }
                      : e,
                  ),
                );
                flashSave();
              }}
              onUnlink={(id) => {
                setLora1((prev) => prev.filter((e) => e.id !== id));
                flashSave();
              }}
              onDelete={(id) => {
                setLora1((prev) => prev.filter((e) => e.id !== id));
                flashSave();
              }}
            />
            <LoraColumn
              label="LoRA 2"
              entries={lora2}
              onAdd={() =>
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
                ])
              }
              onWeight={(id, w) => {
                setLora2((prev) => prev.map((e) => (e.id === id ? { ...e, weight: w } : e)));
                flashSave();
              }}
              onToggle={(id) => {
                setLora2((prev) =>
                  prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e)),
                );
                flashSave();
              }}
              onPath={(id, path) => {
                setLora2((prev) =>
                  prev.map((e) =>
                    e.id === id
                      ? { ...e, filePath: path, fileName: path.split("/").pop() || path }
                      : e,
                  ),
                );
                flashSave();
              }}
              onUnlink={(id) => {
                setLora2((prev) => prev.filter((e) => e.id !== id));
                flashSave();
              }}
              onDelete={(id) => {
                setLora2((prev) => prev.filter((e) => e.id !== id));
                flashSave();
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className={s.sectionTabBody}>
          <div className={s.tabPanelHeader}>
            <div className={s.tabPanelTitle}>
              <h3>变更记录</h3>
              <span>{history.length} 条</span>
            </div>
            <div className={s.tabPanelSpacer} />
            <div className={s.resultsFilter}>
              {(
                [
                  { k: "all" as const, label: `全部 ${history.length}` },
                  { k: "params" as const, label: `参数 ${historyCounts.params ?? 0}` },
                  { k: "preset" as const, label: `预制 ${historyCounts.preset ?? 0}` },
                  { k: "prompt" as const, label: `提示词 ${historyCounts.prompt ?? 0}` },
                  { k: "lora" as const, label: `LoRA ${historyCounts.lora ?? 0}` },
                ]
              ).map((t) => (
                <button
                  key={t.k}
                  type="button"
                  className={cx(
                    s.resultsFilterBtn,
                    historyDim === t.k && s.resultsFilterBtnActive,
                  )}
                  onClick={() => setHistoryDim(t.k)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {filteredHistory.length === 0 ? (
            <div className={s.diffEmptyState}>
              暂无{historyDim === "all" ? "" : dimensionLabel(historyDim)}变更记录
            </div>
          ) : (
            <div className={s.diffList}>
              {filteredHistory.map((c) => (
                <HistoryDiffRow key={c.id} change={c} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "results" ? (
        <div className={s.sectionTabBody}>
          <div className={s.resultsHead}>
            <div className={s.resultsHeadTitle}>
              <h3>运行结果</h3>
              <span>
                共 {images.length} 张 · {keptCount} 保留 · {pendingCount} 待审
              </span>
            </div>
            <div className={s.resultsFilter}>
              {(
                [
                  { k: "all" as const, label: "全部" },
                  { k: "pending" as const, label: "待审" },
                  { k: "kept" as const, label: "保留" },
                  { k: "trashed" as const, label: "删除" },
                  { k: "featured" as const, label: "精选" },
                ]
              ).map((t) => (
                <button
                  key={t.k}
                  type="button"
                  className={cx(
                    s.resultsFilterBtn,
                    resultsFilter === t.k && s.resultsFilterBtnActive,
                  )}
                  onClick={() => setResultsFilter(t.k)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {runs.length === 0 ? (
            <div className={s.diffEmptyState}>暂无运行结果</div>
          ) : (
            runs.map((run) => (
              <div key={run.runIndex} className={s.runGroup}>
                <div className={s.runGroupHead}>
                  <span className={s.runGroupNumber}>
                    <ImageIcon className="size-3.5" />
                    Run <b>#{run.runIndex}</b>
                  </span>
                  <span className={s.runGroupTime}>{run.timestamp}</span>
                  <span className={s.runGroupStats}>
                    <span className={s.runStatPill}>{run.images.length} 张</span>
                    <span className={cx(s.runStatPill, s.runStatKept)}>
                      {run.images.filter((i) => i.status === "kept").length} 保留
                    </span>
                    <span className={cx(s.runStatPill, s.runStatTrashed)}>
                      {run.images.filter((i) => i.status === "trashed").length} 已删
                    </span>
                  </span>
                  <div className={s.runGroupActions}>
                    <button
                      type="button"
                      className={s.resultsFilterBtn}
                      onClick={() => bulkStatusForRun(run.runIndex, "kept")}
                    >
                      <Check className="size-3.5" /> 批量保留
                    </button>
                    <button
                      type="button"
                      className={s.resultsFilterBtn}
                      onClick={() => bulkStatusForRun(run.runIndex, "trashed")}
                    >
                      <Trash2 className="size-3.5" /> 批量删除
                    </button>
                  </div>
                </div>
                <div className={s.runGrid}>
                  {run.images
                    .filter((img) => filteredImageIds.has(img.id))
                    .map((img) => (
                      <ImageThumbMedium
                        actionSlot={(
                          <>
                          <button
                            type="button"
                            className={s.resultThumbAction}
                            data-tone="keep"
                            onClick={() => markStatus(img.id, img.status === "kept" ? "pending" : "kept")}
                            aria-label="保留"
                            title="保留"
                          >
                            <Check className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className={s.resultThumbAction}
                            data-tone="trash"
                            onClick={() => markStatus(img.id, img.status === "trashed" ? "pending" : "trashed")}
                            aria-label="删除"
                            title="删除"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            className={s.resultThumbAction}
                            data-tone="star"
                            onClick={() => toggleFeatured(img.id)}
                            aria-label="精选"
                            title="精选"
                          >
                            <Star className="size-3.5" />
                          </button>
                          </>
                        )}
                        image={img}
                        key={img.id}
                        onOpen={() => setLightboxImageId(img.id)}
                        onSelect={() => markStatus(img.id, img.status === "kept" ? "pending" : "kept")}
                        selectable
                        selected={img.status === "kept"}
                        showStatus={img.status !== "pending"}
                      />
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {lightboxImage ? (
        <ImagePreviewLarge
          actions={(
            <>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() =>
                  markStatus(
                    lightboxImage.id,
                    lightboxImage.status === "kept" ? "pending" : "kept",
                  )
                }
                aria-label="保留"
                title="保留"
              >
                <Check className="size-4" />
                保留
              </button>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() =>
                  markStatus(
                    lightboxImage.id,
                    lightboxImage.status === "trashed" ? "pending" : "trashed",
                  )
                }
                aria-label="删除"
                title="删除"
              >
                <Trash2 className="size-4" />
                删除
              </button>
              <button
                type="button"
                className={s.btnGhost}
                onClick={() => toggleFeatured(lightboxImage.id)}
                aria-label="精选"
                title="精选"
              >
                <Star className="size-4" />
                精选
              </button>
            </>
          )}
          image={lightboxImage}
          onClose={() => setLightboxImageId(null)}
          title={`#${lightboxImage.label}`}
        />
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// LoRA column (local helper)
// ----------------------------------------------------------------------------

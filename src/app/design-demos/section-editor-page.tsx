"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */

import Link from "next/link";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImageIcon,
  Play,
  Plus,
  Sparkles,
  Trash2,
  ChevronDown,
} from "lucide-react";

import type { DemoData, DemoProject, DemoSection } from "./design-demo-data";
import { demoHref, rawSectionId } from "./design-demo-utils";
import { Button } from "./design-demo-ui";
import {
  SectionNameEditor,
  CheckpointPicker,
  KSamplerPanel,
  UpscaleFactorField,
  PresetImportModal,
  VariantSwitcher,
  LoraEntryRow,
  ChangeHistoryItem,
} from "./section-editor-components";
import s from "./design-demo.module.css";

type SectionEditorPageProps = {
  data: DemoData;
  project: DemoProject | undefined;
  section: DemoSection | undefined;
};

type PromptBlock = {
  id: string;
  label: string;
  categoryName: string;
  categoryColor: string;
  positive: string;
  negative: string;
  variantCount: number;
  currentVariantId: string;
  variants: Array<{ id: string; name: string }>;
};

type LoraEntry = {
  id: string;
  name: string;
  weight: string;
  enabled: boolean;
  source: string;
  sourceColor: string;
};

function buildMockPromptBlocks(): PromptBlock[] {
  return [
    {
      id: "block-1",
      label: "达妮娅",
      categoryName: "角色",
      categoryColor: "158 100% 43%",
      positive: "1girl, danya, solo, standing, hands behind back",
      negative: "",
      variantCount: 3,
      currentVariantId: "variant-1",
      variants: [
        { id: "variant-1", name: "默认" },
        { id: "variant-2", name: "柔和光线" },
        { id: "variant-3", name: "电影感" },
      ],
    },
    {
      id: "block-2",
      label: "室内",
      categoryName: "场景",
      categoryColor: "280 65% 60%",
      positive: "indoors, warm lighting, soft shadows",
      negative: "outdoors, harsh light",
      variantCount: 2,
      currentVariantId: "variant-4",
      variants: [
        { id: "variant-4", name: "温暖光线" },
        { id: "variant-5", name: "冷色调" },
      ],
    },
  ];
}

function buildMockLoraEntries(): { lora1: LoraEntry[]; lora2: LoraEntry[] } {
  return {
    lora1: [
      {
        id: "lora1-1",
        name: "danya_character_v2.safetensors",
        weight: "0.8",
        enabled: true,
        source: "角色",
        sourceColor: "158 100% 43%",
      },
      {
        id: "lora1-2",
        name: "anime_style_v3.safetensors",
        weight: "0.6",
        enabled: true,
        source: "风格",
        sourceColor: "280 65% 60%",
      },
    ],
    lora2: [
      {
        id: "lora2-1",
        name: "detail_enhancer.safetensors",
        weight: "0.5",
        enabled: true,
        source: "增强",
        sourceColor: "200 70% 50%",
      },
    ],
  };
}

function PromptBlockCard({ block }: { block: PromptBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={s.promptBlockCard} data-expanded={expanded ? "true" : "false"}>
      <div className={s.promptBlockHeader}>
        <button
          type="button"
          className={s.promptBlockHeaderButton}
          onClick={() => setExpanded(!expanded)}
        >
          <div className={s.promptBlockMeta}>
            <span
              className={s.promptBlockCategory}
              style={{ "--category-color": `hsl(${block.categoryColor})` } as React.CSSProperties}
            >
              {block.categoryName}
            </span>
            <strong className={s.promptBlockLabel}>{block.label}</strong>
            <span className={s.promptBlockVariants}>{block.variantCount} variants</span>
          </div>
          <ChevronDown className={s.promptBlockChevron} />
        </button>
        <VariantSwitcher
          variants={block.variants}
          currentVariantId={block.currentVariantId}
          onChange={(variantId) => console.log("Switch to variant:", variantId)}
        />
      </div>
      {expanded && (
        <div className={s.promptBlockBody}>
          <div className={s.promptBlockField}>
            <em>Positive</em>
            <textarea
              className={s.promptBlockTextarea}
              value={block.positive}
              rows={3}
              readOnly
            />
          </div>
          {block.negative && (
            <div className={s.promptBlockField}>
              <em>Negative</em>
              <textarea
                className={s.promptBlockTextarea}
                value={block.negative}
                rows={2}
                readOnly
              />
            </div>
          )}
          <div className={s.promptBlockActions}>
            <button type="button" className={s.promptBlockActionButton}>
              <Trash2 className="size-3.5" />
              移除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SectionEditorPage({ data, project, section }: SectionEditorPageProps) {
  const [, setSectionName] = useState(section?.name || "");
  const [aspectRatio, setAspectRatio] = useState(section?.aspectRatio || "2:3");
  const [shortSidePx, setShortSidePx] = useState(String(section?.shortSidePx || 768));
  const [batchSize, setBatchSize] = useState(String(section?.batchSize || 2));
  const [seedPolicy1, setSeedPolicy1] = useState(section?.seedPolicy1 || "random");
  const [seedPolicy2, setSeedPolicy2] = useState(section?.seedPolicy2 || "random");
  const [checkpointName, setCheckpointName] = useState(section?.checkpointName || "");
  const [upscaleFactor, setUpscaleFactor] = useState(String(section?.upscaleFactor || 2));
  const [ksampler1, setKsampler1] = useState(
    section?.ksampler1 || { steps: 28, cfg: 7, sampler_name: "euler_ancestral", scheduler: "normal" }
  );
  const [ksampler2, setKsampler2] = useState(
    section?.ksampler2 || { steps: 18, cfg: 5.5, sampler_name: "dpmpp_2m_sde", scheduler: "karras" }
  );
  const [promptBlocks] = useState(buildMockPromptBlocks());
  const [loraConfig, setLoraConfig] = useState(buildMockLoraEntries());
  const [showImportModal, setShowImportModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  if (!project || !section) {
    return (
      <div className={s.page}>
        <div className={s.pageHeader}>
          <Link href="/design-demos/projects" className={s.pageBackLink}>
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

  const sectionIdx = project.sections.findIndex((s) => rawSectionId(s) === rawSectionId(section));
  const prevSection = sectionIdx > 0 ? project.sections[sectionIdx - 1] : null;
  const nextSection = sectionIdx < project.sections.length - 1 ? project.sections[sectionIdx + 1] : null;

  const checkpointOptions = [
    "oneObsession_v19Atypical.safetensors",
    "realisticVision_v60B1.safetensors",
    "dreamshaper_8.safetensors",
  ];

  const presetCategories = data.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    color: cat.color,
    presets: cat.presets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      variantCount: preset.variantCount,
    })),
  }));

  return (
    <div className={s.page}>
      {/* Page Header */}
      <div className={s.pageHeader}>
        <div className={s.pageTitleBlock}>
          <Link
            href={demoHref(`/projects/${project.id}`)}
            className={s.pageBackLink}
          >
            <ChevronLeft className="size-4" />
            返回项目
          </Link>
          <span className={s.eyebrow}>小节</span>
          <SectionNameEditor
            initialName={section.name}
            onChange={(name) => {
              setSectionName(name);
              setSaveStatus("saving");
              setTimeout(() => setSaveStatus("saved"), 800);
              setTimeout(() => setSaveStatus("idle"), 2000);
            }}
          />
          <div className={s.pageSubtitle}>
            维护参数表单、Prompt Block、LoRA 配置、运行和复制动作。
          </div>
        </div>
        <div className={s.toolbar}>
          <Button tone="primary" icon={Play}>
            运行小节
          </Button>
          <Button icon={Copy}>复制小节</Button>
        </div>
      </div>

      {/* Section Navigation */}
      <div className={s.sectionNav}>
        {prevSection ? (
          <Link
            href={demoHref(`/projects/${project.id}/sections/${rawSectionId(prevSection)}`)}
            className={s.sectionNavLink}
          >
            <ChevronLeft className="size-4" />
            <div>
              <em>上一节</em>
              <strong>{prevSection.name}</strong>
            </div>
          </Link>
        ) : (
          <div className={s.sectionNavLinkDisabled}>
            <ChevronLeft className="size-4" />
            <div>
              <em>上一节</em>
              <strong>—</strong>
            </div>
          </div>
        )}
        <Link
          href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}/results`)}
          className={s.button}
        >
          <ImageIcon className="size-4" />
          结果
        </Link>
        <Link
          href={`/api/projects/${project.id}/section-workflow/${rawSectionId(section)}`}
          download
          className={s.button}
        >
          <Download className="size-4" />
          下载 workflow
        </Link>
        {nextSection ? (
          <Link
            href={demoHref(`/projects/${project.id}/sections/${rawSectionId(nextSection)}`)}
            className={s.sectionNavLink}
          >
            <div>
              <em>下一节</em>
              <strong>{nextSection.name}</strong>
            </div>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <div className={s.sectionNavLinkDisabled}>
            <div>
              <em>下一节</em>
              <strong>—</strong>
            </div>
            <ChevronRight className="size-4" />
          </div>
        )}
      </div>

      {/* Latest Results Preview */}
      <section className={s.sectionResultsPreview}>
        <div className={s.sectionResultsHeader}>
          <div>
            <ImageIcon className="size-4" />
            <strong>最新结果</strong>
            <span>{section.images.length} 张</span>
          </div>
          {saveStatus === "saving" && (
            <span className={s.sectionSaveStatus} data-status="saving">
              保存中…
            </span>
          )}
          {saveStatus === "saved" && (
            <span className={s.sectionSaveStatus} data-status="saved">
              已保存
            </span>
          )}
        </div>
        {section.images.length > 0 ? (
          <div className={s.sectionResultsGrid}>
            {section.images.slice(0, 8).map((img) => (
              <Link
                key={img.id}
                href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}/results`)}
                className={s.sectionResultThumb}
              >
                <img src={img.src} alt="" loading="lazy" draggable={false} />
              </Link>
            ))}
            {section.images.length > 8 && (
              <Link
                href={demoHref(`/projects/${project.id}/sections/${rawSectionId(section)}/results`)}
                className={s.sectionResultMore}
              >
                +{section.images.length - 8}
              </Link>
            )}
          </div>
        ) : (
          <div className={s.sectionResultsEmpty}>
            <ImageIcon className="size-5" />
            <span>暂无结果</span>
          </div>
        )}
      </section>

      {/* Run Parameters */}
      <section className={s.sectionParamsPanel}>
        <div className={s.sectionPanelHeader}>
          <div>
            <strong>运行参数</strong>
            <span>项目默认值可在项目参数页统一调整。</span>
          </div>
        </div>
        <div className={s.sectionParamsGrid}>
          {/* Aspect Ratio */}
          <div className={s.sectionParamRow}>
            <label className={s.sectionParamLabel}>比例</label>
            <select
              className={s.sectionParamSelect}
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
              <option value="1:1">1:1</option>
              <option value="2:3">2:3</option>
              <option value="3:2">3:2</option>
              <option value="3:4">3:4</option>
              <option value="4:3">4:3</option>
              <option value="9:16">9:16</option>
              <option value="16:9">16:9</option>
            </select>
          </div>

          {/* Short Side Pixels */}
          <div className={s.sectionParamRow}>
            <label className={s.sectionParamLabel}>短边像素</label>
            <input
              type="number"
              className={s.sectionParamInput}
              value={shortSidePx}
              onChange={(e) => setShortSidePx(e.target.value)}
            />
          </div>

          {/* Batch Size */}
          <div className={s.sectionParamRow}>
            <label className={s.sectionParamLabel}>批量数</label>
            <input
              type="number"
              className={s.sectionParamInput}
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
          </div>

          {/* Seed 1 */}
          <div className={s.sectionParamRow}>
            <label className={s.sectionParamLabel}>SEED 1</label>
            <select
              className={s.sectionParamSelect}
              value={seedPolicy1}
              onChange={(e) => setSeedPolicy1(e.target.value)}
            >
              <option value="random">random</option>
              <option value="fixed">fixed</option>
            </select>
          </div>

          {/* Seed 2 */}
          <div className={s.sectionParamRow}>
            <label className={s.sectionParamLabel}>SEED 2</label>
            <select
              className={s.sectionParamSelect}
              value={seedPolicy2}
              onChange={(e) => setSeedPolicy2(e.target.value)}
            >
              <option value="random">random</option>
              <option value="fixed">fixed</option>
            </select>
          </div>

          {/* Checkpoint */}
          <div className={s.sectionParamRow} style={{ gridColumn: "1 / -1" }}>
            <label className={s.sectionParamLabel}>Checkpoint</label>
            <CheckpointPicker
              value={checkpointName}
              projectCheckpoint={section.projectCheckpointName}
              options={checkpointOptions}
              onChange={setCheckpointName}
            />
          </div>

          {/* Upscale Factor */}
          <div className={s.sectionParamRow} style={{ gridColumn: "1 / -1" }}>
            <label className={s.sectionParamLabel}>放大倍数</label>
            <UpscaleFactorField value={upscaleFactor} onChange={setUpscaleFactor} />
          </div>
        </div>

        {/* KSampler Panels */}
        <div className={s.sectionParamsGrid} style={{ marginTop: "16px" }}>
          <KSamplerPanel
            label="KSampler 1"
            subtitle={`${ksampler1.steps} steps · CFG ${ksampler1.cfg} · ${ksampler1.sampler_name}`}
            params={ksampler1}
            onChange={setKsampler1}
          />
          <KSamplerPanel
            label="KSampler 2"
            subtitle={
              upscaleFactor === "1"
                ? "1x 模式下不使用"
                : `${ksampler2.steps} steps · CFG ${ksampler2.cfg} · ${ksampler2.sampler_name}`
            }
            params={ksampler2}
            onChange={setKsampler2}
            disabled={upscaleFactor === "1"}
          />
        </div>
      </section>

      {/* Prompt Blocks */}
      <section className={s.sectionPromptPanel}>
        <div className={s.sectionPanelHeader}>
          <div>
            <strong>预设绑定</strong>
            <span>切换 variant 会同步 prompt block 与 LoRA 绑定。</span>
          </div>
          <Button icon={Plus} tone="subtle" onClick={() => setShowImportModal(true)}>
            导入预设
          </Button>
        </div>
        <div className={s.promptBlockList}>
          {promptBlocks.map((block) => (
            <PromptBlockCard key={block.id} block={block} />
          ))}
        </div>
      </section>

      {/* LoRA Configuration */}
      <section className={s.sectionLoraPanel}>
        <div className={s.sectionPanelHeader}>
          <div>
            <Sparkles className="size-4" />
            <strong>LoRA 配置</strong>
          </div>
        </div>
        <div className={s.loraPartitionGrid}>
          <div className={s.loraPartition}>
            <div className={s.loraPartitionHeader}>
              <em>LoRA1</em>
              <span>{loraConfig.lora1.length} 项</span>
              <button type="button" className={s.iconMiniButton}>
                <Plus className="size-3.5" />
              </button>
            </div>
            <div className={s.loraEntryList}>
              {loraConfig.lora1.map((entry) => (
                <LoraEntryRow
                  key={entry.id}
                  entry={entry}
                  onWeightChange={(weight) => {
                    setLoraConfig({
                      ...loraConfig,
                      lora1: loraConfig.lora1.map((e) =>
                        e.id === entry.id ? { ...e, weight } : e
                      ),
                    });
                  }}
                  onToggle={() => {
                    setLoraConfig({
                      ...loraConfig,
                      lora1: loraConfig.lora1.map((e) =>
                        e.id === entry.id ? { ...e, enabled: !e.enabled } : e
                      ),
                    });
                  }}
                  onRemove={() => {
                    setLoraConfig({
                      ...loraConfig,
                      lora1: loraConfig.lora1.filter((e) => e.id !== entry.id),
                    });
                  }}
                  draggable
                />
              ))}
            </div>
          </div>
          <div className={s.loraPartition}>
            <div className={s.loraPartitionHeader}>
              <em>LoRA2</em>
              <span>{loraConfig.lora2.length} 项</span>
              <button type="button" className={s.iconMiniButton}>
                <Plus className="size-3.5" />
              </button>
            </div>
            <div className={s.loraEntryList}>
              {loraConfig.lora2.map((entry) => (
                <LoraEntryRow
                  key={entry.id}
                  entry={entry}
                  onWeightChange={(weight) => {
                    setLoraConfig({
                      ...loraConfig,
                      lora2: loraConfig.lora2.map((e) =>
                        e.id === entry.id ? { ...e, weight } : e
                      ),
                    });
                  }}
                  onToggle={() => {
                    setLoraConfig({
                      ...loraConfig,
                      lora2: loraConfig.lora2.map((e) =>
                        e.id === entry.id ? { ...e, enabled: !e.enabled } : e
                      ),
                    });
                  }}
                  onRemove={() => {
                    setLoraConfig({
                      ...loraConfig,
                      lora2: loraConfig.lora2.filter((e) => e.id !== entry.id),
                    });
                  }}
                  draggable
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Change History */}
      {section.changeHistory && section.changeHistory.length > 0 && (
        <section className={s.sectionHistoryPanel}>
          <div className={s.sectionPanelHeader}>
            <div>
              <strong>变更历史</strong>
              <span>记录小节参数和配置的修改历史。</span>
            </div>
          </div>
          <div className={s.changeHistoryTimeline}>
            {section.changeHistory.map((change) => (
              <ChangeHistoryItem key={change.id} change={change} />
            ))}
          </div>
        </section>
      )}

      {/* Preset Import Modal */}
      {showImportModal && (
        <PresetImportModal
          categories={presetCategories}
          onImport={(presetId) => {
            console.log("Import preset:", presetId);
            setShowImportModal(false);
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

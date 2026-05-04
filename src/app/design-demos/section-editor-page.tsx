"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */

import Link from "next/link";
import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ImageIcon,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

import type { DemoData, DemoProject, DemoSection } from "./design-demo-data";
import { demoHref, rawSectionId } from "./design-demo-utils";
import { Button, ButtonLink, PageHeader } from "./design-demo-ui";
import s from "./design-demo.module.css";

type SectionEditorPageProps = {
  data: DemoData;
  project: DemoProject | undefined;
  section: DemoSection | undefined;
};

type ParamField = {
  id: string;
  label: string;
  value: string;
  type: "text" | "select" | "number";
  options?: Array<{ value: string; label: string }>;
};

type PromptBlock = {
  id: string;
  label: string;
  categoryName: string;
  categoryColor: string;
  positive: string;
  negative: string;
  variantCount: number;
};

type LoraEntry = {
  id: string;
  name: string;
  weight: string;
  enabled: boolean;
  source: string;
  sourceColor: string;
};

function buildMockParams(section: DemoSection | undefined): ParamField[] {
  if (!section) return [];

  return [
    {
      id: "sectionName",
      label: "小节名",
      value: section.name,
      type: "text",
    },
    {
      id: "aspectRatio",
      label: "比例",
      value: section.aspectRatio || "2:3",
      type: "select",
      options: [
        { value: "1:1", label: "1:1" },
        { value: "2:3", label: "2:3" },
        { value: "3:2", label: "3:2" },
        { value: "3:4", label: "3:4" },
        { value: "4:3", label: "4:3" },
        { value: "9:16", label: "9:16" },
        { value: "16:9", label: "16:9" },
      ],
    },
    {
      id: "shortSidePx",
      label: "短边像素",
      value: String(section.shortSidePx || 512),
      type: "number",
    },
    {
      id: "batchSize",
      label: "批量数",
      value: String(section.batchSize || 2),
      type: "number",
    },
    {
      id: "seed1",
      label: "Seed 1",
      value: "random",
      type: "select",
      options: [
        { value: "random", label: "random" },
        { value: "fixed", label: "fixed" },
      ],
    },
    {
      id: "seed2",
      label: "Seed 2",
      value: "random",
      type: "select",
      options: [
        { value: "random", label: "random" },
        { value: "fixed", label: "fixed" },
      ],
    },
    {
      id: "checkpoint",
      label: "Checkpoint",
      value: section.checkpointName || "oneObsession_v19Atypical.safetensors",
      type: "select",
      options: [
        { value: "oneObsession_v19Atypical.safetensors", label: "oneObsession_v19Atypical.safetensors" },
        { value: "realisticVision_v60B1.safetensors", label: "realisticVision_v60B1.safetensors" },
      ],
    },
  ];
}

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
    },
    {
      id: "block-2",
      label: "室内 / 温暖光线",
      categoryName: "场景",
      categoryColor: "280 65% 60%",
      positive: "indoors, warm lighting, soft shadows",
      negative: "outdoors, harsh light",
      variantCount: 2,
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

function ParamFieldRow({ field, onChange }: { field: ParamField; onChange: (value: string) => void }) {
  return (
    <div className={s.sectionParamRow}>
      <label className={s.sectionParamLabel}>{field.label}</label>
      {field.type === "select" ? (
        <select
          className={s.sectionParamSelect}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === "number" ? (
        <input
          type="number"
          className={s.sectionParamInput}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={s.sectionParamInput}
          value={field.value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function PromptBlockCard({ block }: { block: PromptBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={s.promptBlockCard} data-expanded={expanded ? "true" : "false"}>
      <button
        type="button"
        className={s.promptBlockHeader}
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
              <Wand2 className="size-3.5" />
              切换 Variant
            </button>
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

function LoraEntryRow({ entry }: { entry: LoraEntry }) {
  return (
    <div className={s.loraEntryRow} data-enabled={entry.enabled ? "true" : "false"}>
      <div className={s.loraEntryMain}>
        <span
          className={s.loraEntrySource}
          style={{ "--source-color": `hsl(${entry.sourceColor})` } as React.CSSProperties}
        >
          {entry.source}
        </span>
        <strong className={s.loraEntryName}>{entry.name}</strong>
      </div>
      <input
        type="text"
        className={s.loraEntryWeight}
        value={entry.weight}
        readOnly
      />
      <button type="button" className={s.loraEntryToggle} aria-label="切换启用">
        <div className={s.loraEntryToggleTrack}>
          <div className={s.loraEntryToggleThumb} />
        </div>
      </button>
    </div>
  );
}

export function SectionEditorPage({ project, section }: SectionEditorPageProps) {
  const [params, setParams] = useState(buildMockParams(section));
  const [promptBlocks] = useState(buildMockPromptBlocks());
  const [loraConfig] = useState(buildMockLoraEntries());
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  if (!project || !section) {
    return (
      <div className={s.page}>
        <PageHeader
          back={{ href: "/projects", label: "返回项目" }}
          eyebrow="小节"
          title="未找到小节"
          subtitle="请从项目列表选择有效的小节。"
        />
      </div>
    );
  }

  const sectionIdx = project.sections.findIndex((s) => rawSectionId(s) === rawSectionId(section));
  const prevSection = sectionIdx > 0 ? project.sections[sectionIdx - 1] : null;
  const nextSection = sectionIdx < project.sections.length - 1 ? project.sections[sectionIdx + 1] : null;

  const handleParamChange = (fieldId: string, value: string) => {
    setParams((current) =>
      current.map((field) => (field.id === fieldId ? { ...field, value } : field))
    );
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 800);
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${project.id}`, label: "返回项目" }}
        eyebrow="小节"
        title={section.name}
        subtitle="维护参数表单、Prompt Block、LoRA 配置、运行和复制动作。"
        actions={
          <>
            <Button tone="primary" icon={Play} feedback={{ title: "运行任务已加入队列", detail: section.name }}>
              运行小节
            </Button>
            <Button icon={Copy} feedback={{ title: "小节已复制", detail: "新小节已创建" }}>
              复制小节
            </Button>
          </>
        }
      />

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
        <ButtonLink href={`/projects/${project.id}/sections/${rawSectionId(section)}/results`} icon={ImageIcon}>
          结果
        </ButtonLink>
        <Link
          href={`/api/projects/${project.id}/section-workflow/${rawSectionId(section)}`}
          download
          className={s.button}
        >
          <Download className="size-4" />
          下一节
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
              <Save className="size-3.5" />
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
          {params.map((field) => (
            <ParamFieldRow
              key={field.id}
              field={field}
              onChange={(value) => handleParamChange(field.id, value)}
            />
          ))}
        </div>
        <div className={s.sectionParamsSummary}>
          <span className={s.sectionParamChip}>KSampler 1: 28 steps · CFG 7</span>
          <span className={s.sectionParamChip}>KSampler 2: 18 steps · CFG 5.5</span>
          <span className={s.sectionParamChip}>当前批量总成本: 1 / 2 / 4</span>
          <button type="button" className={s.sectionParamExpandLink}>
            校验 <ChevronDown className="size-3" />
          </button>
          <button type="button" className={s.sectionParamExpandLink}>
            上次保存 <ChevronDown className="size-3" />
          </button>
          <button type="button" className={s.sectionParamExpandLink}>
            校验 <ChevronDown className="size-3" />
          </button>
        </div>
      </section>

      {/* Prompt Blocks */}
      <section className={s.sectionPromptPanel}>
        <div className={s.sectionPanelHeader}>
          <div>
            <strong>预设绑定</strong>
            <span>切换 variant 会同步 prompt block 与 LoRA 绑定。</span>
          </div>
          <Button icon={Plus} tone="subtle">
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
            </div>
            <div className={s.loraEntryList}>
              {loraConfig.lora1.map((entry) => (
                <LoraEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
          <div className={s.loraPartition}>
            <div className={s.loraPartitionHeader}>
              <em>LoRA2</em>
              <span>{loraConfig.lora2.length} 项</span>
            </div>
            <div className={s.loraEntryList}>
              {loraConfig.lora2.map((entry) => (
                <LoraEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

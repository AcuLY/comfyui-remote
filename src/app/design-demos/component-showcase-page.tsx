"use client";

import { useMemo, useState } from "react";
import {
  Activity, Archive, Check, CheckSquare, ChevronDown, ChevronUp,
  Eye, FileText, FlaskConical, Grid3X3, Layers, Monitor, Palette, Plus,
  Rows3, Settings, Shuffle, SlidersHorizontal, Square, Star,
  Trash2, Wand2, X,
} from "lucide-react";

import type { DemoData, DemoImage } from "./design-demo-data";
import {
  Button, ButtonLink, StatusBadge, Field, TextAreaField, SelectLike,
  SwitchRow, DemoTabs, MetricCard, EmptyRows, OperationStateStrip,
  PageHeader, Panel, RouteTable, EmptyPage, DemoFeedbackProvider,
  ImageThumbSmall, ImageThumbMedium, ImageListSmall, ImageListMedium,
  ImageGrid, ReviewImageBoard, ImagePreviewLarge,
} from "./design-demo-ui";
import { SectionTabs, SpecSection, SpecRow, CheckpointPicker, AspectChips, StepperInput, DimensionsReadout, UpscaleControl, KSamplerCard, SelectChip, VariantSwitcher } from "./section-editor-controls";
import { SectionNameEditor, SaveStatusPill } from "./section-editor-header";
import { PresetBindingRow } from "./section-editor-presets";
import type { PresetBinding, ImportCategory, PresetImportSelection } from "./section-editor-presets";
import { PresetImportInline } from "./section-editor-presets";
import { PromptBlockRow, CompiledPromptPreview } from "./section-editor-prompts";
import type { PromptBlockRowData, CompiledPromptGroup } from "./section-editor-prompts";
import { LoraRow, HistoryDiffRow } from "./section-editor-lora-history";
import type { LoraRowData, HistoryDiffChange } from "./section-editor-lora-history";
import { LoraColumn } from "./section-editor-lora-column";
import type { SectionTabValue } from "./section-editor-controls";
import type { SaveStatus } from "./section-editor-header";
import s from "./design-demo-styles";

/* ───────────────────────── helpers ───────────────────────── */

function svgImageDataUri(label: string, hue: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 78% 54%)"/>
          <stop offset="0.56" stop-color="hsl(${(hue + 48) % 360} 76% 48%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 136) % 360} 70% 42%)"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1800" fill="url(#bg)"/>
      <circle cx="340" cy="420" r="170" fill="rgba(255,255,255,0.22)"/>
      <text x="80" y="1640" fill="white" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function makeImages(count: number): DemoImage[] {
  return Array.from({ length: count }, (_, i) => {
    const src = svgImageDataUri(`Image ${i + 1}`, (i * 34 + 160) % 360);
    return {
      id: `showcase-${i}`,
      src,
      full: src,
      label: `Image ${i + 1}`,
      status: (i % 3 === 0 ? "kept" : i % 5 === 0 ? "trashed" : "pending") as DemoImage["status"],
      featured: i % 4 === 0,
      featured2: i % 6 === 0,
      cover: i === 1,
      width: 1200,
      height: 1800,
    };
  });
}

/* ───────────────────────── shared layout ───────────────────────── */

function ShowcaseItem({ name, desc, children }: {
  name: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className={s.showcaseItem}>
      <div className={s.showcaseItemHeader}>
        <span className={s.showcaseItemName}>{name}</span>
        <span className={s.showcaseItemDesc}>{desc}</span>
      </div>
      <div className={s.showcaseItemBody}>{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Index Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseIndex({ data }: { data: DemoData }) {
  const categories = [
    { href: "/component-showcase-atoms", title: "原子 / 小组件", desc: "Button、StatusBadge、Field、StepperInput、AspectChips 等", icon: Layers, count: 23 },
    { href: "/component-showcase-fonts", title: "代码字体", desc: "JetBrains、Cascadia、Fira、IBM Plex、Commit 与当前字体对比", icon: FileText, count: 6 },
    { href: "/component-showcase-mid", title: "中组件", desc: "PageHeader、Panel、RouteTable、Toast、EmptyPage", icon: Grid3X3, count: 5 },
    { href: "/component-showcase-images", title: "图片组件", desc: "ImageThumb、ImageList、ImageGrid、ReviewBoard、Lightbox", icon: Palette, count: 8 },
    { href: "/component-showcase-editor", title: "Section Editor 组件", desc: "SectionHeader、PresetBindingRow、PromptBlockRow、LoraRow、LoraColumn 等", icon: SlidersHorizontal, count: 8 },
    { href: "/image-list-components", title: "图片列表组件检查", desc: "已有的图片列表专项检查页", icon: Rows3, count: 3 },
  ];

  return (
    <div className={s.showcasePage}>
      <PageHeader
        eyebrow="临时页面"
        title="组件展示总览"
        subtitle="选择分类查看各组件。调整浏览器窗口宽度查看响应式表现。"
      />
      <div className={s.showcaseIndexGrid}>
        {categories.map((cat) => (
          <a key={cat.href} href={`/design-demos${cat.href}`} className={s.showcaseIndexCard}>
            <cat.icon style={{ marginBottom: 8, opacity: 0.7 }} size={24} />
            <div className={s.showcaseIndexCardTitle}>{cat.title}</div>
            <div className={s.showcaseIndexCardDesc}>{cat.desc}</div>
            <div className={s.showcaseIndexCardCount}>{cat.count} 个组件</div>
          </a>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Font Preview Page
   ══════════════════════════════════════════════════════════════ */

const fontPreviewSamples = {
  title: "dreamshaper_v8.safetensors / KSampler 01",
  meta: "Run #2489 · 2026-05-09 21:34 · batch=8 · seed=1847295301",
  code: `{
  "checkpoint": "dreamshaper_v8.safetensors",
  "sampler": "euler",
  "scheduler": "normal",
  "steps": 24,
  "cfg": 7.5,
  "size": "832 x 1216",
  "lora": ["portrait-soft-light:0.65", "film-grain:0.25"]
}`,
  prompt: "masterpiece, best quality, 1girl, portrait, detailed face, studio lighting, bokeh background",
  glyphs: "0 O 1 l I | {} [] () => / \\ _ - + * # @ & 1847295301",
};

const fontPreviewOptions = [
  {
    name: "JetBrains Mono",
    stack: "var(--font-demo-jetbrains-mono), ui-monospace, monospace",
    badge: "推荐",
    note: "编辑器气质最稳，数字和易混字符清楚，适合参数、日志、模型名。",
  },
  {
    name: "Cascadia Code",
    stack: "\"Cascadia Code\", \"Cascadia Mono\", ui-monospace, monospace",
    badge: "系统预览",
    note: "更贴近 Windows / PowerShell / VS Code 语境；未安装时会回退到系统等宽。",
  },
  {
    name: "IBM Plex Mono",
    stack: "var(--font-demo-ibm-plex-mono), ui-monospace, monospace",
    badge: "克制",
    note: "企业工具感强，字面窄而清爽，适合高密度数据面板。",
  },
  {
    name: "Fira Code",
    stack: "var(--font-demo-fira-code), ui-monospace, monospace",
    badge: "技术感",
    note: "代码和 dashboard 识别度高，比 JetBrains 更有个性。",
  },
  {
    name: "Commit Mono",
    stack: "\"Commit Mono\", ui-monospace, monospace",
    badge: "系统预览",
    note: "现代、低噪音；未安装时会回退到系统等宽。",
  },
  {
    name: "Maple Mono",
    stack: "var(--font-demo-maple-mono), \"Cascadia Code\", ui-monospace, monospace",
    badge: "当前",
    note: "当前 demo 字体，圆润、亲和，和中文 UI 的柔和感较接近。",
  },
];

const fontPreviewScopedCss = `
.fontPreviewLayout{display:grid;grid-template-columns:minmax(240px,320px) minmax(0,1fr);gap:16px;align-items:start}
.fontPreviewList{display:flex;flex-direction:column;gap:8px;position:sticky;top:20px}
.fontPreviewOption{width:100%;border:1px solid var(--demo-border);border-radius:10px;background:var(--demo-surface);color:var(--demo-text);padding:12px;text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease,box-shadow .16s ease,transform .16s ease}
.fontPreviewOption:hover{transform:translateY(-1px);border-color:var(--demo-border-strong);background:var(--demo-surface-hover)}
.fontPreviewOptionSelected{border-color:var(--demo-glass-accent-border);background:var(--demo-selected);box-shadow:0 14px 38px rgba(4,120,87,.12)}
.fontPreviewOptionTop{display:flex;align-items:center;justify-content:space-between;gap:10px}
.fontPreviewOptionName{min-width:0;font-size:15px;font-weight:650;line-height:1.2}
.fontPreviewOptionSample{display:block;margin-top:8px;color:var(--demo-code-text);font-size:14px;line-height:1.35;overflow-wrap:anywhere}
.fontPreviewOptionNote{display:block;margin-top:8px;color:var(--demo-muted);font-family:var(--demo-font-sans);font-size:12px;line-height:1.45}
.fontPreviewStage,.fontComparePanel{min-width:0;border:1px solid var(--demo-border);border-radius:12px;background:var(--demo-panel);box-shadow:var(--demo-glass-shadow)}
.fontPreviewStage{padding:18px}
.fontPreviewStageHeader,.fontCompareHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
.fontPreviewStageLabel{color:var(--demo-muted);font-family:var(--demo-font-sans);font-size:11px;font-weight:650;letter-spacing:.08em;line-height:1.2;text-transform:uppercase}
.fontPreviewStageTitle{margin:4px 0 0;color:var(--demo-text);font-size:42px;font-weight:650;letter-spacing:0;line-height:1.04}
.fontPreviewBadge{flex:0 0 auto;border:1px solid var(--demo-glass-accent-border);border-radius:999px;background:var(--demo-green-soft);color:var(--demo-green);padding:3px 8px;font-family:var(--demo-font-sans);font-size:11px;font-weight:600;line-height:1.2}
.fontPreviewLargePanel{border:1px solid var(--demo-border-strong);border-radius:10px;background:var(--demo-code-bg);color:var(--demo-code-text);padding:18px;overflow:hidden}
.fontPreviewLargeTitle{font-size:20px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}
.fontPreviewLargeMeta{margin-top:8px;color:var(--demo-muted);font-size:14px;line-height:1.45;overflow-wrap:anywhere}
.fontPreviewLargeCode{margin:18px 0;color:var(--demo-code-text);font:inherit;font-size:16px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere}
.fontPreviewLargePrompt,.fontPreviewLargeGlyphs{border-top:1px solid var(--demo-border);padding-top:14px;color:var(--demo-muted);font-size:15px;line-height:1.55;overflow-wrap:anywhere}
.fontPreviewLargeGlyphs{margin-top:14px;color:var(--demo-code-text);font-size:18px}
.fontComparePanel{margin-top:16px;padding:16px}
.fontCompareTitle{margin:4px 0 0;color:var(--demo-text);font-size:18px;font-weight:650;line-height:1.25}
.fontCompareHint{color:var(--demo-muted);font-size:12px;line-height:1.45}
.fontCompareRows{display:grid;gap:8px}
.fontCompareRow{display:grid;grid-template-columns:160px minmax(0,1fr);gap:14px;align-items:baseline;width:100%;border:1px solid var(--demo-border);border-radius:8px;background:var(--demo-surface-soft);color:var(--demo-text);padding:10px 12px;text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.fontCompareRow:hover{border-color:var(--demo-border-strong);background:var(--demo-surface-hover)}
.fontCompareRowSelected{border-color:var(--demo-glass-accent-border);background:var(--demo-green-soft)}
.fontCompareName{color:var(--demo-muted);font-family:var(--demo-font-sans);font-size:12px;font-weight:650}
.fontCompareSample{min-width:0;color:var(--demo-code-text);font-size:15px;line-height:1.4;overflow-wrap:anywhere}
@media (max-width:900px){.fontPreviewLayout{grid-template-columns:1fr}.fontPreviewList{position:static;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.fontCompareRow{grid-template-columns:1fr;gap:6px}}
@media (max-width:520px){.fontPreviewStage,.fontComparePanel{padding:12px}.fontPreviewLargePanel{padding:14px}.fontPreviewStageTitle{font-size:30px}.fontPreviewLargeTitle{font-size:17px}.fontPreviewLargeCode{font-size:13px}.fontPreviewLargeGlyphs{font-size:15px}}
`;

export function ComponentShowcaseFonts() {
  const [selectedFontName, setSelectedFontName] = useState(fontPreviewOptions[0].name);
  const selectedFont = fontPreviewOptions.find((font) => font.name === selectedFontName) ?? fontPreviewOptions[0];

  return (
    <div className={s.showcasePage}>
      <style>{fontPreviewScopedCss}</style>
      <PageHeader
        eyebrow="组件展示"
        title="代码字体预览"
        subtitle="点击左侧字体，右侧查看大号样本。Cascadia Code 与 Commit Mono 依赖本机字体安装。"
      />

      <div className={s.fontPreviewLayout}>
        <aside className={s.fontPreviewList} aria-label="代码字体选项">
          {fontPreviewOptions.map((font) => {
            const selected = font.name === selectedFont.name;

            return (
              <button
                key={font.name}
                type="button"
                className={selected ? `${s.fontPreviewOption} ${s.fontPreviewOptionSelected}` : s.fontPreviewOption}
                onClick={() => setSelectedFontName(font.name)}
                aria-pressed={selected}
              >
                <span className={s.fontPreviewOptionTop}>
                  <span className={s.fontPreviewOptionName} style={{ fontFamily: font.stack }}>{font.name}</span>
                  <span className={s.fontPreviewBadge}>{font.badge}</span>
                </span>
                <span className={s.fontPreviewOptionSample} style={{ fontFamily: font.stack }}>
                  0O 1lI · seed=1847295301
                </span>
                <span className={s.fontPreviewOptionNote}>{font.note}</span>
              </button>
            );
          })}
        </aside>

        <section className={s.fontPreviewStage}>
          <div className={s.fontPreviewStageHeader}>
            <div>
              <div className={s.fontPreviewStageLabel}>当前预览</div>
              <h2 className={s.fontPreviewStageTitle} style={{ fontFamily: selectedFont.stack }}>{selectedFont.name}</h2>
            </div>
            <span className={s.fontPreviewBadge}>{selectedFont.badge}</span>
          </div>

          <div className={s.fontPreviewLargePanel} style={{ fontFamily: selectedFont.stack }}>
            <div className={s.fontPreviewLargeTitle}>{fontPreviewSamples.title}</div>
            <div className={s.fontPreviewLargeMeta}>{fontPreviewSamples.meta}</div>
            <pre className={s.fontPreviewLargeCode}>{fontPreviewSamples.code}</pre>
            <div className={s.fontPreviewLargePrompt}>{fontPreviewSamples.prompt}</div>
            <div className={s.fontPreviewLargeGlyphs}>{fontPreviewSamples.glyphs}</div>
          </div>
        </section>
      </div>

      <section className={s.fontComparePanel} aria-label="字体横向对比">
        <div className={s.fontCompareHeader}>
          <div>
            <div className={s.fontPreviewStageLabel}>横向对比</div>
            <h2 className={s.fontCompareTitle}>同一句样本</h2>
          </div>
          <span className={s.fontCompareHint}>只比较英文字母、数字、符号和模型名</span>
        </div>

        <div className={s.fontCompareRows}>
          {fontPreviewOptions.map((font) => (
            <button
              key={font.name}
              type="button"
              className={font.name === selectedFont.name ? `${s.fontCompareRow} ${s.fontCompareRowSelected}` : s.fontCompareRow}
              onClick={() => setSelectedFontName(font.name)}
            >
              <span className={s.fontCompareName}>{font.name}</span>
              <span className={s.fontCompareSample} style={{ fontFamily: font.stack }}>
                dreamshaper_v8.safetensors · cfg=7.5 · 0O 1lI [] =&gt; seed=1847295301
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Atoms Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseAtoms() {
  const [tabValue, setTabValue] = useState("params");
  const [stepperVal, setStepperVal] = useState(4);
  const [aspectVal, setAspectVal] = useState("2:3");
  const [upscaleVal, setUpscaleVal] = useState(2);
  const [selectChipVal, setSelectChipVal] = useState("euler");
  const [variantId, setVariantId] = useState("v1");
  const [checkpointVal, setCheckpointVal] = useState("dreamshaper_v8");
  const [sectionName, setSectionName] = useState("肖像 - 女性角色");

  const images = useMemo(() => makeImages(8), []);

  return (
    <div className={s.showcasePage}>
      <PageHeader eyebrow="组件展示" title="原子 / 小组件" subtitle="23 个基础组件，调整浏览器窗口宽度查看响应式表现" />

      {/* 1.1 Button */}
      <ShowcaseItem name="Button" desc="通用按钮，5 种色调">
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>Tone 变体</div>
          <div className={s.showcaseRow}>
            <Button>Default</Button>
            <Button tone="subtle">Subtle</Button>
            <Button tone="primary">Primary</Button>
            <Button tone="pink">Pink</Button>
            <Button tone="danger">Danger</Button>
          </div>
        </div>
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>带图标</div>
          <div className={s.showcaseRow}>
            <Button icon={Plus}>新增</Button>
            <Button icon={Settings} tone="primary">设置</Button>
            <Button icon={Trash2} tone="danger">删除</Button>
          </div>
        </div>
        <div className={s.showcaseGroup}>
          <div className={s.showcaseGroupTitle}>状态</div>
          <div className={s.showcaseRow}>
            <Button pending>Pending</Button>
            <Button disabled>Disabled</Button>
            <Button pressed>Pressed</Button>
            <Button icon={Check} feedback={{ title: "操作成功", detail: "1 项已处理" }}>带反馈</Button>
          </div>
        </div>
      </ShowcaseItem>

      {/* 1.2 ButtonLink */}
      <ShowcaseItem name="ButtonLink" desc="按钮外观的 Link">
        <div className={s.showcaseRow}>
          <ButtonLink href="/design-demos">Default</ButtonLink>
          <ButtonLink href="/design-demos" tone="primary" icon={Plus}>Primary</ButtonLink>
          <ButtonLink href="/design-demos" tone="pink">Pink</ButtonLink>
        </div>
      </ShowcaseItem>

      {/* 1.3 StatusBadge */}
      <ShowcaseItem name="StatusBadge" desc="状态标签">
        <div className={s.showcaseRow}>
          <StatusBadge status="running" label="运行中" />
          <StatusBadge status="done" label="完成" />
          <StatusBadge status="pending" label="待审" />
          <StatusBadge status="failed" label="失败" />
          <StatusBadge status="draft" label="草稿" />
        </div>
      </ShowcaseItem>

      {/* 1.4 Field */}
      <ShowcaseItem name="Field" desc="只读文本输入字段">
        <div className={s.showcaseStack}>
          <Field label="项目名称" value="夏日人像合集" />
          <Field label="画幅比例" value="2:3" />
          <Field label="步数" value={20} />
        </div>
      </ShowcaseItem>

      {/* 1.5 TextAreaField */}
      <ShowcaseItem name="TextAreaField" desc="只读多行文本字段">
        <TextAreaField label="正向提示词" value="masterpiece, best quality, 1girl, portrait, detailed face, studio lighting, bokeh background" />
      </ShowcaseItem>

      {/* 1.6 SelectLike */}
      <ShowcaseItem name="SelectLike" desc="只读下拉选择样式字段">
        <SelectLike label="Checkpoint" value="dreamshaper_v8.safetensors" />
      </ShowcaseItem>

      {/* 1.7 SwitchRow */}
      <ShowcaseItem name="SwitchRow" desc="开关行（纯展示）">
        <div className={s.showcaseStack}>
          <SwitchRow title="启用 LoRA" subtitle="加载关联的 LoRA 模型" />
          <SwitchRow title="SFW 模式" subtitle="隐藏敏感内容" />
        </div>
      </ShowcaseItem>

      {/* 1.8 DemoTabs */}
      <ShowcaseItem name="DemoTabs" desc="通用 Tab 切换器">
        <DemoTabs
          tabs={[
            { key: "params", label: "参数" },
            { key: "presets", label: "预制", count: 3 },
            { key: "prompts", label: "提示词" },
            { key: "lora", label: "LoRA", count: 2 },
            { key: "results", label: "结果", count: 48 },
          ]}
          value={tabValue}
          onChange={setTabValue}
        />
      </ShowcaseItem>

      {/* 1.9 MetricCard */}
      <ShowcaseItem name="MetricCard" desc="指标卡片">
        <div className={s.showcaseCardGrid}>
          <MetricCard icon={FlaskConical} label="运行中" value={3} meta="2 个小节" />
          <MetricCard icon={Check} label="已完成" value={127} meta="今天 +12" />
          <MetricCard icon={Activity} label="待审核" value={48} meta="3 次运行" tone="amber" />
          <MetricCard icon={Trash2} label="已删除" value={5} meta="可恢复" tone="danger" />
        </div>
      </ShowcaseItem>

      {/* 1.10 EmptyRows */}
      <ShowcaseItem name="EmptyRows" desc="空状态文字">
        <EmptyRows label="暂无运行记录" />
      </ShowcaseItem>

      {/* 1.11 OperationStateStrip */}
      <ShowcaseItem name="OperationStateStrip" desc="横向操作状态条">
        <OperationStateStrip
          items={[
            { label: "保留", value: "32", tone: "success" },
            { label: "删除", value: "8", tone: "warning" },
            { label: "失败", value: "2", tone: "error" },
          ]}
        />
      </ShowcaseItem>

      {/* 1.12 SectionTabs */}
      <ShowcaseItem name="SectionTabs" desc="小节编辑器专用 Tab 栏">
        <SectionTabs
          tabs={[
            { value: "params", label: "参数" },
            { value: "presets", label: "预制", count: 3 },
            { value: "prompts", label: "提示词" },
            { value: "lora", label: "LoRA", count: 2 },
            { value: "history", label: "历史" },
            { value: "results", label: "结果", count: 48 },
          ]}
          value={tabValue as SectionTabValue}
          onChange={(v) => setTabValue(v)}
        />
      </ShowcaseItem>

      {/* 1.13 SectionNameEditor */}
      <ShowcaseItem name="SectionNameEditor" desc="点击编辑小节名">
        <SectionNameEditor initialName={sectionName} onChange={setSectionName} />
      </ShowcaseItem>

      {/* 1.14 SaveStatusPill */}
      <ShowcaseItem name="SaveStatusPill" desc="保存状态指示">
        <div className={s.showcaseRow}>
          <SaveStatusPill status="idle" />
          <SaveStatusPill status="saving" />
          <SaveStatusPill status="saved" />
        </div>
      </ShowcaseItem>

      {/* 1.15 SpecSection / SpecRow */}
      <ShowcaseItem name="SpecSection / SpecRow" desc="参数表单的分组和行布局">
        <SpecSection title="采样参数" hint="调整采样器参数以控制生成质量">
          <SpecRow label="步数" description="更多步数通常更精细">
            <StepperInput value={stepperVal} onChange={setStepperVal} min={1} max={50} />
          </SpecRow>
          <SpecRow label="CFG Scale" description="提示词相关性">
            <StepperInput value={7} onChange={() => {}} min={1} max={30} step={0.5} />
          </SpecRow>
        </SpecSection>
      </ShowcaseItem>

      {/* 1.16 CheckpointPicker */}
      <ShowcaseItem name="CheckpointPicker" desc="Checkpoint 下拉选择器">
        <CheckpointPicker
          value={checkpointVal}
          projectCheckpoint="dreamshaper_v8"
          options={["dreamshaper_v8.safetensors", "sdxl_base_1.0.safetensors", "realisticVision_v5.safetensors"]}
          onChange={setCheckpointVal}
        />
      </ShowcaseItem>

      {/* 1.17 AspectChips */}
      <ShowcaseItem name="AspectChips" desc="画幅比例芯片组选择器">
        <AspectChips value={aspectVal} onChange={setAspectVal} />
      </ShowcaseItem>

      {/* 1.18 StepperInput */}
      <ShowcaseItem name="StepperInput" desc="步进数值输入">
        <div className={s.showcaseStack}>
          <div className={s.showcaseRow}>
            <StepperInput value={stepperVal} onChange={setStepperVal} min={1} max={50} suffix=" 步" />
            <StepperInput value={7} onChange={() => {}} min={1} max={30} step={0.5} suffix=" CFG" />
          </div>
          <StepperInput value={0.85} onChange={() => {}} min={0.1} max={1} step={0.05} width={120} suffix=" denoise" />
        </div>
      </ShowcaseItem>

      {/* 1.19 DimensionsReadout */}
      <ShowcaseItem name="DimensionsReadout" desc="图像尺寸计算与展示">
        <DimensionsReadout aspect="2:3" shortSide={512} upscale={2} />
        <hr className={s.showcaseDivider} />
        <DimensionsReadout aspect="1:1" shortSide={1024} upscale={1} />
      </ShowcaseItem>

      {/* 1.20 UpscaleControl */}
      <ShowcaseItem name="UpscaleControl" desc="放大倍数芯片组">
        <UpscaleControl value={upscaleVal} onChange={setUpscaleVal} />
      </ShowcaseItem>

      {/* 1.21 KSamplerCard */}
      <ShowcaseItem name="KSamplerCard" desc="KSampler 参数卡片">
        <KSamplerCard
          label="KSampler 1"
          hint="第一次采样"
          params={{
            steps: 20,
            cfg: 7,
            denoise: 0.85,
            sampler_name: "euler",
            scheduler: "normal",
            seedPolicy: "randomize",
          }}
        />
        <hr className={s.showcaseDivider} />
        <KSamplerCard
          label="KSampler 2"
          hint="第二次采样（可禁用）"
          params={{
            steps: 12,
            cfg: 4,
            denoise: 0.5,
            sampler_name: "dpmpp_2m",
            scheduler: "karras",
            seedPolicy: "fixed",
          }}
          disabled
        />
      </ShowcaseItem>

      {/* 1.22 SelectChip */}
      <ShowcaseItem name="SelectChip" desc="芯片式下拉选择器">
        <div className={s.showcaseRow}>
          <SelectChip value={selectChipVal} options={["euler", "euler_ancestral", "dpmpp_2m", "dpmpp_sde", "ddim"]} onChange={setSelectChipVal} />
          <SelectChip value="normal" options={["normal", "karras", "exponential", "sgm_uniform"]} onChange={() => {}} />
        </div>
      </ShowcaseItem>

      {/* 1.23 VariantSwitcher */}
      <ShowcaseItem name="VariantSwitcher" desc="变体切换下拉">
        <VariantSwitcher
          variants={[
            { id: "v1", name: "默认变体" },
            { id: "v2", name: "高细节" },
            { id: "v3", name: "柔和风格" },
          ]}
          currentVariantId={variantId}
          onChange={setVariantId}
        />
      </ShowcaseItem>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Mid Components Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseMid({ data }: { data: DemoData }) {
  return (
    <div className={s.showcasePage}>
      <PageHeader eyebrow="组件展示" title="中组件" subtitle="5 个中型组件" />

      {/* 2.1 PageHeader */}
      <ShowcaseItem name="PageHeader" desc="页面顶部标题栏">
        <PageHeader eyebrow="项目" title="夏日人像合集" subtitle="12 个小节 · 3 个预制" actions={<><Button tone="primary" icon={Plus}>新增小节</Button><Button icon={Settings}>设置</Button></>} />
        <hr className={s.showcaseDivider} />
        <PageHeader back={{ href: "/design-demos/projects", label: "返回项目" }} eyebrow="小节" title="肖像 - 女性角色" subtitle="2:3 · 512×768 · 4 张" />
      </ShowcaseItem>

      {/* 2.2 Panel */}
      <ShowcaseItem name="Panel" desc="面板容器">
        <Panel title="采样参数" subtitle="调整 KSampler 参数" actions={<Button tone="subtle" icon={Shuffle}>随机种子</Button>}>
          <div className={s.showcaseRow}>
            <Field label="Steps" value={20} />
            <Field label="CFG" value={7} />
            <Field label="Denoise" value={0.85} />
          </div>
        </Panel>
      </ShowcaseItem>

      {/* 2.3 RouteTable */}
      <ShowcaseItem name="RouteTable" desc="完整页面路径表格">
        <RouteTable data={data} />
      </ShowcaseItem>

      {/* 2.4 DemoFeedbackProvider / Toast */}
      <ShowcaseItem name="DemoFeedbackProvider" desc="Toast 提示 Context Provider">
        <DemoFeedbackProvider>
          <ToastDemoButtons />
        </DemoFeedbackProvider>
      </ShowcaseItem>

      {/* 2.5 EmptyPage */}
      <ShowcaseItem name="EmptyPage" desc="空状态页面">
        <EmptyPage title="暂无数据" />
      </ShowcaseItem>
    </div>
  );
}

function ToastDemoButtons() {
  return (
    <div className={s.showcaseRow}>
      <Button icon={Check} feedback={{ title: "保存成功", detail: "参数已更新" }}>触发成功 Toast</Button>
      <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "已加入删除队列", detail: "3 张图片" }}>触发警告 Toast</Button>
      <Button tone="primary" icon={Wand2} feedback={{ tone: "error", title: "操作失败", detail: "请重试" }}>触发错误 Toast</Button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Image Components Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseImages({ data }: { data: DemoData }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const images = useMemo(() => {
    const fromData = data.projects.flatMap((p) => p.sections.flatMap((s) => s.images));
    return fromData.length >= 6 ? fromData.slice(0, 12) : makeImages(12);
  }, [data.projects]);

  const previewImage = previewIndex !== null ? images[previewIndex] ?? null : null;

  function toggleImage(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className={s.showcasePage}>
      <PageHeader eyebrow="组件展示" title="图片组件" subtitle="8 个图片相关组件" />

      {/* 3.1 ImageThumbSmall */}
      <ShowcaseItem name="ImageThumbSmall" desc="小缩略图">
        <div className={s.showcaseRow}>
          {images.slice(0, 5).map((img, i) => (
            <ImageThumbSmall key={img.id} image={img} />
          ))}
        </div>
      </ShowcaseItem>

      {/* 3.2 ImageThumbMedium */}
      <ShowcaseItem name="ImageThumbMedium" desc="中缩略图（可选中）">
        <div className={s.showcaseRow}>
          {images.slice(0, 4).map((img, i) => (
            <ImageThumbMedium
              key={img.id}
              image={img}
              selectable
              selected={selectedIds.has(img.id)}
              onSelect={() => toggleImage(img.id)}
              onOpen={() => setPreviewIndex(i)}
              showStatus={img.status !== "pending"}
            />
          ))}
        </div>
      </ShowcaseItem>

      {/* 3.3 ImageListSmall */}
      <ShowcaseItem name="ImageListSmall" desc="横向滚动小图列表">
        <div className={s.showcaseImageList}>
          <ImageListSmall images={images} limit={8} maxWidth={420} />
        </div>
        <hr className={s.showcaseDivider} />
        <ImageListSmall images={images} limit={12} maxWidth={640} />
      </ShowcaseItem>

      {/* 3.4 ImageListMedium */}
      <ShowcaseItem name="ImageListMedium" desc="中图网格列表（可折叠）">
        <ImageListMedium maxHeight={320} summary={`已选 ${selectedIds.size} 张`}>
          {images.slice(0, 8).map((img, i) => (
            <ImageThumbMedium
              key={img.id}
              image={img}
              selectable
              selected={selectedIds.has(img.id)}
              onSelect={() => toggleImage(img.id)}
              onOpen={() => setPreviewIndex(i)}
              showStatus={img.status !== "pending"}
            />
          ))}
        </ImageListMedium>
      </ShowcaseItem>

      {/* 3.5 ImageGrid */}
      <ShowcaseItem name="ImageGrid" desc="图片网格 + Lightbox 预览">
        <ImageGrid images={images.slice(0, 6)} showStatus selectable />
      </ShowcaseItem>

      {/* 3.6 ReviewImageBoard */}
      <ShowcaseItem name="ReviewImageBoard" desc="审核图片面板">
        <ReviewImageBoard images={images.slice(0, 6)} />
      </ShowcaseItem>

      {/* 3.7 ImagePreviewFrame (internal - shown through Lightbox) */}

      {/* 3.8 ImagePreviewLarge (Lightbox) */}
      <ShowcaseItem name="ImagePreviewLarge" desc="全屏 Lightbox 预览">
        <Button icon={Eye} onClick={() => setPreviewIndex(0)}>打开 Lightbox</Button>
      </ShowcaseItem>

      {previewImage && (
        <ImagePreviewLarge
          actions={<>
            <Button icon={Check}>保留</Button>
            <Button tone="pink" icon={Star}>精选</Button>
            <Button tone="danger" icon={Trash2}>删除</Button>
          </>}
          image={previewImage}
          meta={`${previewIndex! + 1} / ${images.length}`}
          onClose={() => setPreviewIndex(null)}
          onNext={() => setPreviewIndex((c) => c === null ? 0 : (c + 1) % images.length)}
          onPrevious={() => setPreviewIndex((c) => c === null ? 0 : (c + images.length - 1) % images.length)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Section Editor Components Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseEditor({ data }: { data: DemoData }) {
  return (
    <div className={s.showcasePage}>
      <PageHeader eyebrow="组件展示" title="Section Editor 组件" subtitle="8 个小节编辑器专用组件" />

      {/* 5.1 SectionHeader - too large for showcase, just mention */}
      <ShowcaseItem name="SectionHeader" desc="小节编辑器顶部栏（运行控制 + 导航 + 保存状态）">
        <div style={{ color: "var(--demo-muted)", fontSize: 13 }}>
          SectionHeader 是完整的页面级头部组件，请在实际小节编辑器页面中查看。
          <br />
          路由：<code>/design-demos/projects/:projectId/sections/:sectionId</code>
        </div>
      </ShowcaseItem>

      {/* 5.2 PresetBindingRow */}
      <ShowcaseItem name="PresetBindingRow" desc="预制绑定行">
        <PresetBindingRow
          binding={{
            id: "bind-1",
            kind: "preset",
            scope: "project",
            categoryId: "cat-1",
            categoryName: "人物",
            categoryColor: "158 100% 43%",
            name: "写实人像",
            variantName: "高细节",
            blockCount: 2,
            loraCount: 1,
            variants: [
              { id: "v1", name: "默认" },
              { id: "v2", name: "高细节" },
            ],
          }}
        />
        <hr className={s.showcaseDivider} />
        <PresetBindingRow
          binding={{
            id: "bind-2",
            kind: "group",
            scope: "section",
            categoryId: "cat-2",
            categoryName: "风景",
            categoryColor: "200 80% 50%",
            name: "风景写意",
            blockCount: 1,
            loraCount: 0,
            members: [
              { id: "m1", presetName: "天空光影", variantName: "默认" },
              { id: "m2", presetName: "植被细节" },
            ],
          }}
        />
      </ShowcaseItem>

      {/* 5.3 PresetImportInline */}
      <ShowcaseItem name="PresetImportInline" desc="行内预制导入面板">
        <PresetImportInline
          open
          categories={data.categories.slice(0, 2).map((cat): ImportCategory => ({
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
          }))}
          selected={null}
          onSelect={() => {}}
        />
      </ShowcaseItem>

      {/* 5.4 PromptBlockRow */}
      <ShowcaseItem name="PromptBlockRow" desc="提示词块行">
        <PromptBlockRow
          block={{
            id: "pb-1",
            label: "主体描述",
            categoryName: "人物",
            categoryColor: "158 100% 43%",
            presetName: "写实人像",
            variantName: "高细节",
            positive: "masterpiece, best quality, 1girl, portrait, detailed face",
            negative: "lowres, bad anatomy, bad hands, blurry",
            kind: "preset",
          }}
          expanded
          onToggle={() => {}}
        />
        <hr className={s.showcaseDivider} />
        <PromptBlockRow
          block={{
            id: "pb-2",
            label: "负面提示词",
            categoryName: "自定义",
            categoryColor: null,
            positive: "",
            negative: "worst quality, low quality, watermark, text",
            kind: "manual",
          }}
          expanded={false}
          onToggle={() => {}}
        />
      </ShowcaseItem>

      {/* 5.5 CompiledPromptPreview */}
      <ShowcaseItem name="CompiledPromptPreview" desc="编译后的 Prompt 预览">
        <CompiledPromptPreview
          groups={[
            {
              id: "g1",
              presetName: "写实人像",
              variantName: "高细节",
              categoryName: "人物",
              positive: ["masterpiece, best quality", "1girl, portrait, detailed face", "studio lighting"],
              negative: ["lowres", "bad anatomy, bad hands"],
            },
            {
              id: "g2",
              presetName: "风格化",
              categoryName: "风格",
              positive: ["anime style", "vibrant colors, dynamic pose"],
              negative: ["photorealistic", "3d render"],
            },
          ]}
        />
      </ShowcaseItem>

      {/* 5.6 LoraRow */}
      <ShowcaseItem name="LoraRow" desc="LoRA 行">
        <LoraRow
          entry={{
            id: "lora-1",
            fileName: "add_detail.safetensors",
            filePath: "add_detail/add_detail.safetensors",
            weight: 0.8,
            enabled: true,
            kind: "preset",
            presetName: "写实人像",
            categoryName: "人物",
            categoryColor: "158 100% 43%",
            triggerWords: "add detail, highly detailed",
          }}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={() => {}}
          onToggle={() => {}}
          onPathChange={() => {}}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
        <hr className={s.showcaseDivider} />
        <LoraRow
          entry={{
            id: "lora-2",
            fileName: "flat_color.safetensors",
            filePath: "flat_color/flat_color.safetensors",
            weight: 0.5,
            enabled: false,
            kind: "manual",
            triggerWords: "flat color",
          }}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={() => {}}
          onToggle={() => {}}
          onPathChange={() => {}}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
      </ShowcaseItem>

      {/* 5.7 LoraColumn */}
      <ShowcaseItem name="LoraColumn" desc="LoRA 列容器">
        <LoraColumn
          label="Stage 1"
          entries={[
            {
              id: "lora-1",
              fileName: "add_detail.safetensors",
              filePath: "add_detail/add_detail.safetensors",
              weight: 0.8,
              enabled: true,
              kind: "preset" as const,
              presetName: "写实人像",
              categoryName: "人物",
              categoryColor: "158 100% 43%",
              triggerWords: "add detail, highly detailed",
            },
            {
              id: "lora-2",
              fileName: "flat_color.safetensors",
              filePath: "flat_color/flat_color.safetensors",
              weight: 0.5,
              enabled: true,
              kind: "manual" as const,
              triggerWords: "flat color",
            },
          ]}
          onAdd={() => {}}
          onWeight={() => {}}
          onToggle={() => {}}
          onPath={() => {}}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
      </ShowcaseItem>

      {/* 5.8 HistoryDiffRow */}
      <ShowcaseItem name="HistoryDiffRow" desc="变更记录 diff 行">
        <HistoryDiffRow
          change={{
            id: "diff-1",
            timestamp: "2026-05-09 10:30",
            dimension: "ksampler1",
            title: "修改采样参数",
            before: "steps=20, cfg=7",
            after: "steps=30, cfg=8",
            diff: [
              { field: "steps", before: "20", after: "30" },
              { field: "cfg", before: "7", after: "8" },
            ],
          }}
        />
        <hr className={s.showcaseDivider} />
        <HistoryDiffRow
          change={{
            id: "diff-2",
            timestamp: "2026-05-09 11:15",
            dimension: "lora1",
            title: "替换 LoRA",
            before: "add_detail.safetensors (0.8)",
            after: "realistic_skin.safetensors (0.6)",
          }}
        />
      </ShowcaseItem>
    </div>
  );
}

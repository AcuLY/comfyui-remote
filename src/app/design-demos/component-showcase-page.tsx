"use client";

import { useMemo, useState } from "react";
import {
  Activity, Archive, Check, CheckSquare, ChevronRight, Copy,
  Eye, FlaskConical, Folder, FolderInput, GripVertical, Grid3X3, Layers,
  Palette, Pencil, Play, Plus, Rows3, Settings, Shuffle,
  SlidersHorizontal, Square, Star, Trash2, Wand2, X,
} from "lucide-react";

import type { DemoData, DemoImage } from "./design-demo-data";
import { Button } from "./ui/button";
import { ButtonLink } from "./ui/button-link";
import { DemoFeedbackProvider } from "./ui/demo-feedback-provider";
import { DemoTabs } from "./ui/demo-tabs";
import { EmptyPage } from "./ui/empty-page";
import { EmptyRows } from "./ui/empty-rows";
import { Field } from "./ui/field";
import { ImageGrid } from "./ui/image-grid";
import { ImageListMedium } from "./ui/image-list-medium";
import { ImageListSmall } from "./ui/image-list-small";
import { ImagePreviewLarge } from "./ui/image-preview-large";
import { ImageStrip } from "./ui/image-strip";
import { ImageThumbMedium } from "./ui/image-thumb-medium";
import { ImageThumbSmall } from "./ui/image-thumb-small";
import { MetricCard } from "./ui/metric-card";
import { OperationStateStrip } from "./ui/operation-state-strip";
import { PageHeader } from "./ui/page-header";
import { Panel } from "./ui/panel";
import { ReviewImageBoard } from "./ui/review-image-board";
import { RouteTable } from "./ui/route-table";
import { SegmentedControl } from "./ui/segmented-control";
import { SelectLike } from "./ui/select-like";
import { StatusBadge } from "./ui/status-badge";
import { SwitchRow } from "./ui/switch-row";
import { TextAreaField } from "./ui/text-area-field";
import { SpecSection, SpecRow, StepperInput, DimensionsReadout, KSamplerCard } from "./section-editor-controls";
import { SectionNameEditor, SaveStatusPill } from "./section-editor-header";
import { PresetBindingRow } from "./section-editor-presets";
import type { ImportCategory } from "./section-editor-presets";
import { PresetImportInline } from "./section-editor-presets";
import { PromptBlockRow, CompiledPromptPreview } from "./section-editor-prompts";
import { LoraRow, HistoryDiffRow, type LoraRowData } from "./section-editor-lora-history";
import { LoraColumn } from "./section-editor-lora-column";
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

export function ComponentShowcaseIndex({ data: _data }: { data: DemoData }) {
  void _data;
  const categories = [
    { href: "/component-showcase-atoms", title: "原子 / 小组件", desc: "Button、StatusBadge、Field、Switch、SegmentedControl、StepperInput、SvgIcon 等", icon: Layers, count: 19 },
    { href: "/component-showcase-mid", title: "中组件", desc: "PageHeader、Panel、RouteTable、Toast、EmptyPage、ProjectDetailHeader、QueueMetrics 等", icon: Grid3X3, count: 17 },
    { href: "/component-showcase-images", title: "图片组件", desc: "ImageThumb、ImageStrip、ImageList、ImageGrid、ReviewBoard、Lightbox", icon: Palette, count: 9 },
    { href: "/component-showcase-editor", title: "Section Editor 组件", desc: "SectionHeader、PresetBindingRow、PromptBlockRow、LoraRow、LoraColumn 等", icon: SlidersHorizontal, count: 8 },
    { href: "/component-showcase-projects", title: "项目卡片和列表", desc: "ProjectListItem、ProjectSectionCard、ProjectFolderRow、BatchSizeSelector 等", icon: Archive, count: 11 },
    { href: "/component-showcase-icons", title: "Icons 图标", desc: "Lucide 图标全览 + 自定义 SVG 图标", icon: Palette, count: 57 },
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
   Atoms Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseAtoms() {
  const [tabValue, setTabValue] = useState("params");
  const [stepperVal, setStepperVal] = useState(4);
  const [sectionName, setSectionName] = useState("肖像 - 女性角色");

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="原子 / 小组件" subtitle="基础组件，调整浏览器窗口宽度查看响应式表现" />

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
          <div className={s.showcaseGroupTitle}>纯 Icon</div>
          <div className={s.showcaseRow}>
            <Button icon={Plus} iconOnly ariaLabel="新增" />
            <Button icon={Settings} iconOnly tone="primary" ariaLabel="设置" />
            <Button icon={Star} iconOnly tone="pink" ariaLabel="精选" />
            <Button icon={Trash2} iconOnly tone="danger" ariaLabel="删除" />
            <Button icon={Check} iconOnly pressed ariaLabel="已选择" />
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
          <ButtonLink href="/design-demos" tone="subtle" icon={Settings} iconOnly ariaLabel="设置" />
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

      {/* 1.18 StepperInput */}
      <ShowcaseItem name="StepperInput" desc="步进数值输入">
        <div className={s.showcaseStack}>
          <div className={s.showcaseRow}>
            <StepperInput value={stepperVal} onChange={setStepperVal} min={1} max={50} />
            <StepperInput value={7} onChange={() => {}} min={1} max={30} step={0.5} />
          </div>
          <StepperInput value={0.85} onChange={() => {}} min={0.1} max={1} step={0.05} width={120} />
        </div>
      </ShowcaseItem>

      {/* 1.19 DimensionsReadout */}
      <ShowcaseItem name="DimensionsReadout" desc="图像尺寸计算与展示">
        <DimensionsReadout aspect="2:3" shortSide={512} upscale={2} />
        <hr className={s.showcaseDivider} />
        <DimensionsReadout aspect="1:1" shortSide={1024} upscale={1} />
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
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="中组件" subtitle="5 个中型组件" />

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

      {/* 2.6 KSamplerCard */}
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
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="图片组件" subtitle="8 个图片相关组件" />

      {/* 3.1 ImageThumbSmall */}
      <ShowcaseItem name="ImageThumbSmall" desc="小缩略图">
        <div className={s.showcaseRow}>
          {images.slice(0, 5).map((img) => (
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
  const [openPromptBlock, setOpenPromptBlock] = useState<string | null>(null);
  const [showcaseLoras, setShowcaseLoras] = useState<LoraRowData[]>([
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
      enabled: false,
      kind: "manual" as const,
      triggerWords: "flat color",
    },
  ]);
  const updateShowcaseLora = (id: string, patch: Partial<(typeof showcaseLoras)[number]>) => {
    setShowcaseLoras((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="Section Editor 组件" subtitle="8 个小节编辑器专用组件" />

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
            scope: "section",
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
            variantName: "默认",
            blockCount: 1,
            loraCount: 0,
            variants: [
              { id: "v1", name: "默认" },
              { id: "v2", name: "湿润" },
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
          expanded={openPromptBlock === "pb-1"}
          column="positive"
          onToggle={() => setOpenPromptBlock((id) => (id === "pb-1" ? null : "pb-1"))}
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
          expanded={openPromptBlock === "pb-2"}
          column="negative"
          onToggle={() => setOpenPromptBlock((id) => (id === "pb-2" ? null : "pb-2"))}
        />
      </ShowcaseItem>

      {/* 5.5 CompiledPromptPreview */}
      <ShowcaseItem name="CompiledPromptPreview" desc="编译后的 Prompt 预览">
        <CompiledPromptPreview
          groups={[
            {
              id: "g1",
              presetName: "写实人像",
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
          entry={showcaseLoras[0]}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={(weight) => updateShowcaseLora("lora-1", { weight })}
          onToggle={() => updateShowcaseLora("lora-1", { enabled: !showcaseLoras[0]?.enabled })}
          onPathChange={(filePath) => updateShowcaseLora("lora-1", { filePath })}
          onUnlink={() => {}}
          onDelete={() => {}}
        />
        <hr className={s.showcaseDivider} />
        <LoraRow
          entry={showcaseLoras[1]}
          fileOptions={["add_detail.safetensors", "flat_color.safetensors", "realistic_skin.safetensors"]}
          onWeightChange={(weight) => updateShowcaseLora("lora-2", { weight })}
          onToggle={() => updateShowcaseLora("lora-2", { enabled: !showcaseLoras[1]?.enabled })}
          onPathChange={(filePath) => updateShowcaseLora("lora-2", { filePath })}
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

/* ══════════════════════════════════════════════════════════════
   Project Cards & List Components Page
   ══════════════════════════════════════════════════════════════ */

export function ComponentShowcaseProjects({ data: _data }: { data: DemoData }) {
  void _data;
  const [batchSize, setBatchSize] = useState(2);
  const [projectView, setProjectView] = useState<"sections" | "results">("sections");
  const images = useMemo(() => makeImages(6), []);

  return (
    <div className={s.showcasePage}>
      <PageHeader back={{ href: "/component-showcase", label: "返回总览" }} eyebrow="组件展示" title="项目卡片和列表" subtitle="项目列表页和详情页中的卡片、行和导航组件" />

      {/* ProjectListItem 模拟 */}
      <ShowcaseItem name="ProjectListItem" desc="项目卡片（选中框 + 缩略图条 + 标题/状态 + 统计 + 操作）">
        <div className={`${s.projectFolderWorkspace} ${s.showcaseProjectListPreview}`} style={{ maxWidth: 560 }}>
          <div className={s.projectListGrid}>
            <article className={`${s.projectListCard} ${s.projectListCardSelected}`}>
              <Button className={s.projectSelectButton} icon={CheckSquare} iconOnly pressed ariaLabel="取消选择" />
              <div className={s.projectListOpenArea}>
                <ImageStrip images={images} />
                <div className={s.cardHeader}>
                  <div className={s.projectCardTitle}>
                    <strong>夏日人像合集</strong>
                    <span>3 个预制</span>
                  </div>
                  <StatusBadge status="running" label="运行中" />
                </div>
                <div className={s.projectCardStats}>
                  <StatusBadge status="sections" label="12 小节" />
                  <StatusBadge status="checkpoint" label="dreamshaper_v8" />
                </div>
                <div className={`${s.small} ${s.faint}`}>更新：2026-05-09</div>
              </div>
              <div className={s.projectItemActions}>
                <Button tone="subtle" icon={FolderInput} iconOnly ariaLabel="移动" />
                <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
              </div>
            </article>
            <article className={s.projectListCard}>
              <Button className={s.projectSelectButton} icon={Square} iconOnly ariaLabel="选择项目" />
              <div className={s.projectListOpenArea}>
                <ImageStrip images={images.slice(0, 3)} />
                <div className={s.cardHeader}>
                  <div className={s.projectCardTitle}>
                    <strong>风景写意</strong>
                    <span>1 个预制</span>
                  </div>
                  <StatusBadge status="done" label="完成" />
                </div>
                <div className={s.projectCardStats}>
                  <StatusBadge status="sections" label="6 小节" />
                  <StatusBadge status="checkpoint" label="sdxl_base_1.0" />
                </div>
                <div className={`${s.small} ${s.faint}`}>更新：2026-05-08</div>
              </div>
              <div className={s.projectItemActions}>
                <Button tone="subtle" icon={FolderInput} iconOnly ariaLabel="移动" />
                <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
              </div>
            </article>
          </div>
        </div>
      </ShowcaseItem>

      {/* ProjectFolderRow 模拟 */}
      <ShowcaseItem name="ProjectFolderRow" desc="文件夹行（拖拽手柄 + 名称 + 条目数 + 操作）">
        <div style={{ maxWidth: 480 }}>
          <div className={s.projectFolderRow}>
            <Button className={s.projectFolderGrip} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <button className={s.projectFolderOpen} type="button">
              <Folder className={s.icon} />
              <strong>人物</strong>
              <span>8 项</span>
              <ChevronRight className={s.icon} />
            </button>
            <div className={s.projectFolderRowActions}>
              <Button tone="subtle" icon={Pencil} iconOnly ariaLabel="重命名" />
              <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" />
            </div>
          </div>
          <div className={s.projectFolderRow}>
            <Button className={s.projectFolderGrip} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <button className={s.projectFolderOpen} type="button">
              <Folder className={s.icon} />
              <strong>风景</strong>
              <span>3 项</span>
              <ChevronRight className={s.icon} />
            </button>
            <div className={s.projectFolderRowActions}>
              <Button tone="subtle" icon={Pencil} iconOnly ariaLabel="重命名" />
            </div>
          </div>
        </div>
      </ShowcaseItem>

      {/* ProjectFolderBreadcrumb 模拟 */}
      <ShowcaseItem name="ProjectFolderBreadcrumb" desc="文件夹面包屑导航">
        <div className={s.projectFolderBreadcrumbs}>
          <Button tone="subtle">根目录</Button>
          <span><ChevronRight className={s.icon} /><Button tone="subtle">人物</Button></span>
          <span><ChevronRight className={s.icon} /><Button tone="subtle" disabled>写实</Button></span>
        </div>
      </ShowcaseItem>

      {/* ProjectBatchBar 模拟 */}
      <ShowcaseItem name="ProjectBatchBar" desc="批量操作栏">
        <div style={{ maxWidth: 480 }}>
          <div className={s.projectBatchBar}>
            <strong>已选 3 个项目</strong>
            <div>
              <Button tone="subtle" icon={FolderInput}>移至文件夹</Button>
              <Button icon={CheckSquare}>全选</Button>
              <Button tone="subtle" icon={X} iconOnly ariaLabel="清除选择" />
            </div>
          </div>
        </div>
      </ShowcaseItem>

      {/* BatchSizeSelector 模拟 */}
      <ShowcaseItem name="BatchSizeSelector" desc="批量张数选择器">
        <SegmentedControl
          ariaLabel="选择批量张数"
          compact
          items={[1, 2, 4, 8, 16].map((option) => ({ value: option, label: option }))}
          onChange={setBatchSize}
          value={batchSize}
        />
        <hr className={s.showcaseDivider} />
        <div style={{ maxWidth: 240 }}>
          <SegmentedControl
            ariaLabel="选择紧凑批量张数"
            className={s.batchSizeSelectorCompact}
            compact
            items={[1, 2, 4, 8, 16].map((option) => ({ value: option, label: option }))}
            onChange={setBatchSize}
            value={batchSize}
          />
        </div>
      </ShowcaseItem>

      {/* ProjectViewToggle 模拟 */}
      <ShowcaseItem name="ProjectViewToggle" desc="项目视图切换（小节/结果）">
        <SegmentedControl
          ariaLabel="项目视图"
          className={s.projectViewToggle}
          items={[
            { value: "sections", label: "小节" },
            { value: "results", label: "结果" },
          ]}
          onChange={setProjectView}
          role="tablist"
          value={projectView}
        />
      </ShowcaseItem>

      {/* ProjectSectionCard 模拟 */}
      <ShowcaseItem name="ProjectSectionCard" desc="小节卡片（拖拽手柄 + 选中 + 标题 + 缩略图 + 运行/复制/删除）">
        <div style={{ maxWidth: 480 }}>
          <article className={s.sectionCard}>
            <Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
            <Button className={s.sectionSelectButton} icon={Square} iconOnly ariaLabel="选择" />
            <div className={s.sectionCardMain}>
              <div className={s.sectionCardHeader}>
                <div className={s.sectionCardTitle}>
                  <div className={s.sectionCardTitleLine}>
                    <span>01</span>
                    <strong>肖像 - 女性角色</strong>
                  </div>
                </div>
              </div>
              <div className={s.sectionCardBody}>
                <ImageStrip images={images.slice(0, 3)} />
                <div className={s.projectCardStats}>
                  <StatusBadge status="ratio" label="2:3" />
                  <StatusBadge status="steps" label="20 步" />
                  <StatusBadge status="lora" label="2 LoRA" />
                </div>
              </div>
              <div className={s.sectionCardActions}>
                <Button tone="primary" icon={Play}>运行</Button>
                <Button tone="subtle" icon={Copy}>复制</Button>
                <Button tone="danger" icon={Trash2}>删除</Button>
              </div>
            </div>
          </article>
        </div>
      </ShowcaseItem>

      {/* ProjectSectionResultCard 模拟 */}
      <ShowcaseItem name="ProjectSectionResultCard" desc="小节结果卡片（标题 + 状态标签 + 操作栏 + 图片列表）">
        <div style={{ maxWidth: 480 }}>
          <section className={s.resultSectionBlock}>
            <div className={s.resultSectionHeader}>
              <div className={s.resultSectionTitle}>
                <div className={s.sectionCardTitleLine}>
                  <span>01</span>
                  <strong>肖像 - 女性角色</strong>
                </div>
              </div>
              <div className={s.resultSectionActions}>
                <StatusBadge status="pending" label="4 待审" />
                <StatusBadge status="kept" label="6 保留" />
                <StatusBadge status="review" label="2 p站/预览" />
              </div>
            </div>
            <div className={s.resultActionBar}>
              <Button tone="subtle" icon={Square}>选择本节</Button>
              <Button icon={Check}>保留</Button>
              <Button tone="pink" icon={Star}>p站</Button>
            </div>
          </section>
        </div>
      </ShowcaseItem>

      {/* ProjectMoveMenu 模拟 */}
      <ShowcaseItem name="ProjectMoveMenu" desc="移动到文件夹下拉菜单">
        <div style={{ maxWidth: 200 }}>
          <div className={s.projectMoveMenu}>
            <Button tone="subtle" icon={FolderInput}>移动</Button>
          </div>
        </div>
        <div style={{ color: "var(--demo-muted)", fontSize: 12, marginTop: 8 }}>
          完整交互请查看项目列表页面（/design-demos/projects）
        </div>
      </ShowcaseItem>
    </div>
  );
}

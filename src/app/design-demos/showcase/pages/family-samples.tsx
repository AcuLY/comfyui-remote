"use client";

import { Check, Copy, Edit3, FileText, FolderInput, GripVertical, History, Home, Play, Plus, Search, Settings, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { DemoData } from "../../data";
import { buildHeaderSpecs } from "../../routing/header-specs";
import { RouteHeaderSurface } from "../../shell/header-surface";
import { DimensionsReadout, HistoryDiffRow, KSamplerCard, LoraColumn, LoraRow, type LoraRowData, PresetBindingRow, PromptBlockRow, SpecRow, SpecSection, StepperInput } from "../../features/projects";
import { makeImages } from "../helpers";
import { Button, Checkbox, DemoTabs, Field, MetricCard, PageHeader, SegmentedControl, StatusBadge, Switch } from "../../shared/primitives";
import { ImageListMedium, ImageListSmall, ImageThumbMedium, ReviewImageBoard } from "../../shared/media";
import { OperationStateStrip } from "../../shared/feedback";
import { AnchorRail, EditorBlock, FolderBreadcrumb, FolderRow, InspectorAside, MoveTargetPicker, SelectionBatchBar, SortableRowShell, ToolbarCluster, UnitRowShell, WorkbenchSurface } from "../../shared/patterns";
import type { ShowcaseFamilyId } from "../registry";
import s from "./showcase-pages.module.css";

export function FamilySamples({ data, familyId }: { data: DemoData; familyId: ShowcaseFamilyId }) {
  switch (familyId) {
    case "controls":
      return <ControlsSample />;
    case "surfaces":
      return <SurfacesSample />;
    case "unit-items":
      return <UnitItemsSample />;
    case "folders":
      return <FoldersSample />;
    case "batch-actions":
      return <BatchActionsSample />;
    case "generation-params":
      return <GenerationParamsSample />;
    case "preset-prompt-lora":
      return <PresetPromptLoraSample />;
    case "taxonomy-history":
      return <TaxonomyHistorySample />;
    case "images":
      return <ImagesSample />;
    case "runs":
      return <RunsSample />;
    case "system":
      return <SystemSample />;
    case "headers":
      return <HeadersSample data={data} />;
    case "icons":
      return <IconsSample />;
    default:
      return null;
  }
}

function ControlsSample() {
  const [tab, setTab] = useState("params");
  const [mode, setMode] = useState("lora");
  const [selectedProject, setSelectedProject] = useState(true);
  const [projectName, setProjectName] = useState("夏日人像合集");
  const [promptText, setPromptText] = useState("masterpiece, best quality, portrait, detailed light");
  return (
    <div className={s.sampleStack}>
      <div className={s.sampleRow}>
        <Button>默认</Button>
        <Button tone="primary" icon={Plus}>主操作</Button>
        <Button tone="subtle" icon={Settings}>次操作</Button>
        <Button tone="danger" icon={Trash2}>危险</Button>
        <Button icon={Star} iconOnly tone="pink" ariaLabel="精选" />
      </div>
      <div className={s.sampleRow}>
        <Checkbox checked={selectedProject} label="选择项目" onCheckedChange={setSelectedProject} />
        <Switch defaultChecked ariaLabel="启用" />
        <StatusBadge status="running" label="运行中" />
        <StatusBadge status="failed" label="失败" />
      </div>
      <SegmentedControl
        ariaLabel="模型类型"
        items={[{ value: "lora", label: "LoRA" }, { value: "checkpoint", label: "Checkpoint" }]}
        onChange={setMode}
        value={mode}
      />
      <DemoTabs
        tabs={[{ key: "params", label: "参数" }, { key: "results", label: "结果", count: 12 }, { key: "history", label: "历史" }]}
        value={tab}
        onChange={setTab}
      />
      <Field label="项目名称" value={projectName} onChange={setProjectName} />
      <Field multiline features={{ resize: true, clipboard: true }} label="正向 Prompt" value={promptText} onChange={setPromptText} />
    </div>
  );
}

function SurfacesSample() {
  return (
    <div className={s.sampleStack}>
      <PageHeader eyebrow="项目" title="夏日人像合集" subtitle="12 个小节 · 3 个预设" actions={<Button tone="primary" icon={Plus}>新增小节</Button>} />
      <WorkbenchSurface title="连续工作区" subtitle="一个主表面承载列表、状态条和操作区。">
        <EditorBlock title="编辑区块" description="标题、说明、状态和内容统一归位。" actions={<StatusBadge status="ready" label="已保存" />}>
          <div className={s.sampleCards}>
            <Field label="名称" value="写实人像" />
            <Field label="Slug" value="portrait-realistic" />
          </div>
        </EditorBlock>
      </WorkbenchSurface>
      <InspectorAside title="右侧详情栏">
        <OperationStateStrip items={[{ label: "保存", value: "空", tone: "success" }, { label: "错误", value: "0", tone: "success" }]} />
      </InspectorAside>
    </div>
  );
}

function UnitItemsSample() {
  const [selectedProject, setSelectedProject] = useState(true);
  return (
    <div className={s.sampleStack}>
      <UnitRowShell
        dragHandle={<Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="拖拽排序项目：夏日人像合集" />}
        leading={<Checkbox checked={selectedProject} label="选择项目" onCheckedChange={setSelectedProject} variant="compact" />}
        media={<StatusBadge status="running" label="运行中" />}
        title="夏日人像合集"
        description="项目列表项：封面、标题、状态、小节数和更新时间。"
        meta={<><span>12 小节</span><span>更新 2026-05-09</span></>}
        actions={<><Button icon={Edit3}>编辑</Button><Button tone="danger" icon={Trash2}>删除</Button></>}
        selected={selectedProject}
      />
      <UnitRowShell
        leading={<span className={s.miniSwatch} />}
        title="写实人像 / 高细节"
        description="预设库条目：分类色、名称、slug、说明和进入箭头。"
        meta={<StatusBadge status="ready" label="预设" />}
        actions={<Button icon={FileText}>打开</Button>}
      />
    </div>
  );
}

function FoldersSample() {
  const [activeFolderId, setActiveFolderId] = useState<string | null>("realistic");
  const [moveTargetId, setMoveTargetId] = useState<string | null>("realistic");
  const breadcrumbItems = activeFolderId === "realistic"
    ? [{ id: "people", label: "人物" }, { id: "realistic", label: "写实" }]
    : activeFolderId === "people"
      ? [{ id: "people", label: "人物" }]
      : [];
  const targetLabel = moveTargetId === "realistic" ? "写实" : moveTargetId === "people" ? "人物" : "根目录";
  return (
    <div className={s.sampleStack}>
      <FolderBreadcrumb
        items={breadcrumbItems}
        onNavigate={setActiveFolderId}
      />
      <FolderRow
        name="人物"
        countLabel="8 项"
        actions={<><Button icon={Edit3} iconOnly tone="subtle" ariaLabel="重命名" /><Button icon={Trash2} iconOnly tone="danger" ariaLabel="删除" /></>}
      />
      <MoveTargetPicker
        currentId={moveTargetId}
        label="移动到"
        options={[
          { id: null, label: "根目录", countLabel: "12 项" },
          { id: "people", label: "人物", depth: 1, countLabel: "8 项" },
          { id: "realistic", label: "写实", depth: 2, countLabel: "当前" },
        ]}
        onMove={setMoveTargetId}
      />
      <StatusBadge status="ready" label={`当前目标：${targetLabel}`} />
    </div>
  );
}

function BatchActionsSample() {
  const [selectedCount, setSelectedCount] = useState(3);
  return (
    <div className={s.sampleStack}>
      <SelectionBatchBar
        selectedCount={selectedCount}
        subject="个项目"
        actions={<><Button tone="subtle" icon={FolderInput}>移至文件夹</Button><Button icon={Check}>全选</Button><Button tone="danger" icon={Trash2}>批量删除</Button></>}
        onClear={() => setSelectedCount(0)}
      />
      <OperationStateStrip
        items={[
          { label: "保存队列", value: "空", tone: "success" },
          { label: "移动队列", value: "3 项", tone: "warning" },
          { label: "错误", value: "0", tone: "success" },
        ]}
      />
      <ToolbarCluster align="start">
        <Button icon={Play} feedback={{ title: "命令已发送" }}>运行</Button>
        <Button icon={Copy} feedback={{ title: "已复制" }}>复制</Button>
      </ToolbarCluster>
    </div>
  );
}

function GenerationParamsSample() {
  const [steps, setSteps] = useState(20);
  return (
    <div className={s.sampleStack}>
      <SpecSection title="采样参数" hint="参数行只负责生成配置，不归入普通表单控件。">
        <SpecRow label="步数" description="更多步数通常更精细">
          <StepperInput value={steps} onChange={setSteps} min={1} max={50} />
        </SpecRow>
      </SpecSection>
      <KSamplerCard
        label="KSampler 1"
        hint="第一次采样"
        params={{ steps: 20, cfg: 7, denoise: 0.85, sampler_name: "euler", scheduler: "normal", seedPolicy: "randomize" }}
      />
      <DimensionsReadout aspect="2:3" shortSide={768} upscale={2} />
    </div>
  );
}

function PresetPromptLoraSample() {
  const [expanded, setExpanded] = useState(false);
  const [loras, setLoras] = useState<LoraRowData[]>(() => [
    { id: "lora-1", fileName: "add_detail.safetensors", filePath: "add_detail/add_detail.safetensors", weight: 0.8, enabled: true, kind: "preset", presetName: "写实人像", categoryName: "人物", categoryColor: "158 100% 43%", triggerWords: "add detail" },
    { id: "lora-2", fileName: "flat_color.safetensors", filePath: "flat_color/flat_color.safetensors", weight: 0.5, enabled: true, kind: "manual", triggerWords: "flat color" },
  ]);
  const loraFileOptions = ["add_detail/add_detail.safetensors", "flat_color/flat_color.safetensors"];
  const firstLora = loras[0];

  function updateLora(id: string, updater: (entry: LoraRowData) => LoraRowData) {
    setLoras((current) => current.map((entry) => (entry.id === id ? updater(entry) : entry)));
  }

  function addLora() {
    setLoras((current) => [
      ...current,
      {
        id: `lora-${current.length + 1}`,
        fileName: "flat_color.safetensors",
        filePath: "flat_color/flat_color.safetensors",
        weight: 0.5,
        enabled: true,
        kind: "manual",
        triggerWords: "flat color",
      },
    ]);
  }

  function updateLoraPath(id: string, path: string) {
    updateLora(id, (entry) => ({ ...entry, filePath: path, fileName: path.split("/").pop() ?? path }));
  }

  return (
    <div className={s.sampleStack}>
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
          variants: [{ id: "v1", name: "默认" }, { id: "v2", name: "高细节" }],
        }}
      />
      <PromptBlockRow
        block={{ id: "pb-1", label: "主体描述", categoryName: "人物", categoryColor: "158 100% 43%", presetName: "写实人像", variantName: "高细节", positive: "masterpiece, best quality, portrait", negative: "lowres, blurry", kind: "preset" }}
        column="positive"
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      {firstLora ? (
        <LoraRow
          entry={firstLora}
          fileOptions={loraFileOptions}
          onDelete={() => setLoras((current) => current.filter((entry) => entry.id !== firstLora.id))}
          onPathChange={(path) => updateLoraPath(firstLora.id, path)}
          onToggle={() => updateLora(firstLora.id, (entry) => ({ ...entry, enabled: !entry.enabled }))}
          onUnlink={() => updateLora(firstLora.id, (entry) => ({ ...entry, kind: "manual" }))}
          onWeightChange={(weight) => updateLora(firstLora.id, (entry) => ({ ...entry, weight }))}
        />
      ) : null}
      <LoraColumn
        label="Stage 1"
        entries={loras}
        onAdd={addLora}
        onDelete={(id) => setLoras((current) => current.filter((entry) => entry.id !== id))}
        onPath={updateLoraPath}
        onToggle={(id) => updateLora(id, (entry) => ({ ...entry, enabled: !entry.enabled }))}
        onUnlink={(id) => updateLora(id, (entry) => ({ ...entry, kind: "manual" }))}
        onWeight={(id, weight) => updateLora(id, (entry) => ({ ...entry, weight }))}
      />
    </div>
  );
}

function TaxonomyHistorySample() {
  return (
    <div className={s.sampleStack}>
      <SortableRowShell index={0}>
        <strong>人物</strong>
        <span>预设 · 12 条目</span>
      </SortableRowShell>
      <AnchorRail
        items={[
          { id: "variant-default", label: "默认", meta: "default", active: true },
          { id: "variant-detail", label: "高细节", meta: "detail" },
        ]}
      />
      <HistoryDiffRow
        change={{
          id: "diff-1",
          timestamp: "2026-05-09 10:30",
          dimension: "ksampler1",
          title: "修改采样参数",
          before: "steps=20, cfg=7",
          after: "steps=30, cfg=8",
          diff: [{ field: "steps", before: "20", after: "30" }],
        }}
      />
    </div>
  );
}

function ImagesSample() {
  const images = useMemo(() => makeImages(8), []);
  return (
    <div className={s.sampleStack}>
      <ImageListSmall images={images} limit={6} showCounts maxWidth={520} />
      <ImageListMedium images={images.slice(0, 4)} showCounts summary="审核样例" maxHeight={280}>
        {images.slice(0, 4).map((image, index) => (
          <ImageThumbMedium key={image.id} image={image} selectable selected={index === 0} showStatus />
        ))}
      </ImageListMedium>
      <ReviewImageBoard images={images.slice(0, 4)} />
    </div>
  );
}

function RunsSample() {
  return (
    <div className={s.sampleStack}>
      <div className={s.sampleCards}>
        <MetricCard icon={Play} label="运行中" value={3} meta="2 个项目" />
        <MetricCard icon={Check} label="已完成" value={127} meta="今天 +12" />
      </div>
      <div className={s.sampleRow}>
        <StatusBadge status="running" label="运行中" />
        <StatusBadge status="failed" label="失败" />
        <StatusBadge status="pending" label="待审" />
      </div>
    </div>
  );
}

function SystemSample() {
  return (
    <div className={s.sampleStack}>
      <WorkbenchSurface title="系统日志" subtitle="终端式日志查看器，强调时间、级别、模块和消息。">
        <div className={s.miniLog}>
          <div><span>+000s</span><em>info</em><code>worker 心跳正常</code></div>
          <div><span>+012s</span><em>warn</em><code>image: 队列积压 3 项</code></div>
        </div>
      </WorkbenchSurface>
      <UnitRowShell
        leading={<Search size={16} />}
        title="ComfyUI API"
        description="http://127.0.0.1:8188 可访问"
        meta={<StatusBadge status="ready" label="42ms" />}
        actions={<Button icon={Settings}>探测</Button>}
      />
    </div>
  );
}

function HeadersSample({ data }: { data: DemoData }) {
  const spec = buildHeaderSpecs(data).flatMap((group) => group.specs)[0];
  if (!spec) return null;

  return (
    <div className={s.headerPreview}>
      <RouteHeaderSurface headingLevel={3} mode="expanded" spec={spec} titleId="showcase-header-sample" />
      <div className={s.headerPreviewContent} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function IconsSample() {
  return (
    <div className={s.iconMeaningTable}>
      <div><Home size={18} /><strong>Home</strong><span>任务工作台、返回主入口。</span></div>
      <div><FolderInput size={18} /><strong>FolderInput</strong><span>移动到文件夹，不表示普通打开。</span></div>
      <div><History size={18} /><strong>History</strong><span>历史记录、差异和审计流。</span></div>
      <div><Star size={18} /><strong>Star</strong><span>精选、p站、预览等结果标记需要结合文案确认。</span></div>
    </div>
  );
}

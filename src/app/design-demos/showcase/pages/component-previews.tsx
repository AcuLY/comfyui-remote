"use client";

import { Check, ClipboardList, Copy, Edit3, FolderInput, Gauge, GripVertical, Home, Monitor, Play, Plus, Settings, Star, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { presetLibraryItems, type DemoData } from "../../data";
import { firstCategory, firstProject, firstRun, firstSection, firstTemplate, findSection } from "../../routing";
import { ALL_ICONS } from "../icons/icon-data";
import { CustomIconDemo } from "../icons/custom-icon-demo";
import { IconList } from "../icons/icon-list";
import { modelFiles } from "../../features/models/model-fixtures";
import { buildCurrentRunningRuns, buildQueueReviewRows, buildQueueStatusRuns, groupRowsByProject } from "../../features/runs";
import { RouteHeaderSurface } from "../../shell/header-surface";
import { buildHeaderSpecs } from "../../routing/header-specs";
import { DimensionsReadout, HistoryDiffRow, ImageSizeControlGroup, KSamplerCard, LoraColumn, LoraRow, type LoraRowData, PresetBindingRow, PromptBlockRow, SpecRow, SpecSection, StepperInput } from "../../features/projects";
import { CurrentRunningProgressCard, PendingReviewGroups, QueueMetrics, ReviewMetaCard, RunList } from "../../features/runs";
import { ModelFileBrowser, ModelFileInspector, ModelFileRow } from "../../features/models";
import { PresetCategoryRow, PresetCategorySidebar, PresetLibraryItemRow, PresetMemberRow } from "../../features/presets";
import { ProjectListItem, ProjectSectionCard } from "../../features/projects";
import { LogFilterBar, LogLine, MonitorStatusRow } from "../../features/settings";
import { LoginTokenPanel } from "../../features/auth";
import { TemplateSectionRow } from "../../features/templates";
import { OperationStateStrip } from "../../shared/feedback";
import { ImageListMedium, ImageListSmall, ImagePreviewFrame, ImageThumbMedium, ReviewImageBoard } from "../../shared/media";
import { Button, ButtonLink, Checkbox, EmptyPage, EmptyRows, Field, FloatingSelect, PageHeader, SegmentedControl, StatusBadge, Switch } from "../../shared/primitives";
import { AnchorRail, EditorBlock, FolderBreadcrumb, FolderRow, InspectorAside, MoveTargetPicker, SelectionBatchBar, SortableRowShell, ToolbarCluster, UnitRowShell, WorkbenchSurface } from "../../shared/patterns";
import { makeImages } from "../helpers";
import type { ShowcasePreviewComponentName } from "../preview-keys";
import { SHOWCASE_PREVIEW_COMPONENT_NAMES } from "../preview-keys";
import type { ShowcaseComponentEntry } from "../registry";
import { IconMeaningTable } from "./icons-page";
import s from "./showcase-pages.module.css";

type PreviewRenderer = (props: { component: ShowcaseComponentEntry; data: DemoData }) => ReactNode;
type PreviewDataProps = { data: DemoData };

const sampleLoras: LoraRowData[] = [
  {
    id: "lora-preview-1",
    fileName: "add_detail.safetensors",
    filePath: "add_detail/add_detail.safetensors",
    weight: 0.8,
    enabled: true,
    kind: "preset",
    presetName: "写实人像",
    categoryName: "人物",
    categoryColor: "158 100% 43%",
    triggerWords: "add detail",
  },
  {
    id: "lora-preview-2",
    fileName: "flat_color.safetensors",
    filePath: "flat_color/flat_color.safetensors",
    weight: 0.5,
    enabled: true,
    kind: "manual",
    triggerWords: "flat color",
  },
];
const loraFileOptions = ["add_detail/add_detail.safetensors", "flat_color/flat_color.safetensors"];

const previewRenderers: Record<ShowcasePreviewComponentName, PreviewRenderer> = {
  Button: () => <ButtonPreview />,
  ButtonLink: () => (
    <div className={s.previewRow}>
      <ButtonLink href="/projects" icon={Home}>进入项目</ButtonLink>
      <ButtonLink href="/settings" tone="subtle" icon={Settings}>设置</ButtonLink>
    </div>
  ),
  Checkbox: () => <CheckboxPreview />,
  Switch: () => (
    <div className={s.previewRow}>
      <Switch defaultChecked ariaLabel="启用预览" />
      <Switch ariaLabel="关闭预览" />
    </div>
  ),
  StatusBadge: () => (
    <div className={s.previewRow}>
      <StatusBadge status="running" label="运行中" />
      <StatusBadge status="failed" label="失败" />
      <StatusBadge status="ready" label="已保存" />
    </div>
  ),
  SegmentedControl: () => <SegmentedControlPreview />,
  Field: () => <FieldsPreview />,
  FloatingSelect: () => <SelectControlsPreview />,
  PageHeader: () => (
    <div className={s.previewSurface}>
      <PageHeader eyebrow="项目" title="夏日人像合集" subtitle="12 个小节 · 3 个预设" actions={<Button tone="primary" icon={Plus}>新增</Button>} />
    </div>
  ),
  WorkbenchSurface: () => (
    <WorkbenchSurface title="连续工作区" subtitle="列表、状态和操作统一在一个表面内。">
      <EmptyRows label="这里承载行项或参数块" />
    </WorkbenchSurface>
  ),
  EditorBlock: () => (
    <EditorBlock title="编辑区块" description="标题、说明和内容一起出现。" actions={<StatusBadge status="ready" label="已保存" />}>
      <Field label="名称" value="写实人像" />
    </EditorBlock>
  ),
  InspectorAside: () => (
    <InspectorAside title="右侧详情栏">
      <OperationStateStrip items={[{ label: "状态", value: "正常", tone: "success" }, { label: "错误", value: "0", tone: "success" }]} />
    </InspectorAside>
  ),
  "EmptyPage / EmptyRows": () => (
    <div className={s.previewGrid}>
      <EmptyRows label="当前筛选没有内容" />
      <div className={s.previewSurface}>
        <EmptyPage title="没有预设分类" />
      </div>
    </div>
  ),
  UnitRowShell: () => <UnitRowShellPreview />,
  ProjectListItem: ({ data }) => <ProjectListItemPreview data={data} />,
  ProjectSectionCard: ({ data }) => {
    const project = firstProject(data);
    const section = firstSection(project);
    if (!project || !section) return <EmptyRows label="没有小节样例" />;
    return <ProjectSectionCard compact index={0} project={project} section={section} />;
  },
  PresetLibraryItemRow: ({ data }) => <PresetLibraryItemRowPreview data={data} />,
  TemplateSectionRow: ({ data }) => {
    const template = firstTemplate(data);
    const section = template?.sections[0];
    if (!section) return <EmptyRows label="没有模板小节样例" />;
    return <TemplateSectionRow index={0} section={section} template={template} />;
  },
  FolderBreadcrumb: () => <FolderBreadcrumbPreview />,
  FolderRow: () => (
    <FolderRow
      name="人物"
      countLabel="8 项"
      actions={<><Button icon={Edit3} iconOnly tone="subtle" ariaLabel="重命名" /><Button icon={Trash2} iconOnly tone="danger" ariaLabel="删除" /></>}
    />
  ),
  MoveTargetPicker: () => <MoveTargetPickerPreview />,
  ModelFileRow: () => <ModelFileRowPreview />,
  SelectionBatchBar: () => <SelectionBatchBarPreview />,
  ToolbarCluster: () => (
    <ToolbarCluster align="start">
      <Button icon={Play}>运行</Button>
      <Button icon={Copy}>复制</Button>
      <Button icon={Trash2} tone="danger">删除</Button>
    </ToolbarCluster>
  ),
  OperationStateStrip: () => (
    <OperationStateStrip items={[{ label: "保存", value: "空", tone: "success" }, { label: "移动", value: "3 项", tone: "warning" }, { label: "错误", value: "0", tone: "success" }]} />
  ),
  DemoFeedbackProvider: () => (
    <div className={s.previewRow}>
      <Button feedback={{ title: "命令已发送", detail: "showcase preview" }} icon={Check}>成功反馈</Button>
      <Button tone="danger" feedback={{ tone: "warning", title: "危险操作需要确认" }} icon={Trash2}>危险反馈</Button>
    </div>
  ),
  "SpecSection / SpecRow": () => <SpecSectionPreview />,
  KSamplerCard: () => (
    <KSamplerCard
      label="KSampler 1"
      hint="第一次采样"
      params={{ steps: 20, cfg: 7, denoise: 0.85, sampler_name: "euler", scheduler: "normal", seedPolicy: "random" }}
    />
  ),
  DimensionsReadout: () => <DimensionsReadout aspect="2:3" shortSide={768} upscale={2} />,
  ImageSizeControlGroup: () => <ImageSizeControlGroupPreview />,
  PresetBindingRow: () => (
    <PresetBindingRow
      binding={{
        id: "binding-preview",
        kind: "preset",
        scope: "section",
        categoryId: "cat-people",
        categoryName: "人物",
        categoryColor: "158 100% 43%",
        name: "写实人像",
        variantName: "高细节",
        blockCount: 2,
        loraCount: 1,
        variants: [{ id: "default", name: "默认" }, { id: "detail", name: "高细节" }],
      }}
    />
  ),
  PromptBlockRow: () => <PromptBlockPreview />,
  "LoraRow / LoraColumn": () => <LoraPreview />,
  PresetMemberRow: () => (
    <PresetMemberRow index={0} member={{ id: "member-1", name: "写实人像", categoryName: "人物", variant: "默认" }} />
  ),
  SortableRowShell: () => (
    <SortableRowShell index={0}>
      <strong>人物</strong>
      <span>预设 · 12 条目</span>
    </SortableRowShell>
  ),
  AnchorRail: () => (
    <AnchorRail items={[{ id: "variant-default", label: "默认", meta: "default", active: true }, { id: "variant-detail", label: "高细节", meta: "detail" }]} />
  ),
  HistoryDiffRow: () => (
    <HistoryDiffRow
      change={{
        id: "diff-preview",
        timestamp: "2026-05-09 10:30",
        dimension: "ksampler1",
        title: "修改采样参数",
        before: "steps=20, cfg=7",
        after: "steps=30, cfg=8",
        diff: [{ field: "steps", before: "20", after: "30" }],
      }}
    />
  ),
  "PresetCategorySidebar / PresetCategoryRow": ({ data }) => <PresetCategoryPreview data={data} />,
  "ImageThumbSmall / ImageListSmall": () => {
    const images = makeImages(6);
    return <ImageListSmall images={images} limit={6} showCounts maxWidth={440} />;
  },
  "ImageThumbMedium / ImageListMedium": () => {
    const images = makeImages(4);
    return (
      <ImageListMedium images={images} showCounts summary="审核样例" maxHeight={220}>
        {images.map((image, index) => (
          <ImageThumbMedium key={image.id} image={image} selectable selected={index === 0} showStatus />
        ))}
      </ImageListMedium>
    );
  },
  "ImageGrid / ReviewImageBoard": () => {
    const images = makeImages(4);
    return (
      <div className={s.previewClip}>
        <ReviewImageBoard images={images} />
      </div>
    );
  },
  "ImagePreviewFrame / ImagePreviewLarge": () => {
    const image = makeImages(1)[0];
    return (
      <div className={s.previewImageFrame}>
        <ImagePreviewFrame image={image} interactive />
      </div>
    );
  },
  QueueMetrics: ({ data }) => (
    <QueueMetrics
      pendingImages={data.metrics.pendingImages || 8}
      reviewGroups={Math.max(1, buildQueueReviewRows(data.runs).length)}
      runningCount={buildQueueStatusRuns(data.runs, "running").length}
      failedCount={buildQueueStatusRuns(data.runs, "failed").length}
    />
  ),
  CurrentRunningProgressCard: ({ data }) => (
    <CurrentRunningProgressCard runs={buildCurrentRunningRuns(buildQueueStatusRuns(data.runs, "running"))} />
  ),
  "RunList / PendingReviewGroups": ({ data }) => <RunListsPreview data={data} />,
  ReviewMetaCard: ({ data }) => {
    const run = firstRun(data);
    const project = data.projects.find((item) => item.id === run?.projectId) ?? firstProject(data);
    const section = findSection(project, run?.sectionId);
    if (!run || !section) return <EmptyRows label="没有运行样例" />;
    return <ReviewMetaCard run={run} section={section} meta={run.executionMeta} />;
  },
  "LogFilterBar / LogLine": () => <LogPreview />,
  MonitorStatusRow: () => (
    <div className={s.previewStack}>
      <MonitorStatusRow icon={Gauge} title="Worker" description="心跳正常，轮询窗口稳定。" status="ready" label="正常" />
      <MonitorStatusRow icon={Monitor} title="ComfyUI API" description="http://127.0.0.1:8188 可访问" status="running" label="运行中" />
      <MonitorStatusRow icon={ClipboardList} title="任务积压" description="2 个处理中任务。" status="pending" label="忙碌" />
    </div>
  ),
  "ModelFileBrowser / ModelFileInspector": () => <ModelBrowserPreview />,
  LoginTokenPanel: () => <LoginTokenPanel />,
  RouteHeaderSurface: ({ data }) => <RouteHeaderPreview data={data} />,
  PageHeaderCard: ({ data }) => <RouteHeaderPreview data={data} />,
  IconList: () => (
    <IconList
      metaHeader="使用位置"
      entries={ALL_ICONS.slice(0, 5).map(({ icon, name, desc, usedIn }) => ({ icon, name, desc, meta: usedIn.slice(0, 3) }))}
    />
  ),
  CustomIconDemo: () => (
    <div className={s.previewClip}>
      <CustomIconDemo />
    </div>
  ),
  IconMeaningTable: () => <IconMeaningTable />,
};

export function hasComponentPreview(componentName: string) {
  return SHOWCASE_PREVIEW_COMPONENT_NAMES.includes(componentName as ShowcasePreviewComponentName);
}

export function ComponentPreview({ component, data }: { component: ShowcaseComponentEntry; data: DemoData }) {
  const render = hasComponentPreview(component.componentName)
    ? previewRenderers[component.componentName as ShowcasePreviewComponentName]
    : null;
  if (!render) return <EmptyRows label={`${component.reviewName} 暂无预览`} />;
  return <div className={s.previewStack}>{render({ component, data })}</div>;
}

function ButtonPreview() {
  return (
    <div className={s.previewRow}>
      <Button>默认</Button>
      <Button tone="primary" icon={Plus}>主操作</Button>
      <Button tone="subtle" icon={Settings}>次操作</Button>
      <Button tone="danger" icon={Trash2}>危险</Button>
      <Button icon={Star} iconOnly tone="pink" ariaLabel="精选" />
    </div>
  );
}

function CheckboxPreview() {
  const [checkedSelected, setCheckedSelected] = useState(true);
  const [uncheckedSelected, setUncheckedSelected] = useState(false);
  return (
    <div className={s.previewRow}>
      <Checkbox checked={checkedSelected} label="已选择" onCheckedChange={setCheckedSelected} />
      <Checkbox checked={uncheckedSelected} label="未选择" onCheckedChange={setUncheckedSelected} />
    </div>
  );
}

function FieldsPreview() {
  const [name, setName] = useState("写实人像");
  const [prompt, setPrompt] = useState("masterpiece, best quality, portrait");
  return (
    <div className={s.previewGrid}>
      <Field label="名称" value={name} onChange={setName} />
      <Field multiline features={{ resize: true, clipboard: true }} label="Prompt" value={prompt} onChange={setPrompt} />
    </div>
  );
}

function SelectControlsPreview() {
  const [scheduler, setScheduler] = useState("normal");
  const [presetStatus, setPresetStatus] = useState("draft");

  return (
    <div className={s.previewGrid}>
      <FloatingSelect
        ariaLabel="选择 Scheduler"
        onChange={setScheduler}
        options={[
          { value: "normal", label: "normal", description: "默认调度" },
          { value: "karras", label: "karras", description: "更平滑的降噪" },
          { value: "exponential", label: "exponential", description: "指数调度" },
        ]}
        value={scheduler}
      />
      <FloatingSelect
        label="预设状态"
        value={presetStatus}
        options={["draft", "ready", "archived"]}
        onChange={setPresetStatus}
      />
    </div>
  );
}

function UnitRowShellPreview() {
  const [selected, setSelected] = useState(true);
  return (
    <UnitRowShell
      dragHandle={<Button className={s.dragHandle} tone="subtle" icon={GripVertical} iconOnly ariaLabel="拖拽排序条目" />}
      leading={<Checkbox checked={selected} label="选择" onCheckedChange={setSelected} variant="compact" />}
      media={<StatusBadge status="running" label="运行中" />}
      title="夏日人像合集"
      description="主信息、元信息和行尾操作都使用槽位组合。"
      meta={<><span>12 小节</span><span>刚刚更新</span></>}
      actions={<Button icon={Edit3}>编辑</Button>}
      selected={selected}
    />
  );
}

function ProjectListItemPreview(props: PreviewDataProps) {
  const { data } = props;
  const project = firstProject(data);
  const [selected, setSelected] = useState(true);
  if (!project) return <EmptyRows label="没有项目样例" />;
  return <ProjectListItem project={project} selected={selected} onToggleSelected={() => setSelected((current) => !current)} />;
}

function PresetLibraryItemRowPreview(props: PreviewDataProps) {
  const { data } = props;
  const category = firstCategory(data);
  const item = category ? presetLibraryItems(category)[0] : null;
  const [checked, setChecked] = useState(true);
  if (!item) return <EmptyRows label="没有预设条目样例" />;
  return <PresetLibraryItemRow checked={checked} index={0} item={item} onToggle={() => setChecked((current) => !current)} />;
}

function ModelFileRowPreview() {
  const file = modelFiles[2] ?? modelFiles[0];
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  if (!file) return <EmptyRows label="没有模型文件样例" />;

  return (
    <ModelFileRow
      file={file}
      onAction={(activeFile) => setSelectedFileId(activeFile.id)}
      onSelect={(activeFile) => setSelectedFileId(activeFile.id)}
      selected={selectedFileId === file.id}
    />
  );
}

function SelectionBatchBarPreview() {
  const [selectedCount, setSelectedCount] = useState(3);
  return (
    <SelectionBatchBar
      selectedCount={selectedCount}
      subject="个项目"
      actions={<><Button tone="subtle" icon={FolderInput}>移动</Button><Button tone="danger" icon={Trash2}>删除</Button></>}
      onClear={() => setSelectedCount(0)}
    />
  );
}

function FolderBreadcrumbPreview() {
  const [activeFolderId, setActiveFolderId] = useState<string | null>("portrait");
  const items = activeFolderId === "portrait"
    ? [{ id: "people", label: "人物" }, { id: "portrait", label: "写实" }]
    : activeFolderId === "people"
      ? [{ id: "people", label: "人物" }]
      : [];
  return <FolderBreadcrumb items={items} onNavigate={setActiveFolderId} />;
}

function MoveTargetPickerPreview() {
  const [moveTargetId, setMoveTargetId] = useState<string | null>("portrait");
  const targetLabel = moveTargetId === "portrait" ? "写实" : moveTargetId === "people" ? "人物" : "根目录";
  return (
    <div className={s.previewRow}>
      <MoveTargetPicker
        currentId={moveTargetId}
        label="移动到"
        options={[{ id: null, label: "根目录", countLabel: "12 项" }, { id: "people", label: "人物", depth: 1, countLabel: "8 项" }, { id: "portrait", label: "写实", depth: 2, countLabel: "当前" }]}
        onMove={setMoveTargetId}
      />
      <StatusBadge status="ready" label={`当前：${targetLabel}`} />
    </div>
  );
}

function SegmentedControlPreview() {
  const [value, setValue] = useState("lora");
  const [tab, setTab] = useState("params");
  return (
    <div className={s.previewStack}>
      <SegmentedControl
        ariaLabel="模型类型"
        items={[{ value: "lora", label: "LoRA" }, { value: "checkpoint", label: "Checkpoint" }]}
        onChange={setValue}
        value={value}
      />
      <SegmentedControl
        ariaLabel="切换视图"
        role="tablist"
        items={[{ value: "params", label: "参数" }, { value: "results", label: "结果", count: 12 }, { value: "history", label: "历史" }]}
        value={tab}
        onChange={setTab}
      />
    </div>
  );
}

function SpecSectionPreview() {
  const [steps, setSteps] = useState(20);
  const [checkpoint, setCheckpoint] = useState("realisticVision.safetensors");
  return (
    <SpecSection title="采样参数" hint="参数行只负责生成配置。">
      <SpecRow label="步数" description="更多步数通常更精细">
        <StepperInput value={steps} onChange={setSteps} min={1} max={50} />
      </SpecRow>
      <SpecRow label="Checkpoint">
        <FloatingSelect
          label="模型"
          value={checkpoint}
          options={["realisticVision.safetensors", "dreamShaper.safetensors", "sdxlBase.safetensors"]}
          onChange={setCheckpoint}
        />
      </SpecRow>
    </SpecSection>
  );
}

function ImageSizeControlGroupPreview() {
  const [aspectRatio, setAspectRatio] = useState("2:3");
  const [shortSidePx, setShortSidePx] = useState(768);
  const [upscaleFactor, setUpscaleFactor] = useState(2);
  return (
    <ImageSizeControlGroup
      aspectRatio={aspectRatio}
      onAspectRatioChange={setAspectRatio}
      onShortSideChange={setShortSidePx}
      onUpscaleChange={setUpscaleFactor}
      shortSidePx={shortSidePx}
      upscaleFactor={upscaleFactor}
    />
  );
}

function PromptBlockPreview() {
  const [expanded, setExpanded] = useState(false);
  return (
    <PromptBlockRow
      block={{
        id: "prompt-preview",
        label: "主体描述",
        categoryName: "人物",
        categoryColor: "158 100% 43%",
        presetName: "写实人像",
        variantName: "高细节",
        positive: "masterpiece, best quality, portrait",
        negative: "lowres, blurry",
        kind: "preset",
      }}
      column="positive"
      expanded={expanded}
      onToggle={() => setExpanded((value) => !value)}
    />
  );
}

function LoraPreview() {
  const [loras, setLoras] = useState<LoraRowData[]>(() => sampleLoras);
  const firstLora = loras[0];

  function updateLora(id: string, updater: (entry: LoraRowData) => LoraRowData) {
    setLoras((current) => current.map((entry) => (entry.id === id ? updater(entry) : entry)));
  }

  function addLora() {
    setLoras((current) => [
      ...current,
      {
        id: `lora-preview-${current.length + 1}`,
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
    <div className={s.previewStack}>
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

function PresetCategoryPreview({ data }: PreviewDataProps) {
  const categories = data.categories.slice(0, 3);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id ?? "");
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) ?? categories[0];
  if (!selectedCategory) return <EmptyRows label="没有分类样例" />;

  return (
    <div className={s.previewGrid}>
      <PresetCategoryRow category={selectedCategory} onSelect={(category) => setSelectedCategoryId(category.id)} selected />
      <PresetCategorySidebar categories={categories} selectedCategory={selectedCategory} onSelect={(category) => setSelectedCategoryId(category.id)} />
    </div>
  );
}

function RunListsPreview({ data }: { data: DemoData }) {
  const reviewRows = buildQueueReviewRows(data.runs);
  const groups = groupRowsByProject(reviewRows);
  const runningRuns = buildQueueStatusRuns(data.runs, "running").slice(0, 3);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  return (
    <div className={s.previewClip}>
      <RunList
        title="运行中"
        runs={runningRuns}
        empty="当前没有运行任务"
        mode="running"
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
      />
      <PendingReviewGroups
        groups={groups}
        reviewRows={reviewRows}
        totalPending={reviewRows.reduce((sum, row) => sum + row.pendingCount, 0)}
        totalPages={1}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
      />
    </div>
  );
}

function LogPreview() {
  const [source, setSource] = useState<"app" | "console">("app");
  const [level, setLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const modules = ["all", "worker", "image"];
  return (
    <div className={s.previewStack}>
      <LogFilterBar
        auditCount={3}
        consoleCount={4}
        level={level}
        moduleFilter={moduleFilter}
        modules={modules}
        onLevelChange={setLevel}
        onModuleChange={setModuleFilter}
        onSourceChange={setSource}
        source={source}
      />
      <div className={s.previewLog}>
        <LogLine log={{ id: "log-1", level: "info", module: "worker", message: "worker 心跳正常", time: "+000s" }} />
        <LogLine log={{ id: "log-2", level: "warn", module: "image", message: "队列积压 3 项", time: "+012s" }} />
      </div>
    </div>
  );
}

function ModelBrowserPreview() {
  const [activeTab, setActiveTab] = useState<"lora" | "checkpoint">("lora");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(modelFiles.find((file) => file.type === "file") ?? null);
  const [editingNotes, setEditingNotes] = useState(false);
  return (
    <div className={s.previewSplit}>
      <ModelFileBrowser
        activeTab={activeTab}
        breadcrumbs={[{ label: "models", path: "models" }]}
        currentPath={["models"]}
        files={modelFiles}
        onBack={() => setSearchQuery("")}
        onBreadcrumbClick={() => setSearchQuery("")}
        onFileAction={setSelectedFile}
        onFileSelect={setSelectedFile}
        onSearchChange={setSearchQuery}
        onTabChange={setActiveTab}
        onUpload={() => setSearchQuery("")}
        searchQuery={searchQuery}
        selectedFileId={selectedFile?.id ?? null}
      />
      {selectedFile ? (
        <ModelFileInspector
          editingNotes={editingNotes}
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onMove={() => setSearchQuery(selectedFile.name)}
          onToggleEditingNotes={() => setEditingNotes((value) => !value)}
        />
      ) : null}
    </div>
  );
}

function RouteHeaderPreview({ data }: { data: DemoData }) {
  const spec = buildHeaderSpecs(data).flatMap((group) => group.specs)[0];
  if (!spec) return <EmptyRows label="没有 header 样例" />;
  return (
    <div className={s.previewHeaderFrame}>
      <RouteHeaderSurface headingLevel={3} mode="expanded" spec={spec} titleId="component-card-header-preview" />
      <div aria-hidden="true">
        <span />
        <span />
      </div>
    </div>
  );
}

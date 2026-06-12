"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, CheckSquare, CopyPlus, Edit3, GripVertical, Plus, Save, Shuffle, Trash2 } from "lucide-react";

import type { DemoData } from "../../data";
import { cx, demoHref } from "../../routing";
import { OperationStateStrip } from "../../shared/feedback/operation-state-strip";
import { Button, ButtonLink } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { Field } from "../../shared/primitives/field";
import { FloatingSelect } from "../../shared/primitives/floating-select";
import { PageHeader } from "../../shared/primitives/page-header";
import { Panel } from "../../shared/primitives/panel";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";
import { EditorBlock, FolderBreadcrumb, FolderRow, SelectionBatchBar, SortableRowShell, UnitRowShell, WorkbenchSurface } from "../../shared/patterns";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingPreset, LoraTrainingSectionBlock, LoraTrainingTemplate } from "./types";
import s from "./training-resource-pages.module.css";

type TemplateSceneBlockPatch = Partial<Pick<LoraTrainingSectionBlock, "text" | "title">>;

function presetStatus(preset: LoraTrainingPreset) {
  return preset.status === "active" ? <StatusBadge status="ready" label="启用" /> : <StatusBadge status="archived" label="停用" />;
}

function findPreset(data: DemoData, presetId?: string) {
  const training = buildLoraTrainingDemoData(data);
  return training.presets.find((preset) => preset.id === presetId) ?? training.presets[0];
}

function findTemplate(data: DemoData, templateId?: string) {
  const training = buildLoraTrainingDemoData(data);
  return training.templates.find((template) => template.id === templateId) ?? training.templates[0];
}

function uniquePresetCategories(presets: LoraTrainingPreset[]) {
  return Array.from(new Set(presets.reduce<string[]>((items, preset) => [...items, preset.category], [])));
}

function uniquePresetFolders(presets: LoraTrainingPreset[]) {
  return Array.from(new Set(presets.reduce<string[]>((items, preset) => [...items, preset.folder], [])));
}

function moveTemplateBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

function orderTemplateSectionsByIds(sections: LoraTrainingTemplateSection[], orderedIds: string[]) {
  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));
  const orderedSections = orderedIds.map((id) => sectionMap[id]).filter((section): section is LoraTrainingTemplateSection => Boolean(section));
  const missingSections = sections.filter((section) => !orderedIds.includes(section.id));
  return [...orderedSections, ...missingSections];
}

function orderTrainingTemplatesByIds(templates: LoraTrainingTemplate[], orderedIds: string[]) {
  const templateMap = Object.fromEntries(templates.map((template) => [template.id, template]));
  const orderedTemplates = orderedIds.map((id) => templateMap[id]).filter((template): template is LoraTrainingTemplate => Boolean(template));
  const missingTemplates = templates.filter((template) => !orderedIds.includes(template.id));
  return [...orderedTemplates, ...missingTemplates];
}

function presetUsageLabel(preset: LoraTrainingPreset) {
  const usageCount = preset.projectUsage.length + preset.templateUsage.length;
  return usageCount > 0 ? `${usageCount} 处引用` : "未引用";
}

function subscribeToUrlSearch(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getUrlSearchSnapshot() {
  return typeof window === "undefined" ? "" : window.location.search;
}

function getServerUrlSearchSnapshot() {
  return "";
}

function useUrlSearch() {
  return useSyncExternalStore(subscribeToUrlSearch, getUrlSearchSnapshot, getServerUrlSearchSnapshot);
}

type NewPresetHints = {
  artifact: string;
  category: string;
  folder: string;
  project: string;
  sourceRun: string;
};

type NewTemplateHints = {
  projectId: string;
  sections: string;
  sourceProject: string;
};

function readNewPresetHints(search: string) {
  const searchParams = new URLSearchParams(search);
  return {
    artifact: searchParams.get("artifact") ?? "",
    category: searchParams.get("category") ?? "",
    folder: searchParams.get("folder") ?? "",
    project: searchParams.get("project") ?? "",
    sourceRun: searchParams.get("sourceRun") ?? "",
  };
}

function readNewTemplateHints(search: string): NewTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    projectId: searchParams.get("projectId") ?? "",
    sections: searchParams.get("sections") ?? "",
    sourceProject: searchParams.get("sourceProject") ?? "",
  };
}

function createProjectFromTemplateHref(template: LoraTrainingTemplate) {
  const searchParams = new URLSearchParams({
    sections: String(template.sections.length),
    template: template.title,
    templateId: template.id,
  });
  return `/training/projects/new?${searchParams.toString()}`;
}

function createDraftTrainingPreset(training: ReturnType<typeof buildLoraTrainingDemoData>, hints: NewPresetHints): LoraTrainingPreset {
  const source = training.presets[0];
  const artifactTitle = hints.artifact.replace(/\.safetensors$/i, "");
  const sourceLabel = hints.project || artifactTitle;
  return {
    id: "new-training-preset",
    title: sourceLabel ? `${sourceLabel} 训练预制` : "新训练预制",
    category: hints.category || source?.category || "角色",
    folder: hints.folder || source?.folder || "未归档",
    status: "active",
    updatedAt: "本地草稿",
    sceneDescriptionText: hints.artifact
      ? `从 ${hints.project || "训练项目"} 的训练产物 ${hints.artifact} 创建，补充后作为可复用场景描述导入训练小节。`
      : "在这里补充可复用的场景描述，只描述训练小节需要导入的场景文本。",
    projectUsage: [],
    templateUsage: [],
  };
}

type TrainingPresetSortItem = { id: string; meta: string; title: string };

function orderTrainingPresetSortItems(items: TrainingPresetSortItem[], orderedIds: string[]) {
  const itemMap = Object.fromEntries(items.map((item) => [item.id, item]));
  const orderedItems = orderedIds.map((id) => itemMap[id]).filter((item): item is TrainingPresetSortItem => Boolean(item));
  const missingItems = items.filter((item) => !orderedIds.includes(item.id));
  return [...orderedItems, ...missingItems];
}

function TrainingPresetSortPanel({
  items,
  onReorder,
  onSave,
  orderedIds,
  subtitle,
  title,
}: {
  items: TrainingPresetSortItem[];
  onReorder: (ids: string[]) => void;
  onSave: (scope: string, ids: string[], items: TrainingPresetSortItem[]) => void;
  orderedIds: string[];
  subtitle: string;
  title: string;
}) {
  const orderedItems = orderTrainingPresetSortItems(items, orderedIds);

  return (
    <section className={s.trainingPresetSortPanel}>
      <div className={s.trainingPresetSortHeader}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <StatusBadge status="ready" label="已保存" />
      </div>
      <div className={s.trainingPresetSortList}>
        <SortableList items={orderedItems.map((item) => item.id)} onReorder={onReorder}>
          {orderedItems.map((item, index) => (
            <TrainingPresetSortableSortRow item={item} index={index} key={item.id} />
          ))}
        </SortableList>
      </div>
      <div className={s.trainingPresetSortFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} onClick={() => onSave(title, orderedIds, items)} feedback={{ title: `${title} 保存草稿已记录` }}>保存此组</Button>
      </div>
    </section>
  );
}

function TrainingPresetSortableSortRow({ index, item }: { index: number; item: TrainingPresetSortItem }) {
  const { ref, style, handleProps } = useDemoSortable(item.id);
  return (
    <div ref={ref} style={style}>
      <SortableRowShell
        className={s.trainingPresetSortRow}
        contentClassName={s.trainingPresetSortRowContent}
        handleClassName={s.grip}
        handleProps={handleProps}
        index={index}
        indexClassName={s.trainingPresetSortIndex}
      >
        <div className={s.trainingPresetSortRowText}>
          <strong>{item.title}</strong>
          <em>{item.meta}</em>
        </div>
      </SortableRowShell>
    </div>
  );
}

function TemplateSceneBlockCard({
  block,
  index,
  isEditing,
  onDelete,
  onEdit,
  onMove,
  onUpdate,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  isEditing?: boolean;
  onDelete?: (blockId: string) => void;
  onEdit?: (blockId: string | null) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  onUpdate?: (blockId: string, patch: TemplateSceneBlockPatch) => void;
  total: number;
}) {
  return (
    <article className={s.templateSceneBlockCard}>
      <div className={s.templateSceneBlockBody}>
        <span>{block.source === "预制" ? "预制块" : "本地块"}</span>
        {isEditing ? (
          <div className={s.templateSceneBlockEditor}>
            <Field label="模板块标题" value={block.title} onChange={(value) => onUpdate?.(block.id, { title: value })} />
            <Field
              multiline
              features={{ clipboard: true, resize: true }}
              label="模板块文本"
              value={block.text}
              onChange={(value) => onUpdate?.(block.id, { text: value })}
            />
          </div>
        ) : (
          <>
            <strong>{block.title}</strong>
            <p>{block.text}</p>
          </>
        )}
      </div>
      <div className={s.templateSceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={isEditing ? `收起模板场景块编辑：${block.title}` : `编辑模板场景块：${block.title}`} onClick={() => onEdit?.(isEditing ? null : block.id)}>{isEditing ? "收起" : "编辑"}</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移模板场景块：${block.title}`} feedback={{ title: "模板块已上移", detail: block.title }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移模板场景块：${block.title}`} feedback={{ title: "模板块已下移", detail: block.title }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除模板场景块：${block.title}`} feedback={{ tone: "warning", title: "模板块已从草稿移除", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}

function TrainingPresetLibraryItemRow({
  index,
  onDelete,
  onToggleSelected,
  preset,
  selected,
}: {
  index: number;
  onDelete: () => void;
  onToggleSelected: (checked: boolean) => void;
  preset: LoraTrainingPreset;
  selected: boolean;
}) {
  const { ref, style, handleProps } = useDemoSortable(preset.id);

  return (
    <div ref={ref} style={style}>
      <UnitRowShell
        className={s.trainingPresetItemFrame}
        selected={selected}
        dragHandle={<GripVertical className={s.grip} aria-hidden="true" {...handleProps} />}
        leading={(
          <Checkbox
            checked={selected}
            label={`选择训练预制：${preset.title}`}
            onCheckedChange={onToggleSelected}
            stopPropagation
            variant="compact"
          />
        )}
        title={<Link className={s.trainingPresetTitleLink} href={demoHref(`/training/presets/${preset.id}`)}>{preset.title}</Link>}
        description={<Link className={s.trainingPresetDescriptionLink} href={demoHref(`/training/presets/${preset.id}`)}>{preset.sceneDescriptionText}</Link>}
        body={(
          <div className={s.trainingPresetUsageChips}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>{preset.folder}</span>
            <span>{presetUsageLabel(preset)}</span>
          </div>
        )}
        meta={<div className={s.trainingPresetMeta}>{presetStatus(preset)}<span>更新 {preset.updatedAt}</span></div>}
        actions={(
          <div className={s.trainingPresetActions}>
            <ButtonLink href={`/training/presets/${preset.id}`} size="sm" icon={Edit3}>编辑</ButtonLink>
            <Button size="sm" tone="danger" icon={Trash2} iconOnly ariaLabel={`删除训练预制：${preset.title}`} onClick={onDelete} feedback={{ tone: "warning", title: "训练预制已从列表移除", detail: preset.title }} />
          </div>
        )}
      />
    </div>
  );
}

function TrainingPresetCategoryRailItem({
  active,
  category,
  count,
  onSelect,
}: {
  active: boolean;
  category: string;
  count: number;
  onSelect: () => void;
}) {
  const { ref, style, handleProps } = useDemoSortable(category);

  return (
    <div ref={ref} style={style}>
      <button
        className={cx(active && s.railItemActive)}
        type="button"
        onClick={onSelect}
      >
        <GripVertical className={s.resourceRailDragHandle} aria-hidden="true" {...handleProps} />
        <span>{category}</span>
        <em>{count}</em>
      </button>
    </div>
  );
}

export function LoraTrainingPresetsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const categories = uniquePresetCategories(training.presets);
  const [orderedPresetCategories, setOrderedPresetCategories] = useState(() => categories);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [hiddenPresetIds, setHiddenPresetIds] = useState<Set<string>>(() => new Set());
  const [orderedPresetIds, setOrderedPresetIds] = useState(() => training.presets.reduce<string[]>((ids, preset) => [...ids, preset.id], []));
  const presetMap = new Map(training.presets.reduce<Array<[string, LoraTrainingPreset]>>((entries, preset) => [...entries, [preset.id, preset]], []));
  const orderedPresets = orderedPresetIds
    .map((presetId) => presetMap.get(presetId))
    .filter((preset): preset is LoraTrainingPreset => Boolean(preset));
  const categoryPresets = orderedPresets.filter((preset) => preset.category === activeCategory && !hiddenPresetIds.has(preset.id));
  const folders = uniquePresetFolders(categoryPresets);
  const visiblePresets = categoryPresets.filter((preset) => !currentFolder || preset.folder === currentFolder);
  const visiblePresetIds = visiblePresets.map((preset) => preset.id);
  const selectedCount = selectedIds.size;
  const newPresetInCategoryHref = `/training/presets/new?category=${encodeURIComponent(activeCategory)}${currentFolder ? `&folder=${encodeURIComponent(currentFolder)}` : ""}`;

  function togglePresetSelection(presetId: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(presetId);
      else next.delete(presetId);
      return next;
    });
  }

  function hidePreset(presetId: string) {
    setHiddenPresetIds((previous) => new Set(previous).add(presetId));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      next.delete(presetId);
      return next;
    });
  }

  function hideSelectedPresets() {
    setHiddenPresetIds((previous) => new Set([...previous, ...selectedIds]));
    setSelectedIds(new Set());
  }

  function handleReorderPresets(nextVisiblePresetIds: string[]) {
    const visiblePresetIdSet = new Set(visiblePresetIds);
    const reorderedVisiblePresetIds = [...nextVisiblePresetIds];
    setOrderedPresetIds((current) =>
      current.map((presetId) => visiblePresetIdSet.has(presetId) ? reorderedVisiblePresetIds.shift() ?? presetId : presetId),
    );
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练预制"
        subtitle="管理可复用的训练场景描述，导入小节时只带入场景文本。"
        actions={(
          <>
            <ButtonLink href="/training/presets/sort-rules" icon={Shuffle}>排序规则</ButtonLink>
            <ButtonLink href="/training/presets/new" icon={Plus} tone="primary">新建</ButtonLink>
          </>
        )}
      />
      <div className={s.resourceLayout}>
        <aside className={s.resourceRail}>
          <strong>分类</strong>
          <SortableList items={orderedPresetCategories} onReorder={setOrderedPresetCategories}>
            {orderedPresetCategories.map((category) => (
              <TrainingPresetCategoryRailItem
                active={activeCategory === category}
                category={category}
                count={training.presets.filter((preset) => preset.category === category && !hiddenPresetIds.has(preset.id)).length}
                key={category}
                onSelect={() => {
                  setActiveCategory(category);
                  setCurrentFolder(null);
                  setSelectedIds(new Set());
                }}
              />
            ))}
          </SortableList>
        </aside>
        <section className={s.resourceWorkspace}>
          <header className={s.trainingPresetWorkspaceHeader}>
            <div>
              <strong>{activeCategory || "训练预制"}</strong>
              <span>{categoryPresets.length} 个场景描述 · 当前文件夹 {currentFolder ?? "全部"}</span>
            </div>
            <ButtonLink href={newPresetInCategoryHref} size="sm" icon={Plus}>新建到当前分类</ButtonLink>
          </header>
          <div className={s.trainingPresetContextBar}>
            <FolderBreadcrumb
              items={currentFolder ? [{ id: currentFolder, label: currentFolder }] : []}
              onNavigate={setCurrentFolder}
              rootLabel={activeCategory || "分类"}
              size="sm"
            />
            <span>{visiblePresets.length} 个可见预制</span>
          </div>
          {selectedCount > 0 ? (
            <SelectionBatchBar
              className={s.trainingPresetBatchBar}
              selectedCount={selectedCount}
              subject="个训练预制"
              onClear={() => setSelectedIds(new Set())}
              actions={(
                <Button size="sm" tone="danger" icon={Trash2} onClick={hideSelectedPresets} feedback={{ tone: "warning", title: "训练预制已从列表移除", detail: `${selectedCount} 项` }}>
                  删除所选
                </Button>
              )}
            />
          ) : null}
          <div className={s.trainingPresetLibrarySurface}>
            {!currentFolder && folders.length > 0 ? (
              <div className={s.trainingPresetFolderGrid}>
                {folders.map((folder) => (
                  <FolderRow
                    key={folder}
                    name={folder}
                    countLabel={`${categoryPresets.filter((preset) => preset.folder === folder).length} 个预制`}
                    onOpen={() => {
                      setCurrentFolder(folder);
                      setSelectedIds(new Set());
                    }}
                  />
                ))}
              </div>
            ) : null}
            <div className={s.trainingPresetItemList}>
              <SortableList items={visiblePresetIds} onReorder={handleReorderPresets}>
                {visiblePresets.map((preset, index) => (
                  <TrainingPresetLibraryItemRow
                    index={index}
                    key={preset.id}
                    onDelete={() => hidePreset(preset.id)}
                    onToggleSelected={(checked) => togglePresetSelection(preset.id, checked)}
                    preset={preset}
                    selected={selectedIds.has(preset.id)}
                  />
                ))}
              </SortableList>
            </div>
            {visiblePresets.length === 0 ? <div className={s.emptyInline}>当前分类或文件夹没有训练预制</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function LoraTrainingPresetDetailPage({ data, mode = "edit", presetId }: { data: DemoData; mode?: "new" | "edit"; presetId?: string }) {
  const training = buildLoraTrainingDemoData(data);
  const urlSearch = useUrlSearch();
  const newPresetHints = mode === "new" ? readNewPresetHints(urlSearch) : { artifact: "", category: "", folder: "", project: "", sourceRun: "" };
  const preset = mode === "new" ? createDraftTrainingPreset(training, newPresetHints) : findPreset(data, presetId);
  if (!preset) return <EmptyPage title="没有训练预制数据" />;
  return <LoraTrainingPresetDetailContent isNew={mode === "new"} newPresetHints={newPresetHints} preset={preset} />;
}

function LoraTrainingPresetDetailContent({
  isNew,
  newPresetHints,
  preset,
}: {
  isNew: boolean;
  newPresetHints: NewPresetHints;
  preset: LoraTrainingPreset;
}) {
  const usages = [...preset.projectUsage, ...preset.templateUsage];
  const [presetForm, setPresetForm] = useState({
    category: preset.category,
    folder: preset.folder,
    sceneDescriptionText: preset.sceneDescriptionText,
    title: preset.title,
  });
  const [presetDraft, setPresetDraft] = useState<typeof presetForm & { usageCount: number } | null>(null);

  function handleUpdatePresetForm(field: keyof typeof presetForm, value: string) {
    setPresetForm((current) => ({ ...current, [field]: value }));
  }

  function handleSavePreset() {
    setPresetDraft({
      ...presetForm,
      usageCount: usages.length,
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title={isNew ? "新建训练预制" : presetForm.title}
        subtitle={isNew ? `${presetForm.category} / ${presetForm.folder} · 本地草稿` : `${presetForm.category} / ${presetForm.folder} · 更新 ${preset.updatedAt}`}
        actions={(
          <Button
            tone="primary"
            icon={Save}
            onClick={handleSavePreset}
            feedback={{ title: presetDraft ? "预制保存草稿已更新" : "预制保存草稿已记录", detail: presetForm.title }}
          >
            {presetDraft ? "更新草稿" : isNew ? "创建预制" : "保存"}
          </Button>
        )}
      />
      <WorkbenchSurface className={s.trainingPresetEditorSurface}>
        <EditorBlock
          actions={isNew ? <StatusBadge status="queued" label="草稿" /> : presetStatus(preset)}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetFormGrid}
          description="训练预制只维护一段可复用场景描述。"
          headerClassName={s.trainingPresetEditorHeader}
          title="预制内容"
        >
          <Field label="名称" value={presetForm.title} onChange={(value) => handleUpdatePresetForm("title", value)} />
          <FloatingSelect label="分类" value={presetForm.category} options={[preset.category, "光线", "环境", "构图"]} onChange={(value) => handleUpdatePresetForm("category", value)} />
          <FloatingSelect label="文件夹" value={presetForm.folder} options={[preset.folder, "舞台", "城市", "训练净图"]} onChange={(value) => handleUpdatePresetForm("folder", value)} />
          {isNew && newPresetHints.artifact ? (
            <Field readOnly label="来源训练产物" value={`${newPresetHints.project || "训练项目"} · ${newPresetHints.artifact}${newPresetHints.sourceRun ? ` · ${newPresetHints.sourceRun}` : ""}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="场景描述" value={presetForm.sceneDescriptionText} onChange={(value) => handleUpdatePresetForm("sceneDescriptionText", value)} />
        </EditorBlock>
        <EditorBlock
          actions={<StatusBadge status={usages.length ? "pending" : "ready"} label={`${usages.length} 处引用`} />}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetUsageList}
          description="删除前展示项目侧和模板侧引用，确认后只移除当前预制关联。"
          headerClassName={s.trainingPresetEditorHeader}
          title="引用影响"
        >
          {usages.map((usage) => (
            <UnitRowShell
              className={s.trainingPresetUsageRow}
              description="引用当前场景块"
              key={usage}
              meta={<StatusBadge status="template" label={usage.startsWith("模板") ? "模板" : "项目"} />}
              title={usage}
            />
          ))}
          {usages.length === 0 ? <div className={s.emptyInline}>没有引用</div> : null}
          <OperationStateStrip
            items={[
              { label: "保存", value: isNew ? "待创建" : "本地草稿", tone: isNew ? "warning" : "info" },
              { label: "删除影响", value: `${usages.length} 处`, tone: usages.length ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
        {presetDraft ? (
          <EditorBlock
            actions={<StatusBadge status="ready" label={isNew ? "待创建" : "本地草稿"} />}
            className={s.trainingPresetEditorBlock}
            description="页面内记录当前场景描述草稿，可继续调整分类、文件夹和引用影响。"
            headerClassName={s.trainingPresetEditorHeader}
            title="预制保存草稿"
          >
            <dl className={s.trainingPresetDraft}>
              <div><dt>名称</dt><dd>{presetDraft.title}</dd></div>
              <div><dt>分类</dt><dd>{presetDraft.category}</dd></div>
              <div><dt>文件夹</dt><dd>{presetDraft.folder}</dd></div>
              <div><dt>引用影响</dt><dd>{presetDraft.usageCount} 处</dd></div>
              <div className={s.trainingPresetDraftWide}><dt>场景描述</dt><dd>{presetDraft.sceneDescriptionText}</dd></div>
            </dl>
          </EditorBlock>
        ) : null}
      </WorkbenchSurface>
    </div>
  );
}

export function LoraTrainingPresetSortRulesPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const categories = [...new Set(training.presets.map((preset) => preset.category))];
  const categoryItems = categories.map((category) => ({
    id: category,
    title: category,
    meta: `${training.presets.filter((preset) => preset.category === category).length} 个预制`,
  }));
  const presetItems = training.presets.map((preset) => ({
    id: preset.id,
    title: preset.title,
    meta: `${preset.category} / ${preset.folder}`,
  }));
  const [orderedCategoryIds, setOrderedCategoryIds] = useState(() => categoryItems.map((item) => item.id));
  const [orderedPresetIds, setOrderedPresetIds] = useState(() => presetItems.map((item) => item.id));
  const [sortRulesDraft, setSortRulesDraft] = useState<{
    categoryCount: number;
    firstCategory: string;
    firstPreset: string;
    presetCount: number;
    scope: string;
  } | null>(null);
  const orderedCategoryItems = orderTrainingPresetSortItems(categoryItems, orderedCategoryIds);
  const orderedPresetItems = orderTrainingPresetSortItems(presetItems, orderedPresetIds);

  function handleSaveSortRules() {
    setSortRulesDraft({
      categoryCount: orderedCategoryIds.length,
      firstCategory: orderedCategoryItems[0]?.title ?? "无",
      firstPreset: orderedPresetItems[0]?.title ?? "无",
      presetCount: orderedPresetIds.length,
      scope: "全部排序",
    });
  }

  function handleSaveSortGroup(scope: string, ids: string[], items: TrainingPresetSortItem[]) {
    const orderedItems = orderTrainingPresetSortItems(items, ids);
    setSortRulesDraft({
      categoryCount: scope === "合成顺序" ? ids.length : orderedCategoryIds.length,
      firstCategory: scope === "合成顺序" ? orderedItems[0]?.title ?? "无" : orderedCategoryItems[0]?.title ?? "无",
      firstPreset: scope === "分类内顺序" ? orderedItems[0]?.title ?? "无" : orderedPresetItems[0]?.title ?? "无",
      presetCount: scope === "分类内顺序" ? ids.length : orderedPresetIds.length,
      scope,
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title="排序规则"
        subtitle="管理合成顺序和分类内顺序，保证导入小节时顺序稳定。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            onClick={handleSaveSortRules}
            feedback={{ title: sortRulesDraft ? "排序保存草稿已更新" : "排序保存草稿已记录", detail: sortRulesDraft?.scope ?? "全部排序" }}
          >
            {sortRulesDraft ? "更新排序草稿" : "保存全部"}
          </Button>
        )}
      />
      <div className={s.trainingPresetSortGrid}>
        <TrainingPresetSortPanel
          title="合成顺序"
          subtitle="决定训练小节导入预制块时的分类顺序。"
          items={categoryItems}
          orderedIds={orderedCategoryIds}
          onReorder={setOrderedCategoryIds}
          onSave={handleSaveSortGroup}
        />
        <TrainingPresetSortPanel
          title="分类内顺序"
          subtitle="决定同分类下训练场景描述的稳定排序。"
          items={presetItems}
          orderedIds={orderedPresetIds}
          onReorder={setOrderedPresetIds}
          onSave={handleSaveSortGroup}
        />
      </div>
      {sortRulesDraft ? (
        <EditorBlock
          actions={<StatusBadge status="ready" label={sortRulesDraft.scope} />}
          className={s.trainingPresetSortPanel}
          description="页面内记录当前排序结果，可继续调整合成顺序和分类内顺序。"
          headerClassName={s.trainingPresetSortHeader}
          title="排序保存草稿"
        >
          <dl className={s.trainingPresetSortDraft}>
            <div><dt>范围</dt><dd>{sortRulesDraft.scope}</dd></div>
            <div><dt>合成顺序</dt><dd>{sortRulesDraft.categoryCount} 项 · {sortRulesDraft.firstCategory}</dd></div>
            <div><dt>分类内顺序</dt><dd>{sortRulesDraft.presetCount} 项 · {sortRulesDraft.firstPreset}</dd></div>
          </dl>
        </EditorBlock>
      ) : null}
    </div>
  );
}

function templateStatus(template: LoraTrainingTemplate) {
  return template.status === "active" ? <StatusBadge status="ready" label="可用" /> : <StatusBadge status="archived" label="归档" />;
}

type LoraTrainingTemplateSection = LoraTrainingTemplate["sections"][number];

const TRAINING_TEMPLATE_SCROLL_KEY = "demo-training-templates-from";

function readAndClearTrainingTemplateListAnchor() {
  if (typeof window === "undefined") return undefined;
  try {
    const value = sessionStorage.getItem(TRAINING_TEMPLATE_SCROLL_KEY);
    if (!value) return undefined;
    sessionStorage.removeItem(TRAINING_TEMPLATE_SCROLL_KEY);
    return value;
  } catch {
    return undefined;
  }
}

function rememberTrainingTemplateListAnchor(templateId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TRAINING_TEMPLATE_SCROLL_KEY, templateId);
  } catch {}
}

function TrainingTemplateListItem({
  createProjectHref,
  onDelete,
  onToggleSelected,
  selected,
  template,
}: {
  createProjectHref: string;
  onDelete?: () => void;
  onToggleSelected: () => void;
  selected: boolean;
  template: LoraTrainingTemplate;
}) {
  const { ref, style, handleProps } = useDemoSortable(template.id);

  return (
    <div ref={ref} style={style}>
      <article className={cx(s.trainingTemplateListItem, selected && s.trainingTemplateListItemSelected)} data-training-template-id={template.id}>
        <div className={s.trainingTemplateListControls}>
          <Checkbox
            checked={selected}
            label={selected ? `取消选择训练模板：${template.title}` : `选择训练模板：${template.title}`}
            onCheckedChange={() => onToggleSelected()}
            stopPropagation
            variant="compact"
          />
          <button
            type="button"
            className={s.trainingTemplateListHandle}
            aria-label={`拖拽排序训练模板：${template.title}`}
            {...handleProps}
          >
            <GripVertical aria-hidden="true" />
          </button>
        </div>
        <div className={s.trainingTemplateListMain}>
          <div className={s.trainingTemplateListTitle}>
            <Link href={demoHref(`/training/templates/${template.id}/edit`)} onClick={() => rememberTrainingTemplateListAnchor(template.id)}>
              <strong>{template.title}</strong>
            </Link>
            <span>{template.description}</span>
          </div>
          <div className={s.trainingTemplateSectionSummary}>
            {template.sections.slice(0, 5).map((section, index) => (
              <Link
                href={demoHref(`/training/templates/${template.id}/sections/${index}`)}
                key={section.id}
                onClick={() => rememberTrainingTemplateListAnchor(template.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </Link>
            ))}
            {template.sections.length > 5 ? <em>+{template.sections.length - 5}</em> : null}
          </div>
        </div>
        <div className={s.trainingTemplateListMeta}>
          {templateStatus(template)}
          <StatusBadge status="template" label={`${template.sectionCount} 小节`} />
          <div className={s.trainingTemplateListActions}>
            <ButtonLink href={createProjectHref} icon={CopyPlus}>创建项目</ButtonLink>
            <ButtonLink href={`/training/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
            <Button tone="danger" icon={Trash2} onClick={onDelete} feedback={{ tone: "warning", title: "训练模板已移除", detail: template.title }}>删除</Button>
          </div>
        </div>
      </article>
    </div>
  );
}

function TemplateEditorSectionRow({
  index,
  onCopy,
  onDelete,
  section,
  templateId,
}: {
  index: number;
  onCopy?: (section: LoraTrainingTemplateSection) => void;
  onDelete?: (sectionId: string) => void;
  section: LoraTrainingTemplateSection;
  templateId: string;
}) {
  const href = `/training/templates/${templateId}/sections/${index}`;
  const { ref, style, handleProps } = useDemoSortable(section.id);

  return (
    <div ref={ref} style={style}>
      <article className={s.trainingTemplateSectionRow}>
        <button
          type="button"
          className={s.trainingTemplateSectionHandle}
          aria-label={`拖拽排序模板小节：${section.title}`}
          {...handleProps}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <Link className={s.trainingTemplateSectionMain} href={demoHref(href)}>
          <span className={s.trainingTemplateSectionTitleLine}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{section.title}</strong>
          </span>
          <p>{section.scenePreview}</p>
          <div className={s.trainingTemplateSectionMeta}>
            <span>{section.blockCount} 个场景块</span>
            <span>{section.enabled ? "启用" : "停用"}</span>
            <span>创建后独立</span>
          </div>
        </Link>
        <div className={s.trainingTemplateSectionActions}>
          <ButtonLink href={href} icon={Edit3}>编辑</ButtonLink>
          <Button tone="subtle" icon={CopyPlus} onClick={() => onCopy?.(section)} feedback={{ title: "训练模板小节已复制", detail: section.title }}>复制</Button>
          <Button tone="danger" icon={Trash2} onClick={() => onDelete?.(section.id)} feedback={{ tone: "warning", title: "训练模板小节已从草稿移除", detail: section.title }}>删除</Button>
        </div>
      </article>
    </div>
  );
}

export function LoraTrainingTemplatesPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const listRef = useRef<HTMLDivElement>(null);
  const [fromTemplateId] = useState(readAndClearTrainingTemplateListAnchor);
  const [orderedTemplateIds, setOrderedTemplateIds] = useState(() => training.templates.reduce<string[]>((ids, template) => [...ids, template.id], []));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(() => new Set());
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<string>>(() => new Set());
  const orderedTemplates = orderTrainingTemplatesByIds(training.templates, orderedTemplateIds);
  const visibleTemplates = orderedTemplates.filter((template) => !hiddenTemplateIds.has(template.id));
  const visibleTemplateIds = visibleTemplates.map((template) => template.id);
  const selectedVisibleCount = visibleTemplates.filter((template) => selectedTemplateIds.has(template.id)).length;
  const allVisibleSelected = visibleTemplates.length > 0 && selectedVisibleCount === visibleTemplates.length;
  const selectedVisibleTemplate = visibleTemplates.find((template) => selectedTemplateIds.has(template.id));
  const projectTemplateSource = selectedVisibleTemplate ?? visibleTemplates[0];

  useLayoutEffect(() => {
    if (!fromTemplateId) return;
    const target = listRef.current?.querySelector(`[data-training-template-id="${fromTemplateId}"]`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [fromTemplateId]);

  function hideTemplate(templateId: string) {
    setHiddenTemplateIds((current) => new Set(current).add(templateId));
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      next.delete(templateId);
      return next;
    });
  }

  function toggleTemplateSelection(templateId: string) {
    setSelectedTemplateIds((current) => {
      const next = new Set(current);
      if (next.has(templateId)) next.delete(templateId);
      else next.add(templateId);
      return next;
    });
  }

  function toggleVisibleTemplates() {
    setSelectedTemplateIds((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleTemplates.forEach((template) => next.delete(template.id));
        return next;
      }
      return new Set([...current, ...visibleTemplateIds]);
    });
  }

  function handleRemoveSelectedTemplates() {
    const selectedVisibleIds = new Set(visibleTemplates.filter((template) => selectedTemplateIds.has(template.id)).map((template) => template.id));
    setHiddenTemplateIds((current) => new Set([...current, ...selectedVisibleIds]));
    setSelectedTemplateIds((current) => new Set([...current].filter((id) => !selectedVisibleIds.has(id))));
  }

  function handleReorderTemplates(nextVisibleIds: string[]) {
    const visibleTemplateIdSet = new Set(visibleTemplateIds);
    const reorderedVisibleIds = [...nextVisibleIds];
    setOrderedTemplateIds((current) =>
      current.map((templateId) => visibleTemplateIdSet.has(templateId) ? reorderedVisibleIds.shift() ?? templateId : templateId),
    );
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练模板"
        subtitle="模板提供创建训练项目时的初始小节结构；项目创建后会独立编辑。"
        actions={(
          <>
            {projectTemplateSource ? (
              <ButtonLink href={createProjectFromTemplateHref(projectTemplateSource)} icon={CopyPlus}>从模板创建项目</ButtonLink>
            ) : null}
            <ButtonLink href="/training/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>
          </>
        )}
      />
      <div className={s.trainingTemplateListToolbar}>
        <div>
          <strong>模板列表</strong>
          <span>{visibleTemplates.length} 个模板{selectedVisibleCount ? ` · 已选 ${selectedVisibleCount}` : ""}</span>
        </div>
        <Button icon={CheckSquare} onClick={toggleVisibleTemplates} disabled={visibleTemplates.length === 0}>
          {allVisibleSelected ? "取消全选" : "全选"}
        </Button>
      </div>
      {selectedVisibleCount > 0 ? (
        <SelectionBatchBar
          className={s.trainingTemplateBatchBar}
          selectedCount={selectedVisibleCount}
          subject="个训练模板"
          onClear={() => setSelectedTemplateIds(new Set())}
          actions={(
            <Button tone="danger" icon={Trash2} onClick={handleRemoveSelectedTemplates} feedback={{ tone: "warning", title: "训练模板已从列表移除", detail: `${selectedVisibleCount} 个训练模板` }}>
              删除所选
            </Button>
          )}
        />
      ) : null}
      <div className={s.trainingTemplateList} ref={listRef}>
        <SortableList items={visibleTemplateIds} onReorder={handleReorderTemplates}>
          {visibleTemplates.map((template) => (
            <TrainingTemplateListItem
              createProjectHref={createProjectFromTemplateHref(template)}
              key={template.id}
              onDelete={() => hideTemplate(template.id)}
              onToggleSelected={() => toggleTemplateSelection(template.id)}
              selected={selectedTemplateIds.has(template.id)}
              template={template}
            />
          ))}
        </SortableList>
        {visibleTemplates.length === 0 ? (
          <div className={s.emptyInline}>
            <strong>暂无训练模板</strong>
            <span>当前本地视图里的模板都已移除，可通过新建模板重新开始。</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LoraTrainingTemplateFormPage({ data, mode, templateId }: { data: DemoData; mode: "new" | "edit"; templateId?: string }) {
  const training = buildLoraTrainingDemoData(data);
  const urlSearch = useUrlSearch();
  const newTemplateHints = mode === "new" ? readNewTemplateHints(urlSearch) : { projectId: "", sections: "", sourceProject: "" };
  const template = mode === "edit" ? findTemplate(data, templateId) : undefined;
  const seedTemplate = template ?? training.templates[0];
  const title = mode === "new" ? "新建训练模板" : template?.title ?? "训练模板";
  const templateEditorId = seedTemplate?.id ?? "new-template";
  const [localTemplateSections, setLocalTemplateSections] = useState<LoraTrainingTemplateSection[]>(() => seedTemplate?.sections ?? []);
  const [orderedTemplateSectionIds, setOrderedTemplateSectionIds] = useState(() => (seedTemplate?.sections ?? []).map((section) => section.id));
  const templateSections = localTemplateSections;
  const templateSectionMap = Object.fromEntries(templateSections.map((section) => [section.id, section]));
  const [templateForm, setTemplateForm] = useState({
    captionGuidance: "先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。",
    description: seedTemplate?.description ?? "用于新角色 LoRA 训练项目的起始模板。",
    imageGuidance: "每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。",
    title: newTemplateHints.sourceProject ? `${newTemplateHints.sourceProject} 训练模板` : seedTemplate?.title ?? "新角色 LoRA 模板",
  });
  const [templateDraft, setTemplateDraft] = useState<typeof templateForm & { mode: "new" | "edit"; sectionCount: number; sourceProject: string } | null>(null);

  function handleUpdateTemplateForm(field: keyof typeof templateForm, value: string) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  function handleSaveTemplate() {
    setTemplateDraft({
      ...templateForm,
      mode,
      sectionCount: templateSections.length,
      sourceProject: newTemplateHints.sourceProject,
    });
  }

  function createDraftTemplateSection(current: LoraTrainingTemplateSection[], titleSuffix: string): LoraTrainingTemplateSection {
    const source = current[0];
    const draftIndex = current.length + 1;
    return source ? {
      ...source,
      id: `new-template-section-${Date.now()}`,
      title: `新模板小节 ${draftIndex}${titleSuffix}`,
      enabled: true,
      scenePreview: "补充这个模板小节的训练场景摘要。",
    } : {
      id: `new-template-section-${Date.now()}`,
      title: `新模板小节 ${draftIndex}${titleSuffix}`,
      enabled: true,
      blockCount: 1,
      blocks: [
        { id: "draft-template-block", source: "本地", title: "本地场景描述", text: "补充这个模板小节的训练场景描述。" },
      ],
      resolvedScene: "补充这个模板小节的训练场景描述。",
      scenePreview: "补充这个模板小节的训练场景摘要。",
    };
  }

  function handleAddTemplateSection() {
    setLocalTemplateSections((current) => {
      const draft = createDraftTemplateSection(current, "");
      setOrderedTemplateSectionIds((ids) => [...ids, draft.id]);
      return [...current, draft];
    });
  }

  function handleCopyTemplateSection(section: LoraTrainingTemplateSection) {
    const copy: LoraTrainingTemplateSection = {
      ...section,
      id: `${section.id}-copy-${Date.now()}`,
      title: `${section.title} (副本)`,
    };
    setLocalTemplateSections((current) => [...current, copy]);
    setOrderedTemplateSectionIds((ids) => [...ids, copy.id]);
  }

  function handleDeleteTemplateSection(sectionId: string) {
    setLocalTemplateSections((current) => current.filter((section) => section.id !== sectionId));
    setOrderedTemplateSectionIds((ids) => ids.filter((id) => id !== sectionId));
  }

  function handleReorderTemplateSections(nextIds: string[]) {
    setOrderedTemplateSectionIds(nextIds);
    setLocalTemplateSections((current) => orderTemplateSectionsByIds(current, nextIds));
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/templates", label: "返回训练模板" }}
        eyebrow="训练模板"
        title={title}
        subtitle="编辑项目指引、小节设置、预制块和本地块。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            onClick={handleSaveTemplate}
            feedback={{ title: templateDraft ? "模板保存草稿已更新" : "模板保存草稿已记录", detail: templateForm.title }}
          >
            {templateDraft ? "更新草稿" : mode === "new" ? "创建模板" : "保存模板"}
          </Button>
        )}
      />
      <WorkbenchSurface className={s.trainingTemplateEditorSurface}>
        <EditorBlock
          actions={<StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />}
          className={s.trainingTemplateEditorBlock}
          contentClassName={s.trainingTemplateFormGrid}
          description="模板只提供创建训练项目时的初始结构，创建后项目会独立编辑。"
          headerClassName={s.trainingTemplateEditorHeader}
          title="模板信息"
        >
          <Field label="名称" value={templateForm.title} onChange={(value) => handleUpdateTemplateForm("title", value)} />
          <Field multiline features={{ resize: true, clipboard: true }} label="描述" value={templateForm.description} onChange={(value) => handleUpdateTemplateForm("description", value)} />
          {mode === "new" && newTemplateHints.sourceProject ? (
            <Field readOnly label="来源训练项目" value={`${newTemplateHints.sourceProject}${newTemplateHints.sections ? ` · ${newTemplateHints.sections} 个小节` : ""}${newTemplateHints.projectId ? ` · ${newTemplateHints.projectId}` : ""}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="图片提示词指引" value={templateForm.imageGuidance} onChange={(value) => handleUpdateTemplateForm("imageGuidance", value)} />
          <Field multiline features={{ resize: true, clipboard: true }} label="说明文本生成指引" value={templateForm.captionGuidance} onChange={(value) => handleUpdateTemplateForm("captionGuidance", value)} />
        </EditorBlock>
        <EditorBlock
          actions={<Button icon={Plus} onClick={handleAddTemplateSection} feedback="小节草稿已添加">添加小节</Button>}
          className={s.trainingTemplateEditorBlock}
          contentClassName={s.trainingTemplateSectionBlockContent}
          description="排序、编辑、复制、删除；每个小节包含预制块与本地块。"
          headerClassName={s.trainingTemplateEditorHeader}
          title="小节配置"
        >
          <div className={s.trainingTemplateSectionList}>
            <SortableList items={orderedTemplateSectionIds} onReorder={handleReorderTemplateSections}>
              {orderedTemplateSectionIds.map((sectionId, index) => {
                const section = templateSectionMap[sectionId];
                if (!section) return null;

                return (
                  <TemplateEditorSectionRow
                    index={index}
                    key={section.id}
                    onCopy={handleCopyTemplateSection}
                    onDelete={handleDeleteTemplateSection}
                    section={section}
                    templateId={templateEditorId}
                  />
                );
              })}
            </SortableList>
          </div>
          <OperationStateStrip
            items={[
              { label: "排序", value: "拖拽释放后保存", tone: "info" },
              { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
        {templateDraft ? (
          <EditorBlock
            actions={<StatusBadge status="ready" label={templateDraft.mode === "new" ? "待创建" : "本地草稿"} />}
            className={s.trainingTemplateEditorBlock}
            description="页面内记录当前模板草稿，可继续调整字段和小节列表。"
            headerClassName={s.trainingTemplateEditorHeader}
            title="模板保存草稿"
          >
            <dl className={s.trainingTemplateDraft}>
              <div><dt>名称</dt><dd>{templateDraft.title}</dd></div>
              <div><dt>小节</dt><dd>{templateDraft.sectionCount} 个</dd></div>
              <div><dt>来源项目</dt><dd>{templateDraft.sourceProject || "无"}</dd></div>
              <div><dt>描述</dt><dd>{templateDraft.description}</dd></div>
              <div className={s.trainingTemplateDraftWide}><dt>图片提示词指引</dt><dd>{templateDraft.imageGuidance}</dd></div>
              <div className={s.trainingTemplateDraftWide}><dt>说明文本指引</dt><dd>{templateDraft.captionGuidance}</dd></div>
            </dl>
          </EditorBlock>
        ) : null}
      </WorkbenchSurface>
    </div>
  );
}

export function LoraTrainingTemplateSectionPage({ data, templateId, sectionIndex }: { data: DemoData; templateId?: string; sectionIndex?: string }) {
  const training = buildLoraTrainingDemoData(data);
  const template = findTemplate(data, templateId);
  const index = Number(sectionIndex ?? "0");
  const section = template?.sections[Number.isFinite(index) ? index : 0] ?? template?.sections[0];
  const [sceneBlockState, setSceneBlocks] = useState(() => ({
    blocks: section?.blocks ?? [],
    sectionId: section?.id ?? null,
  }));
  const [templateSectionFormState, setTemplateSectionForm] = useState(() => ({
    enabledLabel: section?.enabled ? "启用" : "停用",
    sectionId: section?.id ?? null,
    templateId: template?.id ?? null,
    title: section?.title ?? "",
  }));
  const [editingTemplateBlockId, setEditingTemplateBlockId] = useState<string | null>(null);
  const [templateSectionDraft, setTemplateSectionDraft] = useState<{
    blockCount: number;
    enabledLabel: string;
    firstBlock: string;
    resolvedScene: string;
    sectionTitle: string;
    templateTitle: string;
  } | null>(null);
  const sceneBlocks = sceneBlockState.sectionId === section?.id ? sceneBlockState.blocks : section?.blocks ?? [];
  if (!template || !section) return <EmptyPage title="没有模板小节数据" />;

  const activeTemplate = template;
  const activeSection = section;
  const templateSectionForm = templateSectionFormState.templateId === activeTemplate.id && templateSectionFormState.sectionId === activeSection.id ? templateSectionFormState : {
    enabledLabel: activeSection.enabled ? "启用" : "停用",
    sectionId: activeSection.id,
    templateId: activeTemplate.id,
    title: activeSection.title,
  };
  const importedPreset = training.presets[0];
  const resolvedTemplateScene = sceneBlocks.map((block) => block.text).join("\n\n");

  function handleUpdateTemplateSectionForm(field: "enabledLabel" | "title", value: string) {
    setTemplateSectionForm((current) => {
      const active = current.templateId === activeTemplate.id && current.sectionId === activeSection.id ? current : templateSectionForm;
      return {
        ...active,
        [field]: value,
        sectionId: activeSection.id,
        templateId: activeTemplate.id,
      };
    });
  }

  function updateTemplateBlocks(updater: (current: LoraTrainingSectionBlock[]) => LoraTrainingSectionBlock[]) {
    setSceneBlocks((current) => ({
      blocks: updater(current.sectionId === activeSection.id ? current.blocks : activeSection.blocks),
      sectionId: activeSection.id,
    }));
  }

  function handleAddLocalTemplateBlock() {
    updateTemplateBlocks((current) => [
      ...current,
      {
        id: `${activeSection.id}-template-local-block-${current.length + 1}`,
        source: "本地",
        title: `模板补充块 ${current.length + 1}`,
        text: "补充模板导入后默认带入的场景描述。",
      },
    ]);
  }

  function handleImportTemplatePresetBlock() {
    if (!importedPreset) return;
    updateTemplateBlocks((current) => [
      ...current,
      {
        id: `${activeSection.id}-template-preset-block-${importedPreset.id}-${current.length + 1}`,
        source: "预制",
        title: importedPreset.title,
        text: importedPreset.sceneDescriptionText,
      },
    ]);
  }

  function handleMoveTemplateBlock(index: number, direction: -1 | 1) {
    updateTemplateBlocks((current) => moveTemplateBlock(current, index, direction));
  }

  function handleUpdateTemplateBlock(blockId: string, patch: TemplateSceneBlockPatch) {
    updateTemplateBlocks((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)));
  }

  function handleDeleteTemplateBlock(blockId: string) {
    if (editingTemplateBlockId === blockId) setEditingTemplateBlockId(null);
    updateTemplateBlocks((current) => current.filter((block) => block.id !== blockId));
  }

  function handleSaveTemplateSection() {
    setTemplateSectionDraft({
      blockCount: sceneBlocks.length,
      enabledLabel: templateSectionForm.enabledLabel,
      firstBlock: sceneBlocks[0]?.title ?? "无场景块",
      resolvedScene: resolvedTemplateScene || section.resolvedScene,
      sectionTitle: templateSectionForm.title,
      templateTitle: activeTemplate.title,
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/training/templates/${activeTemplate.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${activeTemplate.title} / ${templateSectionForm.title}`}
        subtitle="模板小节与项目小节保持相同的场景块编辑心智。"
        actions={(
          <Button
            tone="primary"
            icon={Save}
            onClick={handleSaveTemplateSection}
            feedback={{ title: templateSectionDraft ? "模板小节保存草稿已更新" : "模板小节保存草稿已记录", detail: templateSectionForm.title }}
          >
            {templateSectionDraft ? "更新小节草稿" : "保存小节"}
          </Button>
        )}
      />
      <div className={s.twoCol}>
        <Panel title="运行参数">
          <div className={s.stack}>
            <Field label="小节名" value={templateSectionForm.title} onChange={(value) => handleUpdateTemplateSectionForm("title", value)} />
            <FloatingSelect label="启用状态" value={templateSectionForm.enabledLabel} options={["启用", "停用"]} onChange={(value) => handleUpdateTemplateSectionForm("enabledLabel", value)} />
            <Field readOnly label="场景块数量" value={`${sceneBlocks.length}`} />
          </div>
        </Panel>
        <Panel
          title="场景块"
          subtitle="模板导入项目时会复制这些块；预制块保持引用，本地块复制文本。"
          actions={(
            <>
              <Button
                size="sm"
                icon={CopyPlus}
                disabled={!importedPreset}
                onClick={handleImportTemplatePresetBlock}
                feedback={{ title: "预制已导入模板块", detail: importedPreset?.title ?? section.title }}
              >
                导入预制
              </Button>
              <Button size="sm" icon={Plus} onClick={handleAddLocalTemplateBlock} feedback={{ title: "模板本地块已添加", detail: templateSectionForm.title }}>添加本地块</Button>
            </>
          )}
        >
          <div className={s.templateSceneBlockList}>
            {sceneBlocks.map((block, blockIndex) => (
              <TemplateSceneBlockCard
                block={block}
                index={blockIndex}
                isEditing={editingTemplateBlockId === block.id}
                key={block.id}
                onDelete={handleDeleteTemplateBlock}
                onEdit={setEditingTemplateBlockId}
                onMove={handleMoveTemplateBlock}
                onUpdate={handleUpdateTemplateBlock}
                total={sceneBlocks.length}
              />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="合成预览" subtitle="模板小节保存的是可读业务文案，导入项目后仍可继续改。">
        <div className={s.templateResolvedPreview}>
          <Field readOnly multiline features={{ clipboard: true }} label="合成场景描述" value={resolvedTemplateScene || section.resolvedScene} />
          <Field readOnly multiline features={{ clipboard: true }} label="小节摘要" value={section.scenePreview} />
        </div>
      </Panel>
      {templateSectionDraft ? (
        <Panel title="模板小节保存草稿" subtitle="页面内记录当前小节、场景块和合成场景描述。">
          <dl className={s.trainingTemplateSectionDraft}>
            <div><dt>模板</dt><dd>{templateSectionDraft.templateTitle}</dd></div>
            <div><dt>小节</dt><dd>{templateSectionDraft.sectionTitle}</dd></div>
            <div><dt>状态</dt><dd>{templateSectionDraft.enabledLabel}</dd></div>
            <div><dt>场景块</dt><dd>{templateSectionDraft.blockCount} 个 · {templateSectionDraft.firstBlock}</dd></div>
            <div className={s.trainingTemplateDraftWide}><dt>合成场景</dt><dd>{templateSectionDraft.resolvedScene}</dd></div>
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}

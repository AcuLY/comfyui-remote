"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Edit3, GripVertical, Plus, Save, Shuffle, Trash2 } from "lucide-react";

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
import { EditorBlock, FolderBreadcrumb, FolderRow, SelectionBatchBar, SortableRowShell, UnitRowShell, WorkbenchSurface } from "../../shared/patterns";
import { buildLoraTrainingDemoData } from "./fixtures";
import type { LoraTrainingPreset, LoraTrainingSectionBlock, LoraTrainingTemplate } from "./types";
import s from "./training-resource-pages.module.css";

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
      ? `从 ${hints.project || "训练项目"} 的训练产物 ${hints.artifact} 创建，补充后作为可复用 scene description 导入训练小节。`
      : "在这里补充可复用的 scene description，只描述训练小节需要导入的场景文本。",
    projectUsage: [],
    templateUsage: [],
  };
}

function TrainingPresetSortPanel({
  items,
  subtitle,
  title,
}: {
  items: Array<{ id: string; meta: string; title: string }>;
  subtitle: string;
  title: string;
}) {
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
        {items.map((item, index) => (
          <SortableRowShell
            className={s.trainingPresetSortRow}
            contentClassName={s.trainingPresetSortRowContent}
            handleClassName={s.grip}
            index={index}
            indexClassName={s.trainingPresetSortIndex}
            key={item.id}
          >
            <div className={s.trainingPresetSortRowText}>
              <strong>{item.title}</strong>
              <em>{item.meta}</em>
            </div>
          </SortableRowShell>
        ))}
      </div>
      <div className={s.trainingPresetSortFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} feedback={{ title: `${title} 排序已保存` }}>保存此组</Button>
      </div>
    </section>
  );
}

function TemplateSceneBlockCard({
  block,
  index,
  onDelete,
  onMove,
  total,
}: {
  block: LoraTrainingSectionBlock;
  index: number;
  onDelete?: (blockId: string) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  total: number;
}) {
  return (
    <article className={s.templateSceneBlockCard}>
      <div className={s.templateSceneBlockBody}>
        <span>{block.source === "预制" ? "预制块" : "本地块"}</span>
        <strong>{block.title}</strong>
        <p>{block.text}</p>
      </div>
      <div className={s.templateSceneBlockActions} aria-label={`${block.title} 操作`}>
        <Button size="sm" icon={Edit3} ariaLabel={`编辑模板场景块：${block.title}`} feedback={{ title: "编辑模板场景块入口已预览", detail: block.title }}>编辑</Button>
        <Button size="sm" icon={ArrowUp} disabled={index === 0} onClick={() => onMove?.(index, -1)} ariaLabel={`上移模板场景块：${block.title}`} feedback={{ title: "模板块已上移", detail: block.title }}>上移</Button>
        <Button size="sm" icon={ArrowDown} disabled={index === total - 1} onClick={() => onMove?.(index, 1)} ariaLabel={`下移模板场景块：${block.title}`} feedback={{ title: "模板块已下移", detail: block.title }}>下移</Button>
        <Button size="sm" icon={Trash2} tone="danger" onClick={() => onDelete?.(block.id)} ariaLabel={`删除模板场景块：${block.title}`} feedback={{ tone: "warning", title: "模板块已从草稿移除", detail: block.title }}>删除</Button>
      </div>
    </article>
  );
}

export function LoraTrainingPresetsPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);
  const categories = uniquePresetCategories(training.presets);
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [hiddenPresetIds, setHiddenPresetIds] = useState<Set<string>>(() => new Set());
  const categoryPresets = training.presets.filter((preset) => preset.category === activeCategory && !hiddenPresetIds.has(preset.id));
  const folders = uniquePresetFolders(categoryPresets);
  const visiblePresets = categoryPresets.filter((preset) => !currentFolder || preset.folder === currentFolder);
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

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练预制"
        subtitle="训练预制只是一段 scene description，不包含普通预设库的 variants / positive / negative / LoRA 结构。"
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
          {categories.map((category) => (
            <button
              className={cx(activeCategory === category && s.railItemActive)}
              type="button"
              key={category}
              onClick={() => {
                setActiveCategory(category);
                setCurrentFolder(null);
                setSelectedIds(new Set());
              }}
            >
              <span>{category}</span>
              <em>{training.presets.filter((preset) => preset.category === category && !hiddenPresetIds.has(preset.id)).length}</em>
            </button>
          ))}
        </aside>
        <section className={s.resourceWorkspace}>
          <header className={s.trainingPresetWorkspaceHeader}>
            <div>
              <strong>{activeCategory || "训练预制"}</strong>
              <span>{categoryPresets.length} 个 scene description · 当前文件夹 {currentFolder ?? "全部"}</span>
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
                <Button size="sm" tone="danger" icon={Trash2} onClick={hideSelectedPresets} feedback={{ tone: "warning", title: "批量删除训练预制需要确认", detail: `${selectedCount} 项` }}>
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
              {visiblePresets.map((preset, index) => {
                const selected = selectedIds.has(preset.id);

                return (
                  <UnitRowShell
                    key={preset.id}
                    className={s.trainingPresetItemFrame}
                    selected={selected}
                    dragHandle={<GripVertical className={s.grip} aria-hidden="true" />}
                    leading={(
                      <Checkbox
                        checked={selected}
                        label={`选择训练预制：${preset.title}`}
                        onCheckedChange={(checked) => togglePresetSelection(preset.id, checked)}
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
                        <Button size="sm" tone="danger" icon={Trash2} iconOnly ariaLabel={`删除训练预制：${preset.title}`} onClick={() => hidePreset(preset.id)} feedback={{ tone: "warning", title: "删除训练预制需要确认", detail: preset.title }} />
                      </div>
                    )}
                  />
                );
              })}
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
  const usages = [...preset.projectUsage, ...preset.templateUsage];
  const isNew = mode === "new";

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title={isNew ? "新建训练预制" : preset.title}
        subtitle={isNew ? `${preset.category} / ${preset.folder} · 本地草稿` : `${preset.category} / ${preset.folder} · 更新 ${preset.updatedAt}`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: isNew ? "训练预制已创建" : "训练预制已保存", detail: preset.title }}>{isNew ? "创建预制" : "保存"}</Button>}
      />
      <WorkbenchSurface className={s.trainingPresetEditorSurface}>
        <EditorBlock
          actions={isNew ? <StatusBadge status="queued" label="草稿" /> : presetStatus(preset)}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetFormGrid}
          description="训练预制只维护一段可复用 scene description。"
          headerClassName={s.trainingPresetEditorHeader}
          title="预制内容"
        >
          <Field label="名称" value={preset.title} />
          <FloatingSelect label="分类" value={preset.category} options={[preset.category, "光线", "环境", "构图"]} />
          <FloatingSelect label="文件夹" value={preset.folder} options={[preset.folder, "舞台", "城市", "训练净图"]} />
          {isNew && newPresetHints.artifact ? (
            <Field readOnly label="来源训练产物" value={`${newPresetHints.project || "训练项目"} · ${newPresetHints.artifact}${newPresetHints.sourceRun ? ` · ${newPresetHints.sourceRun}` : ""}`} />
          ) : null}
          <Field multiline features={{ resize: true, clipboard: true }} label="场景描述" value={preset.sceneDescriptionText} />
        </EditorBlock>
        <EditorBlock
          actions={<StatusBadge status={usages.length ? "pending" : "ready"} label={`${usages.length} 处引用`} />}
          className={s.trainingPresetEditorBlock}
          contentClassName={s.trainingPresetUsageList}
          description="删除前展示项目侧和模板侧引用，确认后只移除 mutable refs。"
          headerClassName={s.trainingPresetEditorHeader}
          title="引用影响"
        >
          {usages.map((usage) => (
            <UnitRowShell
              className={s.trainingPresetUsageRow}
              description="引用当前 scene block"
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

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/presets", label: "返回训练预制" }}
        eyebrow="训练预制"
        title="排序规则"
        subtitle="管理合成顺序和分类内顺序；训练预制没有普通预设库的正反向维度。"
        actions={<Button tone="primary" icon={Save} feedback="排序规则已保存">保存全部</Button>}
      />
      <div className={s.trainingPresetSortGrid}>
        <TrainingPresetSortPanel title="合成顺序" subtitle="决定训练小节导入预制块时的分类顺序。" items={categoryItems} />
        <TrainingPresetSortPanel title="分类内顺序" subtitle="决定同分类下 scene description 的稳定排序。" items={presetItems} />
      </div>
    </div>
  );
}

function templateStatus(template: LoraTrainingTemplate) {
  return template.status === "active" ? <StatusBadge status="ready" label="可用" /> : <StatusBadge status="archived" label="归档" />;
}

type LoraTrainingTemplateSection = LoraTrainingTemplate["sections"][number];

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

  return (
    <article className={s.trainingTemplateSectionRow}>
      <Button className={s.trainingTemplateSectionHandle} icon={GripVertical} iconOnly tone="subtle" ariaLabel={`拖拽排序模板小节：${section.title}`} />
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
        <Button tone="danger" icon={Trash2} onClick={() => onDelete?.(section.id)} feedback={{ tone: "warning", title: "删除训练模板小节需要确认", detail: section.title }}>删除</Button>
      </div>
    </article>
  );
}

export function LoraTrainingTemplatesPage({ data }: { data: DemoData }) {
  const training = buildLoraTrainingDemoData(data);

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="LoRA 训练"
        title="训练模板"
        subtitle="模板是创建训练项目的一次性 seed；创建项目后不会 live 回写模板。"
        actions={(
          <>
            <ButtonLink href="/training/projects/new" icon={CopyPlus}>从模板创建项目</ButtonLink>
            <ButtonLink href="/training/templates/new" tone="primary" icon={Plus}>新建模板</ButtonLink>
          </>
        )}
      />
      <div className={s.resourceGrid}>
        {training.templates.map((template) => (
          <article className={s.templateRow} key={template.id}>
            <div>
              <Link href={demoHref(`/training/templates/${template.id}/edit`)}>
                <strong>{template.title}</strong>
              </Link>
              <span>{template.description}</span>
              <div className={s.templateSections}>
                {template.sections.map((section, index) => (
                  <Link href={demoHref(`/training/templates/${template.id}/sections/${index}`)} key={section.id}>
                    {String(index + 1).padStart(2, "0")} · {section.title}
                  </Link>
                ))}
              </div>
            </div>
            <div className={s.templateMeta}>
              {templateStatus(template)}
              <StatusBadge status="template" label={`${template.sectionCount} 小节`} />
              <ButtonLink href={`/training/templates/${template.id}/edit`} icon={Edit3}>编辑</ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function LoraTrainingTemplateFormPage({ data, mode, templateId }: { data: DemoData; mode: "new" | "edit"; templateId?: string }) {
  const training = buildLoraTrainingDemoData(data);
  const template = mode === "edit" ? findTemplate(data, templateId) : undefined;
  const seedTemplate = template ?? training.templates[0];
  const title = mode === "new" ? "新建训练模板" : template?.title ?? "训练模板";
  const templateEditorId = seedTemplate?.id ?? "new-template";
  const [localTemplateSections, setLocalTemplateSections] = useState<LoraTrainingTemplateSection[]>(() => seedTemplate?.sections ?? []);
  const templateSections = localTemplateSections;

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
    setLocalTemplateSections((current) => [...current, createDraftTemplateSection(current, "")]);
  }

  function handleCopyTemplateSection(section: LoraTrainingTemplateSection) {
    const copy: LoraTrainingTemplateSection = {
      ...section,
      id: `${section.id}-copy-${Date.now()}`,
      title: `${section.title} (副本)`,
    };
    setLocalTemplateSections((current) => [...current, copy]);
  }

  function handleDeleteTemplateSection(sectionId: string) {
    setLocalTemplateSections((current) => current.filter((section) => section.id !== sectionId));
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/training/templates", label: "返回训练模板" }}
        eyebrow="训练模板"
        title={title}
        subtitle="编辑 project-level guidance、section settings、preset/local blocks。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: mode === "new" ? "训练模板已创建" : "训练模板已保存" }}>{mode === "new" ? "创建模板" : "保存模板"}</Button>}
      />
      <WorkbenchSurface className={s.trainingTemplateEditorSurface}>
        <EditorBlock
          actions={<StatusBadge status={mode === "new" ? "queued" : "ready"} label={mode === "new" ? "草稿" : "已保存"} />}
          className={s.trainingTemplateEditorBlock}
          contentClassName={s.trainingTemplateFormGrid}
          description="模板只作为创建训练项目时的 seed，创建后项目不会 live 回写模板。"
          headerClassName={s.trainingTemplateEditorHeader}
          title="模板信息"
        >
          <Field label="名称" value={seedTemplate?.title ?? "新角色 LoRA 模板"} />
          <Field multiline features={{ resize: true, clipboard: true }} label="描述" value={seedTemplate?.description ?? "用于新角色 LoRA 训练项目的起始模板。"} />
          <Field multiline features={{ resize: true, clipboard: true }} label="图片提示词指引" value="每次生成 1 张干净训练图，优先保证角色身份稳定、轮廓清晰。" />
          <Field multiline features={{ resize: true, clipboard: true }} label="Caption 生成指引" value="先写 LoRA 触发词，再补充姿态、服装、光线、镜头和背景。" />
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
            {templateSections.map((section, index) => (
              <TemplateEditorSectionRow
                index={index}
                key={section.id}
                onCopy={handleCopyTemplateSection}
                onDelete={handleDeleteTemplateSection}
                section={section}
                templateId={templateEditorId}
              />
            ))}
          </div>
          <OperationStateStrip
            items={[
              { label: "排序", value: "拖拽释放后保存", tone: "info" },
              { label: "保存队列", value: mode === "new" ? "待创建" : "空", tone: mode === "new" ? "warning" : "success" },
              { label: "校验", value: "通过", tone: "success" },
            ]}
          />
        </EditorBlock>
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
  const sceneBlocks = sceneBlockState.sectionId === section?.id ? sceneBlockState.blocks : section?.blocks ?? [];
  if (!template || !section) return <EmptyPage title="没有模板小节数据" />;

  const activeSection = section;
  const importedPreset = training.presets[0];
  const resolvedTemplateScene = sceneBlocks.map((block) => block.text).join("\n\n");

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

  function handleDeleteTemplateBlock(blockId: string) {
    updateTemplateBlocks((current) => current.filter((block) => block.id !== blockId));
  }

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/training/templates/${template.id}/edit`, label: "返回模板" }}
        eyebrow="模板小节"
        title={`${template.title} / ${section.title}`}
        subtitle="模板小节与项目小节保持相同的场景块编辑心智。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "模板小节已保存", detail: section.title }}>保存小节</Button>}
      />
      <div className={s.twoCol}>
        <Panel title="运行参数">
          <div className={s.stack}>
            <Field label="小节名" value={section.title} />
            <FloatingSelect label="启用状态" value={section.enabled ? "启用" : "停用"} options={["启用", "停用"]} />
            <Field label="场景块数量" value={`${sceneBlocks.length}`} />
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
              <Button size="sm" icon={Plus} onClick={handleAddLocalTemplateBlock} feedback={{ title: "模板本地块已添加", detail: section.title }}>添加本地块</Button>
            </>
          )}
        >
          <div className={s.templateSceneBlockList}>
            {sceneBlocks.map((block, blockIndex) => (
              <TemplateSceneBlockCard
                block={block}
                index={blockIndex}
                key={block.id}
                onDelete={handleDeleteTemplateBlock}
                onMove={handleMoveTemplateBlock}
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
    </div>
  );
}

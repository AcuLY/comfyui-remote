"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckSquare, Edit3, FolderTree, GripVertical, History, Plus, Save, Search, Shuffle, Square, Trash2, X } from "lucide-react";

import type { DemoCategory, DemoData, DemoPreset, DemoPresetGroup } from "./design-demo-data";
import s from "./design-demo.module.css";
import { Button } from "./ui/button";
import { ButtonLink } from "./ui/button-link";
import { EmptyPage } from "./ui/empty-page";
import { Field } from "./ui/field";
import { OperationStateStrip } from "./ui/operation-state-strip";
import { PageHeader } from "./ui/page-header";
import { SelectLike } from "./ui/select-like";
import { StatusBadge } from "./ui/status-badge";
import { TextAreaField } from "./ui/text-area-field";
import { categoryColorValue, categoryHueValue, categoryItemCount, categorySlotPreview, categoryTypeLabel, cx, demoHref, firstCategory, presetFolderBreadcrumb, presetFolderChildren, presetFolderItemCount, presetFolderOptions, presetLibraryItems } from "./design-demo-utils";
import type { DemoButtonFeedback, PresetLibraryItem, SortRuleDimensionKey } from "./design-demo-utils";
function PresetMoveSheet({
  category,
  confirmFeedback,
  onCancel,
  onConfirm,
  onSelect,
  selectedCount,
  selectedFolderId,
}: {
  category: DemoCategory;
  confirmFeedback?: DemoButtonFeedback;
  onCancel: () => void;
  onConfirm: () => void;
  onSelect: (folderId: string | null) => void;
  selectedCount: number;
  selectedFolderId: string | null;
}) {
  const options = presetFolderOptions(category);
  const breadcrumb = presetFolderBreadcrumb(category, selectedFolderId);

  return (
    <div className={s.presetMoveBackdrop} role="presentation" onClick={onCancel}>
      <section className={s.presetMoveSheet} role="dialog" aria-modal="true" aria-label="选择移动文件夹" onClick={(event) => event.stopPropagation()}>
        <header className={s.presetMoveHeader}>
          <div>
            <span>批量移动</span>
            <h2>{selectedCount} 个{categoryTypeLabel(category)}条目</h2>
          </div>
          <button className={s.iconButton} type="button" onClick={onCancel} aria-label="关闭">
            <X className={s.iconMd} />
          </button>
        </header>
        <div className={s.presetMoveBreadcrumbs}>
          <button type="button" onClick={() => onSelect(null)}>根目录</button>
          {breadcrumb.map((folder) => (
            <button type="button" key={folder.id} onClick={() => onSelect(folder.id)}>
              {folder.name}
            </button>
          ))}
        </div>
        <div className={s.presetMoveTargets}>
          {options.map((option) => (
            <button
              className={cx(s.presetMoveTarget, selectedFolderId === option.id && s.presetMoveTargetActive)}
              type="button"
              key={option.id ?? "root"}
              onClick={() => onSelect(option.id)}
            >
              <FolderTree className={s.iconMd} />
              <strong style={{ paddingLeft: `${option.depth * 8}px` }}>{option.name}</strong>
              <span>{option.count} 项</span>
            </button>
          ))}
        </div>
        <footer className={s.presetMoveFooter}>
          <span>目标：{breadcrumb[breadcrumb.length - 1]?.name ?? "根目录"}</span>
          <Button tone="primary" icon={FolderTree} onClick={onConfirm} feedback={confirmFeedback}>移动到这里</Button>
        </footer>
      </section>
    </div>
  );
}

function PresetFolderBrowser({
  category,
  currentFolderId,
  onNavigate,
}: {
  category: DemoCategory;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  const breadcrumb = presetFolderBreadcrumb(category, currentFolderId);

  return (
    <div className={s.presetFolderBar}>
      <div className={s.presetFolderBreadcrumbs}>
        <button type="button" onClick={() => onNavigate(null)} disabled={!currentFolderId}>根目录</button>
        {breadcrumb.map((folder) => (
          <button type="button" key={folder.id} onClick={() => onNavigate(folder.id)} disabled={folder.id === currentFolderId}>
            {folder.name}
          </button>
        ))}
      </div>
      <span>{presetFolderItemCount(category, currentFolderId)} 项</span>
    </div>
  );
}

function PresetFolderRows({
  category,
  currentFolderId,
  onNavigate,
}: {
  category: DemoCategory;
  currentFolderId: string | null;
  onNavigate: (folderId: string | null) => void;
}) {
  const folders = presetFolderChildren(category, currentFolderId);

  if (!folders.length) return null;

  return (
    <div className={s.presetFolderGrid}>
      {folders.map((folder) => (
        <button className={s.presetFolderRow} type="button" key={folder.id} onClick={() => onNavigate(folder.id)}>
          <GripVertical className={s.categoryDragIcon} />
          <FolderTree className={s.iconMd} />
          <strong>{folder.name}</strong>
          <span>{presetFolderItemCount(category, folder.id)} 项</span>
          <Edit3 className={s.icon} />
        </button>
      ))}
    </div>
  );
}

function PresetItemRows({
  items,
  onToggle,
  selectedIds,
}: {
  items: PresetLibraryItem[];
  onToggle: (id: string) => void;
  selectedIds: Set<string>;
}) {
  if (!items.length) {
    return (
      <div className={s.empty}>当前文件夹没有条目</div>
    );
  }

  return (
    <div className={s.presetItemList}>
      {items.map((item, index) => {
        const checked = selectedIds.has(item.id);
        return (
          <div className={cx(s.presetItemRow, checked && s.presetItemRowSelected)} key={item.id}>
            <button className={s.presetItemCheck} type="button" onClick={() => onToggle(item.id)} aria-label={checked ? "取消选择" : "选择"}>
              {checked ? <CheckSquare className={s.iconMd} /> : <Square className={s.iconMd} />}
            </button>
            <Link className={s.presetItemOpenArea} href={demoHref(item.href)}>
              <GripVertical className={s.categoryDragIcon} />
              <div className={s.presetItemMain}>
                <strong>{item.name}</strong>
                <span>{item.slug}</span>
                <p>{item.description}</p>
              </div>
              <div className={s.presetItemMeta}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <em>{item.meta}</em>
              </div>
              <ArrowRight className={s.presetItemArrow} />
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function PresetsPage({ data }: { data: DemoData }) {
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [showDraftFolder, setShowDraftFolder] = useState(false);
  const category = data.categories.find((item) => item.id === categoryId) ?? data.categories[0];
  const visibleItems = category ? presetLibraryItems(category).filter((item) => (item.folderId ?? null) === currentFolderId) : [];
  const visibleFolders = category ? presetFolderChildren(category, currentFolderId) : [];
  const selectedCount = selectedIds.size;

  function selectCategory(next: DemoCategory) {
    setCategoryId(next.id);
    setCurrentFolderId(null);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
  }

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
  }

  function toggleItem(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={s.page}>
      <PageHeader
        eyebrow="预设库"
        title="提示词预设库"
        subtitle={`${data.categories.length} 个分类 · ${data.metrics.presets} 个预设`}
        actions={<ButtonLink href="/presets/sort-rules" icon={Shuffle}>排序规则</ButtonLink>}
      />
      {category ? (
        <div className={s.presetManagerLayout}>
          <PresetCategorySidebar
            categories={data.categories}
            selectedCategory={category}
            onSelect={selectCategory}
          />
          <section className={s.presetWorkArea}>
            <div className={s.presetWorkspaceHeader}>
              <div>
                <span>{categoryTypeLabel(category)}分类</span>
                <h2>{category.name}</h2>
                <p>{category.slug} · {categoryItemCount(category)} 个条目 · {category.folders.length} 个文件夹</p>
              </div>
              <StatusBadge status={category.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category)} />
            </div>
            <div className={s.presetContextBar}>
              <PresetFolderBrowser category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <div className={s.toolbar}>
                <Button icon={Plus} feedback={{ title: `${category.type === "group" ? "预设组" : "预设"}创建表单已准备` }}>新建{category.type === "group" ? "预设组" : "预设"}</Button>
                <Button icon={FolderTree} onClick={() => setShowDraftFolder(true)} feedback={{ title: "文件夹草稿已创建" }}>新建文件夹</Button>
              </div>
            </div>
            <OperationStateStrip
              items={[
                { label: "分类排序", value: "拖拽释放后保存", tone: "info" },
                { label: "文件夹排序", value: "就绪", tone: "success" },
                { label: "移动队列", value: selectedCount ? `${selectedCount} 项` : "空", tone: selectedCount ? "warning" : "success" },
              ]}
            />
            {selectedCount ? (
              <div className={s.presetBatchBar}>
                <strong>已选择 {selectedCount} 项</strong>
                <div className={s.toolbar}>
                  <Button tone="subtle" icon={Check} onClick={() => setSelectedIds(new Set(visibleItems.map((item) => item.id)))}>
                    全选当前层
                  </Button>
                  <Button icon={FolderTree} onClick={() => {
                    setMoveTargetId(currentFolderId);
                    setMoveSheetOpen(true);
                  }}>
                    移动到文件夹
                  </Button>
                  <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "批量删除需要确认", detail: `${selectedCount} 项` }}>批量删除</Button>
                  <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())}>取消</Button>
                </div>
              </div>
            ) : null}
            <section className={s.presetLibrarySurface}>
              {currentFolderId ? (
                <button className={s.presetFolderBack} type="button" onClick={() => {
                  const currentFolder = presetFolderBreadcrumb(category, currentFolderId)[presetFolderBreadcrumb(category, currentFolderId).length - 1];
                  navigateFolder(currentFolder?.parentId ?? null);
                }}>
                  <ArrowLeft className={s.iconMd} />
                  返回上级
                </button>
              ) : null}
              {showDraftFolder ? (
                <div className={cx(s.presetFolderRow, s.presetFolderDraft)}>
                  <GripVertical className={s.categoryDragIcon} />
                  <FolderTree className={s.iconMd} />
                  <strong>新建文件夹</strong>
                  <span>保存中</span>
                  <X className={s.icon} />
                </div>
              ) : null}
              <PresetFolderRows category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <PresetItemRows
                items={visibleItems}
                onToggle={toggleItem}
                selectedIds={selectedIds}
              />
              {!visibleFolders.length && !visibleItems.length && !showDraftFolder ? <div className={s.empty}>当前文件夹没有内容</div> : null}
            </section>
            {moveSheetOpen ? (
              <PresetMoveSheet
                category={category}
                onCancel={() => setMoveSheetOpen(false)}
                onConfirm={() => {
                  setCurrentFolderId(moveTargetId);
                  setSelectedIds(new Set());
                  setMoveSheetOpen(false);
                }}
                confirmFeedback={{ title: "移动已加入保存队列", detail: `${selectedCount} 项` }}
                onSelect={setMoveTargetId}
                selectedCount={selectedCount}
                selectedFolderId={moveTargetId}
              />
            ) : null}
          </section>
        </div>
      ) : <EmptyPage title="没有预设分类" />}
    </div>
  );
}

function PresetCategorySidebar({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: DemoCategory[];
  selectedCategory: DemoCategory;
  onSelect: (category: DemoCategory) => void;
}) {
  return (
    <aside className={s.presetCategorySidebar}>
      <div className={s.presetCategoryHeader}>
        <div>
          <span>分类管理</span>
          <strong>{categories.length} 个分类</strong>
        </div>
        <ButtonLink className={s.iconMiniButton} href="/presets/categories/new" icon={Plus} iconOnly ariaLabel="新建分类" tone="subtle" />
      </div>
      <div className={s.presetCategoryList}>
        {categories.map((category) => {
          const selected = selectedCategory.id === category.id;
          return (
            <div
              className={cx(s.presetCategoryItem, selected && s.presetCategoryItemActive)}
              key={category.id}
            >
              <div className={s.presetCategoryRow}>
                <button className={s.presetCategorySelect} type="button" onClick={() => onSelect(category)}>
                  <GripVertical className={s.categoryDragIcon} />
                  <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category.color) }} />
                  <span className={s.presetCategoryText}>
                    <strong>{category.name}</strong>
                    <span>{categoryItemCount(category)} 个{categoryTypeLabel(category)} · {category.slug}</span>
                  </span>
                </button>
                <div className={s.presetCategoryActions}>
                  <ButtonLink href={`/presets/categories/${category.id}/edit`} icon={Edit3} iconOnly ariaLabel="编辑分类" tone="subtle" />
                  <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除分类" disabled={categoryItemCount(category) > 0} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function PresetCategoryEditor({ category, categories }: { category: DemoCategory | null; categories: DemoCategory[] }) {
  const [draftType, setDraftType] = useState<"preset" | "group">(category?.type === "group" ? "group" : "preset");
  const type = category ? category.type : draftType;
  const itemCount = category ? categoryItemCount(category) : 0;
  const slots = categorySlotPreview(category, categories);
  const presetCategories = categories.filter((item) => item.type !== "group");

  return (
    <div className={s.categoryEditor}>
      <div className={s.categoryEditorHeader}>
        <strong>{category ? "编辑分类" : "新建分类"}</strong>
        <span>{category ? "分类类型已锁定" : "选择预设或预设组"}</span>
      </div>
      <div className={s.categoryTypeSwitch}>
        {(["preset", "group"] as const).map((item) => (
          <button
            className={cx(s.categoryTypeButton, type === item && s.categoryTypeButtonActive)}
            disabled={Boolean(category)}
            key={item}
            onClick={() => setDraftType(item)}
            type="button"
          >
            {item === "group" ? "预设组" : "预设"}
          </button>
        ))}
      </div>
      <div className={s.categoryEditorGrid}>
        <Field label="名称" value={category?.name ?? "新分类"} />
        <Field label="Slug" value={category?.slug ?? "new-category"} />
      </div>
      <div className={s.hueControl}>
        <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category?.color ?? null) }} />
        <input className={s.hueSlider} type="range" min={0} max={359} defaultValue={categoryHueValue(category?.color ?? null)} />
        <span>{categoryHueValue(category?.color ?? null)}°</span>
      </div>
      {type === "group" ? (
        <div className={s.slotEditor}>
          <div className={s.slotEditorHeader}>
            <strong>默认槽位</strong>
            <Button icon={Plus}>添加槽位</Button>
          </div>
          {(slots.length ? slots : [{ id: "new-slot", label: "主体", categoryName: presetCategories[0]?.name ?? "选择预设分类" }]).map((slot) => (
            <div className={s.slotRow} key={slot.id}>
              <GripVertical className={s.categoryDragIcon} />
              <SelectLike label="来源分类" value={slot.categoryName} />
              <Field label="槽位标签" value={slot.label} />
              <Button className={s.iconMiniButton} tone="danger" icon={X} iconOnly ariaLabel="删除槽位" />
            </div>
          ))}
        </div>
      ) : null}
      <div className={s.categoryEditorFooter}>
        {category ? (
          <div className={s.categoryDangerZone}>
            {itemCount > 0 ? (
              <span className={cx(s.inlineNotice, s.inlineNoticeWarn)}>
                删除前需移动 {itemCount} 个条目
              </span>
            ) : null}
            <Button tone="danger" disabled={itemCount > 0}>
              删除分类
            </Button>
          </div>
        ) : null}
        <span className={s.inlineToast}>已保存</span>
      </div>
    </div>
  );
}

export function PresetCategoryFormPage({
  category,
  data,
  mode,
}: {
  category: DemoCategory | undefined;
  data: DemoData;
  mode: "new" | "edit";
}) {
  const target: DemoCategory | null = mode === "edit" ? (category ?? null) : null;

  if (mode === "edit" && !target) return <EmptyPage title="没有预设分类数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="预设分类"
        title={mode === "new" ? "新建预设分类" : `编辑分类 / ${target?.name}`}
        subtitle={mode === "new" ? "创建分类后回到预设库。" : `${categoryTypeLabel(target)} · ${target ? categoryItemCount(target) : 0} 个条目`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: mode === "new" ? "分类创建已排队" : "分类保存已排队" }}>{mode === "new" ? "创建分类" : "保存分类"}</Button>}
      />
      <div className={s.categoryFormLayout}>
        <section className={s.categoryFormSurface}>
          <PresetCategoryEditor category={target} categories={data.categories} />
        </section>
      </div>
    </div>
  );
}

export function PresetEditPage({ data, preset }: { data: DemoData; preset: DemoPreset | undefined }) {
  const [activeVariantId, setActiveVariantId] = useState(preset?.variants[0]?.id ?? "");
  if (!preset) return <EmptyPage title="没有预设数据" />;

  const category = data.categories.find((item) => item.id === preset.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, preset.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const variants = preset.variants.length ? preset.variants : [{ id: "default", name: "默认", slug: "default", prompt: "", negativePrompt: "" }];
  const activeVariant = variants.find((variant) => variant.id === activeVariantId) ?? variants[0];
  const linkedVariants = data.categories
    .flatMap((item) => item.presets.map((candidate) => ({ category: item, preset: candidate })))
    .filter((item) => item.preset.id !== preset.id)
    .slice(0, 3);

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${preset.categoryId}&folder=${preset.folderId ?? ""}&preset=${preset.id}`, label: "返回预设库" }}
        eyebrow={categoryTypeLabel(category)}
        title={preset.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${preset.variantCount} 个变体`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设保存已排队", detail: preset.name }}>保存</Button>}
      />
      <div className={s.presetEditorShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{preset.slug}</span>
              <strong>{activeVariant.name}</strong>
              <em>{activeVariant.slug}</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "变体草稿已创建", detail: preset.name }}>添加变体</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>基础信息</strong>
                <span>名称、slug、分类和文件夹。</span>
              </div>
              <StatusBadge status="ready" label="已保存" />
            </div>
            <div className={s.fieldGrid}>
              <Field label="名称" value={preset.name} />
              <Field label="Slug" value={preset.slug} />
              <SelectLike label="分类" value={category?.name ?? preset.categoryId} />
              <SelectLike label="文件夹" value={folderPath} />
            </div>
            <TextAreaField label="备注" value={preset.notes || "预设说明和维护备注。"} />
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变体</strong>
                <span>每个变体保留独立 prompt、LoRA 和关联变体。</span>
              </div>
              <Button icon={GripVertical} feedback={{ title: "变体顺序已保存" }}>保存顺序</Button>
            </div>
            <div className={s.presetVariantWorkbench}>
              <div className={s.presetVariantRail}>
                {variants.map((variant, index) => (
                  <button
                    aria-pressed={variant.id === activeVariant.id}
                    className={cx(s.presetVariantButton, variant.id === activeVariant.id && s.presetVariantButtonActive)}
                    key={variant.id}
                    type="button"
                    onClick={() => setActiveVariantId(variant.id)}
                  >
                    <GripVertical className={s.icon} />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{variant.name}</strong>
                    <em>{variant.slug}</em>
                  </button>
                ))}
              </div>
              <div className={s.presetVariantEditor}>
                <div className={s.fieldGrid}>
                  <Field label="变体名称" value={activeVariant.name} />
                  <Field label="变体 Slug" value={activeVariant.slug} />
                </div>
                <div className={s.promptColumns}>
                  <TextAreaField label="正向 Prompt" value={activeVariant.prompt || "正向提示词"} />
                  <TextAreaField label="反向 Prompt" value={activeVariant.negativePrompt || "反向提示词"} />
                </div>
              </div>
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>LoRA 绑定</strong>
                <span>阶段 1 和阶段 2 对应真实编辑器的两个 LoRA 列表，保留权重、触发词和来源表达。</span>
              </div>
              <Button icon={Plus} feedback={{ title: "LoRA 行已添加", detail: activeVariant.name }}>添加 LoRA</Button>
            </div>
            <div className={s.loraStageGrid}>
              <PresetLoraStage title="LoRA 1" preset={preset} variant={activeVariant} stage={1} />
              <PresetLoraStage title="LoRA 2" preset={preset} variant={activeVariant} stage={2} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>关联变体</strong>
                <span>用于级联复用其他预设变体的 prompt 与 LoRA 内容。</span>
              </div>
              <Button icon={Search} feedback={{ title: "变体选择面板已准备" }}>选择变体</Button>
            </div>
            <div className={s.presetLinkedList}>
              {linkedVariants.map(({ category: sourceCategory, preset: sourcePreset }, index) => {
                const variant = sourcePreset.variants[index % Math.max(sourcePreset.variants.length, 1)];
                return (
                  <div className={s.presetLinkedRow} key={sourcePreset.id}>
                    <div>
                      <strong>{sourcePreset.name}</strong>
                      <span>{sourceCategory.name} · {variant?.name ?? "默认"} · {variant?.slug ?? "default"}</span>
                    </div>
                    <StatusBadge status={index === 0 ? "ready" : "monitor"} label={index === 0 ? "级联" : "候选"} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>变更历史</strong>
                <span>按基础信息、变体内容和 LoRA 绑定展示差异。</span>
              </div>
              <Button icon={History} feedback={{ title: "历史筛选已应用" }}>筛选历史</Button>
            </div>
            <div className={s.historyDiffList}>
              <div className={s.historyDiffRow}>
                <strong>变体内容更新</strong>
                <span>正向 Prompt 增加 {activeVariant.name} 的主体描述，反向 Prompt 同步排除项。</span>
              </div>
              <div className={s.historyDiffRow}>
                <strong>LoRA 绑定调整</strong>
                <span>LoRA 1 权重从 0.75 调整为 0.82，LoRA 2 保持继承。</span>
              </div>
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>保存状态</strong>
          <div className={s.editorStatusStrip}>
            <span>自动保存已开启</span>
            <span>{variants.length} 个变体</span>
            <span>{category?.name ?? "未分类"}</span>
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>级联同步</strong>
              <span>当前变体的 prompt 与 LoRA 可同步到绑定它的小节。</span>
            </div>
            <StatusBadge status="pending" label="待确认" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>被项目或小节引用时需要先解除绑定。</span>
            </div>
            <StatusBadge status="monitor" label="受保护" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PresetLoraStage({
  title,
  preset,
  variant,
  stage,
}: {
  title: string;
  preset: DemoPreset;
  variant: DemoPreset["variants"][number];
  stage: 1 | 2;
}) {
  const rows = [
    {
      name: `${preset.slug}-${stage}`,
      weight: stage === 1 ? "0.82" : "0.56",
      trigger: variant.slug,
    },
    {
      name: stage === 1 ? "character-refine" : "style-balance",
      weight: stage === 1 ? "0.35" : "0.48",
      trigger: preset.slug,
    },
  ];

  return (
    <div className={s.loraStage}>
      <strong>{title}</strong>
      {rows.map((row) => (
        <div className={s.loraRow} key={`${title}-${row.name}`}>
          <span>{row.name}</span>
          <em>{row.weight}</em>
          <button type="button">{row.trigger}</button>
        </div>
      ))}
    </div>
  );
}

export function PresetGroupPage({ data, group }: { data: DemoData; group: DemoPresetGroup | undefined }) {
  if (!group) return <EmptyPage title="没有预设组数据" />;
  const category = data.categories.find((item) => item.id === group.categoryId) ?? firstCategory(data);
  const folderPath = category ? presetFolderBreadcrumb(category, group.folderId).map((folder) => folder.name).join(" / ") || "根目录" : "根目录";
  const fallbackMembers = data.categories.flatMap((item) => item.presets).slice(0, Math.max(3, group.memberCount));
  const members = Array.from({ length: Math.max(group.memberCount, 3) }, (_, index) => ({
    id: `${group.id}-${index}`,
    name: group.members[index] ?? fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.name ?? "选择预设",
    categoryName: data.categories.find((item) => item.presets.some((preset) => preset.name === group.members[index]))?.name ?? "预设",
    variant: fallbackMembers[index % Math.max(fallbackMembers.length, 1)]?.variants[0]?.name ?? "默认",
  }));

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/presets?category=${group.categoryId}&folder=${group.folderId ?? ""}&group=${group.id}`, label: "返回预设库" }}
        eyebrow="预设组"
        title={group.name}
        subtitle={`${category?.name ?? "未分类"} · ${folderPath} · ${group.memberCount} 个成员`}
        actions={<Button tone="primary" icon={Save} feedback={{ title: "预设组保存已排队", detail: group.name }}>保存</Button>}
      />
      <div className={s.presetGroupShell}>
        <main className={s.editorSurface}>
          <div className={s.editorStickyHeader}>
            <div className={s.editorIdentity}>
              <span>{group.slug}</span>
              <strong>成员编排</strong>
              <em>拖拽排序、添加预设或子组、保存后返回当前分类和文件夹。</em>
            </div>
            <div className={s.toolbar}>
              <StatusBadge status="ready" label="已保存" />
              <Button icon={Plus} feedback={{ title: "成员选择面板已准备" }}>添加成员</Button>
            </div>
          </div>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>组信息</strong>
                <span>预设组保留分类、文件夹和删除返回路径，名称与 slug 可直接编辑。</span>
              </div>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "删除预设组需要确认", detail: group.name }}>删除组</Button>
            </div>
            <div className={s.fieldGrid}>
              <Field label="名称" value={group.name} />
              <Field label="Slug" value={group.slug} />
              <SelectLike label="分类" value={category?.name ?? group.categoryId} />
              <SelectLike label="文件夹" value={folderPath} />
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>成员列表</strong>
                <span>行内展示成员来源、变体和排序手柄，避免在列表里再展开编辑卡片。</span>
              </div>
              <Button icon={Search} feedback={{ title: "预设选择面板已准备" }}>选择预设</Button>
            </div>
            <div className={s.groupMemberList}>
              {members.map((member, index) => (
                <div className={s.groupMemberRow} key={member.id}>
                  <GripVertical className={s.icon} />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <em>{member.categoryName} · {member.variant}</em>
                  </div>
                  <SelectLike label="变体" value={member.variant} />
                  <Button className={s.iconMiniButton} tone="danger" icon={Trash2} iconOnly ariaLabel="移除成员" />
                </div>
              ))}
            </div>
          </section>

          <section className={s.editorBlock}>
            <div className={s.editorBlockHeader}>
              <div>
                <strong>Flatten 预览</strong>
                <span>嵌套组展开后按分类顺序输出可执行预设序列。</span>
              </div>
              <StatusBadge status="ready" label={`${members.length} 步`} />
            </div>
            <div className={s.groupPreviewList}>
              {members.map((member, index) => (
                <div className={s.groupPreviewRow} key={`${member.id}-preview`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{member.name}</strong>
                    <em>Prompt block + LoRA 绑定 · {member.categoryName}</em>
                  </div>
                  <StatusBadge status={index % 2 === 0 ? "ready" : "monitor"} label={index % 2 === 0 ? "直接成员" : "继承"} />
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className={s.editorAside}>
          <strong>成员来源</strong>
          <div className={s.presetCascadeState}>
            <div>
              <strong>分类</strong>
              <span>{category?.name ?? "未分类"} · {categoryTypeLabel(category)}</span>
            </div>
            <StatusBadge status="ready" label="可编辑" />
          </div>
          <div className={s.presetCascadeState}>
            <div>
              <strong>删除保护</strong>
              <span>成员清空后才允许删除预设组。</span>
            </div>
            <StatusBadge status="pending" label="受保护" />
          </div>
          <div className={s.historyDiffList}>
            <div className={s.historyDiffRow}>
              <strong>成员排序</strong>
              <span>Slot 2 移动到 Slot 1，flatten 输出顺序同步。</span>
            </div>
            <div className={s.historyDiffRow}>
              <strong>成员变更</strong>
              <span>新增 {members[0]?.name ?? "成员"} 的默认变体。</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SortRulesPage({ data }: { data: DemoData }) {
  const dimensions: Array<{ key: SortRuleDimensionKey; title: string; subtitle: string; categories: DemoCategory[] }> = [
    { key: "positive", title: "正向 Prompt", subtitle: "决定导入后正向块的分类顺序。", categories: data.categories },
    { key: "negative", title: "反向 Prompt", subtitle: "反向块使用独立顺序，便于排除项先后稳定。", categories: [...data.categories].reverse() },
    { key: "lora1", title: "LoRA 1", subtitle: "第一阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(1).concat(data.categories.slice(0, 1)) },
    { key: "lora2", title: "LoRA 2", subtitle: "第二阶段 LoRA 绑定的分类排序。", categories: data.categories.slice(2).concat(data.categories.slice(0, 2)) },
  ];

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: "/presets", label: "返回预设库" }}
        eyebrow="排序规则"
        title="预设排序规则"
        subtitle="每个维度独立拖拽保存，正向、反向与两段 LoRA 不再共用一张摘要表。"
        actions={<Button tone="primary" icon={Save} feedback={{ title: "全部排序规则已保存" }}>保存全部</Button>}
      />
      <div className={s.sortRulesGrid}>
        {dimensions.map((dimension) => (
          <SortRulePanel
            categories={dimension.categories}
            key={dimension.key}
            title={dimension.title}
            subtitle={dimension.subtitle}
          />
        ))}
      </div>
    </div>
  );
}

function SortRulePanel({
  categories,
  title,
  subtitle,
}: {
  categories: DemoCategory[];
  title: string;
  subtitle: string;
}) {
  return (
    <section className={s.sortRulePanel}>
      <div className={s.sortRuleHeader}>
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <StatusBadge status="ready" label="已保存" />
      </div>
      <div className={s.sortRuleList}>
        {categories.map((category, index) => (
          <div className={s.sortRuleRow} key={category.id}>
            <GripVertical className={s.icon} />
            <span>{String(index + 1).padStart(2, "0")}</span>
            <i style={{ background: categoryColorValue(category.color) }} />
            <div>
              <strong>{category.name}</strong>
              <em>{categoryTypeLabel(category)} · {categoryItemCount(category)} 条目</em>
            </div>
          </div>
        ))}
      </div>
      <div className={s.sortRuleFooter}>
        <span>拖拽排序后保存</span>
        <Button icon={Save} feedback={{ title: `${title} 排序已保存` }}>保存此维度</Button>
      </div>
    </section>
  );
}

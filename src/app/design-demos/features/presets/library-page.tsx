"use client";

import Link from "next/link";
import { type MouseEvent as ReactMouseEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Edit3, FolderTree, GripVertical, Plus, Shuffle, Trash2, X } from "lucide-react";

import {
  categoryColorValue,
  categoryItemCount,
  categoryTypeLabel,
  presetFolderBreadcrumb,
  presetFolderChildren,
  presetFolderItemCount,
  presetFolderOptions,
  presetLibraryItems,
  type DemoCategory,
  type DemoData,
  type PresetLibraryItem,
} from "../../data";
import s from "./library-page.library.module.css";
import { Button } from "../../shared/primitives/button";
import { ButtonLink } from "../../shared/primitives/button";
import { Checkbox } from "../../shared/primitives/checkbox";
import { EmptyPage } from "../../shared/primitives/empty-page";
import { PageHeader } from "../../shared/primitives/page-header";
import { FolderBreadcrumb, FolderRow, SelectionBatchBar } from "../../shared/patterns";
import { StatusBadge } from "../../shared/primitives/status-badge";
import { cx, demoHref } from "../../routing";
import type { DemoButtonFeedback } from "../../routing";

type DisplayPresetLibraryItem = PresetLibraryItem & {
  categoryId?: string;
  isLocalCopy?: boolean;
  copyOrdinal?: number;
  sourceHref?: string;
  sourceId?: string;
  sourceName?: string;
} & Record<string, unknown>;

type LocalPresetLibraryItem = DisplayPresetLibraryItem & {
  categoryId: string;
};

function cloneDemoData<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function copyBaseName(name: string) {
  return name.replace(/\s+Copy(?:\s+\d+)?$/, "");
}

function copyNameFor(sourceName: string, existingItems: LocalPresetLibraryItem[]) {
  const baseName = copyBaseName(sourceName);
  const usedNames = new Set(existingItems.map((item) => item.name));
  let copyIndex = 1;
  let nextName = `${baseName} Copy`;

  while (usedNames.has(nextName)) {
    copyIndex += 1;
    nextName = `${baseName} Copy ${copyIndex}`;
  }

  return { name: nextName, copyOrdinal: copyIndex };
}

function presetLibraryItemsWithDemoData(category: DemoCategory): LocalPresetLibraryItem[] {
  const rawItems = presetLibraryItems(category);

  return rawItems.map((item) => {
    const source = item.kind === "preset"
      ? category.presets.find((preset) => preset.id === item.id)
      : category.groups.find((group) => group.id === item.id);

    return {
      ...(source ? cloneDemoData(source) : {}),
      ...item,
      categoryId: category.id,
    };
  });
}

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
        <FolderBreadcrumb
          activeButtonClassName={s.presetFolderBreadcrumbActive}
          buttonClassName={s.presetFolderBreadcrumbButton}
          className={s.presetMoveBreadcrumbs}
          items={breadcrumb.map((folder) => ({ id: folder.id, label: folder.name }))}
          onNavigate={onSelect}
          size="sm"
        />
        <div className={s.presetMoveTargets}>
          {options.map((option) => (
            <FolderRow
              className={cx(s.presetMoveTarget, selectedFolderId === option.id && s.presetMoveTargetActive)}
              countLabel={`${option.count} 项`}
              iconClassName={s.iconMd}
              key={option.id ?? "root"}
              leadingIcon={FolderTree}
              name={option.name}
              nameClassName={s.presetMoveTargetName}
              onOpen={() => onSelect(option.id)}
              openClassName={s.presetMoveTargetOpen}
              showChevron={false}
              showDragHandle={false}
            />
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
  itemCount,
  onNavigate,
}: {
  category: DemoCategory;
  currentFolderId: string | null;
  itemCount?: number;
  onNavigate: (folderId: string | null) => void;
}) {
  const breadcrumb = presetFolderBreadcrumb(category, currentFolderId);

  return (
    <div className={s.presetFolderBar}>
      <FolderBreadcrumb
        activeButtonClassName={s.presetFolderBreadcrumbActive}
        buttonClassName={s.presetFolderBreadcrumbButton}
        className={s.presetFolderBreadcrumbs}
        items={breadcrumb.map((folder) => ({ id: folder.id, label: folder.name }))}
        onNavigate={onNavigate}
        size="sm"
      />
      <span>{itemCount ?? presetFolderItemCount(category, currentFolderId)} 项</span>
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
        <FolderRow
          actions={<Button tone="subtle" icon={Edit3} iconOnly ariaLabel={`编辑文件夹：${folder.name}`} />}
          actionsClassName={s.presetFolderRowActions}
          className={s.presetFolderRow}
          countLabel={`${presetFolderItemCount(category, folder.id)} 项`}
          dragHandleClassName={s.presetFolderGrip}
          iconClassName={s.iconMd}
          key={folder.id}
          leadingIcon={FolderTree}
          name={folder.name}
          onOpen={() => onNavigate(folder.id)}
          openClassName={s.presetFolderOpen}
          showChevron={false}
        />
      ))}
    </div>
  );
}

export function PresetLibraryItemRow({
  checked,
  copyState,
  index,
  item,
  onCopy,
  onToggle,
}: {
  checked: boolean;
  copyState?: "copy" | "source";
  index: number;
  item: DisplayPresetLibraryItem;
  onCopy?: (item: DisplayPresetLibraryItem) => void;
  onToggle: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onCopy?.(item);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const href = item.isLocalCopy ? item.sourceHref ?? item.href : item.href;
  const openLabel = item.isLocalCopy && item.sourceName ? `打开源预制：${item.sourceName}` : undefined;
  const copyStateLabel = copyState === "copy" ? "本地副本" : copyState === "source" ? "已复制源" : null;

  return (
    <div className={cx(s.presetItemRow, checked && s.presetItemRowSelected, copyState === "copy" && s.presetItemRowCopy, copyState === "source" && s.presetItemRowSource)}>
      <Checkbox
        checked={checked}
        label={checked ? `取消选择预制：${item.name}` : `选择预制：${item.name}`}
        onCheckedChange={() => onToggle(item.id)}
        variant="compact"
      />
      <Link aria-label={openLabel} className={s.presetItemOpenArea} href={demoHref(href)}>
        <GripVertical className={s.categoryDragIcon} />
        <div className={s.presetItemMain}>
          <strong>
            <span className={s.presetItemNameText}>{item.name}</span>
            {copyStateLabel ? <span className={s.presetInlineState}>{copyStateLabel}</span> : null}
          </strong>
          <p>{item.description}</p>
        </div>
        <div className={s.presetItemMeta}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <em>{item.isLocalCopy && item.sourceName ? `源：${item.sourceName}` : item.meta}</em>
        </div>
        <ArrowRight className={s.presetItemArrow} />
      </Link>
      <div className={s.presetItemActions}>
        {item.kind === "preset" ? (
          <>
            {copied ? <span className={s.presetCopyState}>已复制</span> : null}
            <Button
              ariaLabel={`复制预制：${item.name}`}
              className={s.presetItemCopyButton}
              icon={Copy}
              iconOnly
              onClick={handleCopy}
              size="sm"
              tone="subtle"
              feedback={{
                title: "深拷贝将创建新的系统标识",
                detail: item.name,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function PresetItemRows({
  copiedSourceIds,
  items,
  onCopy,
  onToggle,
  selectedIds,
}: {
  copiedSourceIds: Set<string>;
  items: LocalPresetLibraryItem[];
  onCopy: (item: DisplayPresetLibraryItem) => void;
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
        const copyState = item.isLocalCopy ? "copy" : copiedSourceIds.has(item.id) ? "source" : undefined;
        return (
          <PresetLibraryItemRow checked={checked} copyState={copyState} index={index} item={item} key={item.id} onCopy={onCopy} onToggle={onToggle} />
        );
      })}
    </div>
  );
}

export function PresetsPage({ data }: { data: DemoData }) {
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [localCopies, setLocalCopies] = useState<LocalPresetLibraryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [showDraftFolder, setShowDraftFolder] = useState(false);
  const category = data.categories.find((item) => item.id === categoryId) ?? data.categories[0];
  const categoryItems = category ? presetLibraryItemsWithDemoData(category) : [];
  const categoryCopies = category ? localCopies.filter((item) => item.categoryId === category.id) : [];
  const allCategoryItems = [...categoryItems, ...categoryCopies];
  const visibleItems = allCategoryItems.filter((item) => (item.folderId ?? null) === currentFolderId);
  const visibleFolders = category ? presetFolderChildren(category, currentFolderId) : [];
  const copiedSourceIds = new Set(categoryCopies.map((item) => item.sourceId).filter((id): id is string => Boolean(id)));
  const folderItemCount = visibleFolders.length + visibleItems.length;
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

  function copyPresetItem(item: DisplayPresetLibraryItem) {
    if (item.kind !== "preset" || !category) return;
    const sourceName = copyBaseName(item.sourceName ?? item.name);
    const sourceId = item.sourceId ?? item.id;
    const sourceHref = item.sourceHref ?? item.href;
    const copyId = `local-copy:${category.id}:${sourceId}:${Date.now()}`;

    setLocalCopies((current) => {
      const itemsInCategory = [
        ...presetLibraryItemsWithDemoData(category),
        ...current.filter((copy) => copy.categoryId === category.id),
      ];
      const { name, copyOrdinal } = copyNameFor(sourceName, itemsInCategory);
      const copy: LocalPresetLibraryItem = {
        ...cloneDemoData(item),
        id: copyId,
        name,
        slug: name,
        href: sourceHref,
        categoryId: category.id,
        folderId: item.folderId ?? null,
        isLocalCopy: true,
        copyOrdinal,
        sourceHref,
        sourceId,
        sourceName,
      };

      return [...current, copy];
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
                <p>{categoryItemCount(category) + categoryCopies.length} 个条目 · {category.folders.length} 个文件夹</p>
              </div>
              <StatusBadge status={category.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category)} />
            </div>
            <div className={s.presetContextBar}>
              <PresetFolderBrowser category={category} currentFolderId={currentFolderId} itemCount={folderItemCount} onNavigate={navigateFolder} />
              <div className={s.toolbar}>
                <Button icon={Plus} feedback={{ title: `${category.type === "group" ? "预设组" : "预设"}创建表单已准备` }}>新建{category.type === "group" ? "预设组" : "预设"}</Button>
                <Button icon={FolderTree} onClick={() => setShowDraftFolder(true)} feedback={{ title: "文件夹草稿已创建" }}>新建文件夹</Button>
              </div>
            </div>
            {selectedCount ? (
              <SelectionBatchBar
                actions={
                  <>
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
                  </>
                }
                actionsClassName={s.toolbar}
                className={s.presetBatchBar}
                clearIconOnly={false}
                clearLabel="取消"
                label={<>已选择 {selectedCount} 项</>}
                onClear={() => setSelectedIds(new Set())}
                selectedCount={selectedCount}
              />
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
                <FolderRow
                  actions={<Button tone="subtle" icon={X} iconOnly ariaLabel="取消新建文件夹" onClick={() => setShowDraftFolder(false)} />}
                  actionsClassName={s.presetFolderRowActions}
                  className={cx(s.presetFolderRow, s.presetFolderDraft)}
                  countLabel="保存中"
                  dragHandleClassName={s.presetFolderGrip}
                  iconClassName={s.iconMd}
                  leadingIcon={FolderTree}
                  name="新建文件夹"
                  openClassName={s.presetFolderOpen}
                  showChevron={false}
                />
              ) : null}
              <PresetFolderRows category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <PresetItemRows
                copiedSourceIds={copiedSourceIds}
                items={visibleItems}
                onCopy={copyPresetItem}
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

export function PresetCategorySidebar({
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
      </div>
      <div className={s.presetCategoryList}>
        {categories.map((category) => {
          const selected = selectedCategory.id === category.id;
          return (
            <PresetCategoryRow category={category} key={category.id} onSelect={onSelect} selected={selected} />
          );
        })}
      </div>
    </aside>
  );
}

export function PresetCategoryRow({
  category,
  onSelect,
  selected,
}: {
  category: DemoCategory;
  onSelect: (category: DemoCategory) => void;
  selected: boolean;
}) {
  return (
    <div className={cx(s.presetCategoryItem, selected && s.presetCategoryItemActive)}>
      <div className={s.presetCategoryRow}>
        <button className={s.presetCategorySelect} type="button" onClick={() => onSelect(category)}>
          <GripVertical className={s.categoryDragIcon} />
          <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category.color) }} />
          <span className={s.presetCategoryText}>
            <strong>{category.name}</strong>
            <span>{categoryItemCount(category)} 个{categoryTypeLabel(category)}</span>
          </span>
        </button>
        <div className={s.presetCategoryActions}>
          <ButtonLink href={`/presets/categories/${category.id}/edit`} icon={Edit3} iconOnly ariaLabel="编辑分类" tone="subtle" />
          <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除分类" disabled={categoryItemCount(category) > 0} />
        </div>
      </div>
    </div>
  );
}

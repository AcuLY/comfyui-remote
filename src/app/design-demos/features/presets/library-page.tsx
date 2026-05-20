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
import { SortableList, useDemoSortable } from "../../shared/primitives/sortable";

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

/**
 * Move sheet: allows batch moving selected items to a target folder
 */
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
    <div className={s.moveBackdrop} role="presentation" onClick={onCancel}>
      <section className={s.moveSheet} role="dialog" aria-modal="true" aria-label={`移动 ${selectedCount} 个${categoryTypeLabel(category)}项`} onClick={(event) => event.stopPropagation()}>
        <header className={s.moveHeader}>
          <div>
            <p>批量移动</p>
            <h2>{selectedCount} 个{categoryTypeLabel(category)}条目</h2>
          </div>
          <button className={s.closeButton} type="button" onClick={onCancel} aria-label="关闭">
            <X width={16} height={16} />
          </button>
        </header>
        <nav className={s.moveBreadcrumbs}>
          <FolderBreadcrumb
            activeButtonClassName={s.breadcrumbActive}
            buttonClassName={s.breadcrumbButton}
            className={s.breadcrumb}
            items={breadcrumb.map((folder) => ({ id: folder.id, label: folder.name }))}
            onNavigate={onSelect}
            rootLabel="根目录"
            size="sm"
          />
        </nav>
        <div className={s.moveTargets}>
          {options.map((option) => (
            <button
              key={option.id ?? "root"}
              type="button"
              className={cx(s.moveTarget, selectedFolderId === option.id && s.moveTargetActive)}
              onClick={() => onSelect(option.id)}
              aria-pressed={selectedFolderId === option.id}
              style={{ paddingLeft: `${(option.depth ?? 0) * 16}px` }}
            >
              <FolderTree width={14} height={14} />
              <span>{option.name}</span>
              <em>{option.count} 项</em>
            </button>
          ))}
        </div>
        <footer className={s.moveFooter}>
          <span>移动到：<strong>{breadcrumb[breadcrumb.length - 1]?.name ?? "根目录"}</strong></span>
          <Button tone="primary" icon={FolderTree} onClick={onConfirm} feedback={confirmFeedback}>
            移动
          </Button>
        </footer>
      </section>
    </div>
  );
}

/**
 * Folder browser: breadcrumb navigation and item counter for current folder
 */
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
    <div className={s.folderBrowser}>
      <FolderBreadcrumb
        activeButtonClassName={s.breadcrumbActive}
        buttonClassName={s.breadcrumbButton}
        className={s.breadcrumb}
        items={breadcrumb.map((folder) => ({ id: folder.id, label: folder.name }))}
        onNavigate={onNavigate}
        rootLabel="根目录"
        size="sm"
      />
      <span className={s.folderItemCount}>{itemCount ?? presetFolderItemCount(category, currentFolderId)} 项</span>
    </div>
  );
}

/**
 * Folder rows: list of subfolders in current location
 */
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
    <div className={s.folderGrid}>
      {folders.map((folder) => (
        <FolderRow
          actions={<Button tone="subtle" icon={Edit3} iconOnly ariaLabel={`编辑文件夹：${folder.name}`} />}
          actionsClassName={s.folderRowActions}
          className={s.folderItem}
          countLabel={`${presetFolderItemCount(category, folder.id)} 项`}
          dragHandleClassName={s.dragHandle}
          iconClassName={s.folderIcon}
          key={folder.id}
          leadingIcon={FolderTree}
          name={folder.name}
          onOpen={() => onNavigate(folder.id)}
          openClassName={s.folderOpen}
          showChevron={false}
        />
      ))}
    </div>
  );
}

/**
 * Preset library item row: displays a preset or group with copy/delete actions
 */
export function PresetLibraryItemRow({
  checked,
  copyState,
  index,
  item,
  onCopy,
  onDelete,
  onToggle,
}: {
  checked: boolean;
  copyState?: "copy" | "source";
  index: number;
  item: DisplayPresetLibraryItem;
  onCopy?: (item: DisplayPresetLibraryItem) => void;
  onDelete?: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { ref, style, handleProps } = useDemoSortable(item.id);

  function handleCopy(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    onCopy?.(item);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const href = item.isLocalCopy ? item.sourceHref ?? item.href : item.href;
  const openLabel = item.isLocalCopy && item.sourceName ? `打开源预制：${item.sourceName}` : undefined;

  return (
    <div ref={ref} style={style} className={cx(s.itemRow, checked && s.itemRowSelected, copyState === "copy" && s.itemRowCopy, copyState === "source" && s.itemRowSource)}>
      <Checkbox
        checked={checked}
        label={checked ? `取消选择：${item.name}` : `选择：${item.name}`}
        onCheckedChange={() => onToggle(item.id)}
        variant="compact"
      />
      <Link aria-label={openLabel} className={s.itemLink} href={demoHref(href)}>
        <GripVertical className={s.dragHandle} {...handleProps} width={14} height={14} />
        <div className={s.itemContent}>
          <strong className={s.itemTitle}>{item.name}</strong>
          <p className={s.itemDescription}>{item.description}</p>
        </div>
        <div className={s.itemMeta}>
          <span className={s.itemIndex}>{String(index + 1).padStart(2, "0")}</span>
          <em>{item.isLocalCopy && item.sourceName ? `源：${item.sourceName}` : item.meta}</em>
        </div>
        <ArrowRight className={s.itemArrow} width={14} height={14} />
      </Link>
      <div className={s.itemActions}>
        {item.kind === "preset" ? (
          <>
            {copied && <span className={s.copiedLabel}>已复制</span>}
            <Button
              ariaLabel={`复制预制：${item.name}`}
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
        <Button
          ariaLabel={`删除：${item.name}`}
          icon={Trash2}
          iconOnly
          onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete?.(item.id);
          }}
          size="sm"
          tone="danger"
          feedback={{
            tone: "warning",
            title: "已删除",
            detail: item.name,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Item rows container: displays all preset/group items in current folder with sortable list
 */
function PresetItemRows({
  copiedSourceIds,
  items,
  onCopy,
  onDelete,
  onReorder,
  onToggle,
  selectedIds,
}: {
  copiedSourceIds: Set<string>;
  items: LocalPresetLibraryItem[];
  onCopy: (item: DisplayPresetLibraryItem) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onToggle: (id: string) => void;
  selectedIds: Set<string>;
}) {
  if (!items.length) {
    return <div className={s.empty}>当前文件夹没有条目</div>;
  }

  return (
    <div className={s.itemList}>
      <SortableList items={items.map((item) => item.id)} onReorder={onReorder}>
        {items.map((item, index) => {
          const checked = selectedIds.has(item.id);
          const copyState = item.isLocalCopy ? "copy" : copiedSourceIds.has(item.id) ? "source" : undefined;
          return (
            <PresetLibraryItemRow
              checked={checked}
              copyState={copyState}
              index={index}
              item={item}
              key={item.id}
              onCopy={onCopy}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          );
        })}
      </SortableList>
    </div>
  );
}

/**
 * Category sidebar: lists all preset categories for selection
 */
export function PresetCategorySidebar({
  categories,
  categoryOrder,
  onDeleteCategory,
  onReorderCategories,
  selectedCategory,
  onSelect,
}: {
  categories: DemoCategory[];
  categoryOrder: string[];
  onDeleteCategory?: (categoryId: string) => void;
  onReorderCategories: (ids: string[]) => void;
  selectedCategory: DemoCategory;
  onSelect: (category: DemoCategory) => void;
}) {
  const orderedCategories = categoryOrder.length
    ? categoryOrder.map((id) => categories.find((c) => c.id === id)).filter((c): c is DemoCategory => Boolean(c))
    : categories;

  return (
    <aside className={s.categoryAside}>
      <header className={s.categoryHeader}>
        <div>
          <p>分类</p>
          <h3>{categories.length} 个</h3>
        </div>
      </header>
      <div className={s.categoryList}>
        <SortableList items={orderedCategories.map((c) => c.id)} onReorder={onReorderCategories}>
          {orderedCategories.map((category) => {
            const selected = selectedCategory.id === category.id;
            return (
              <PresetCategoryRow
                category={category}
                key={category.id}
                onDelete={onDeleteCategory}
                onSelect={onSelect}
                selected={selected}
              />
            );
          })}
        </SortableList>
      </div>
    </aside>
  );
}

/**
 * Category row: single category item in sidebar
 */
export function PresetCategoryRow({
  category,
  onDelete,
  onSelect,
  selected,
}: {
  category: DemoCategory;
  onDelete?: (categoryId: string) => void;
  onSelect: (category: DemoCategory) => void;
  selected: boolean;
}) {
  const { ref, style, handleProps } = useDemoSortable(category.id);

  return (
    <div ref={ref} style={style} className={cx(s.categoryItem, selected && s.categoryItemActive)}>
      <button className={s.categoryButton} type="button" onClick={() => onSelect(category)}>
        <GripVertical className={s.dragHandle} {...handleProps} width={14} height={14} />
        <span className={s.categoryColor} style={{ backgroundColor: categoryColorValue(category.color) }} />
        <div className={s.categoryInfo}>
          <strong>{category.name}</strong>
          <span>{categoryItemCount(category)} 个{categoryTypeLabel(category)}</span>
        </div>
      </button>
      <div className={s.categoryActions}>
        <ButtonLink href={`/presets/categories/${category.id}/edit`} icon={Edit3} iconOnly ariaLabel="编辑" tone="subtle" />
        <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除" disabled={categoryItemCount(category) > 0} onClick={() => onDelete?.(category.id)} />
      </div>
    </div>
  );
}

/**
 * Main presets library page: manages category selection, folder navigation, item browsing, and batch operations
 */
export function PresetsPage({ data }: { data: DemoData }) {
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? "");
  const [categoryOrder, setCategoryOrder] = useState(data.categories.map((c) => c.id));
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [localCopies, setLocalCopies] = useState<LocalPresetLibraryItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [showDraftFolder, setShowDraftFolder] = useState(false);
  const [itemOrder, setItemOrder] = useState<string[]>([]);

  // Derived state
  const visibleCategories = data.categories.filter((c) => !hiddenCategoryIds.has(c.id));
  const category = visibleCategories.find((item) => item.id === categoryId) ?? visibleCategories[0];
  const categoryItems = category ? presetLibraryItemsWithDemoData(category) : [];
  const categoryCopies = category ? localCopies.filter((item) => item.categoryId === category.id) : [];
  const allCategoryItems = [...categoryItems, ...categoryCopies].filter((item) => !hiddenIds.has(item.id));
  const visibleItems = allCategoryItems.filter((item) => (item.folderId ?? null) === currentFolderId);
  const orderedVisibleItems = itemOrder.length
    ? itemOrder.map((id) => visibleItems.find((item) => item.id === id)).filter((item): item is LocalPresetLibraryItem => Boolean(item))
    : visibleItems;
  const visibleFolders = category ? presetFolderChildren(category, currentFolderId) : [];
  const copiedSourceIds = new Set(categoryCopies.map((item) => item.sourceId).filter((id): id is string => Boolean(id)));
  const folderItemCount = visibleFolders.length + visibleItems.length;
  const selectedCount = selectedIds.size;

  function selectCategory(next: DemoCategory) {
    setCategoryId(next.id);
    setCurrentFolderId(null);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
    setItemOrder([]);
  }

  function navigateFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    setShowDraftFolder(false);
    setItemOrder([]);
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
        <div className={s.layout}>
          <PresetCategorySidebar
            categories={visibleCategories}
            categoryOrder={categoryOrder}
            onDeleteCategory={(id) => setHiddenCategoryIds(prev => new Set([...prev, id]))}
            onReorderCategories={setCategoryOrder}
            selectedCategory={category}
            onSelect={selectCategory}
          />
          <section className={s.workArea}>
            <header className={s.workHeader}>
              <div>
                <p>{categoryTypeLabel(category)}分类</p>
                <h2>{category.name}</h2>
                <p>{categoryItemCount(category) + categoryCopies.length} 个条目 · {category.folders.length} 个文件夹</p>
              </div>
              <StatusBadge status={category.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category)} />
            </header>
            <div className={s.contextBar}>
              <PresetFolderBrowser category={category} currentFolderId={currentFolderId} itemCount={folderItemCount} onNavigate={navigateFolder} />
              <div className={s.toolbar}>
                <Button icon={Plus} onClick={() => {
                  const draftId = `draft-${Date.now()}`;
                  const draftItem: LocalPresetLibraryItem = {
                    id: draftId,
                    name: `新${category.type === "group" ? "预设组" : "预设"}`,
                    slug: draftId,
                    kind: category.type === "group" ? "group" : "preset",
                    href: "#",
                    description: "刚创建的草稿",
                    meta: "0 个变体",
                    folderId: currentFolderId,
                    categoryId: category.id,
                  };
                  setLocalCopies(prev => [...prev, draftItem]);
                }} feedback={{ title: `${category.type === "group" ? "预设组" : "预设"}创建表单已准备` }}>
                  新建{category.type === "group" ? "预设组" : "预设"}
                </Button>
                <Button icon={FolderTree} onClick={() => setShowDraftFolder(true)} feedback={{ title: "文件夹草稿已创建" }}>
                  新建文件夹
                </Button>
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
                    <Button tone="danger" icon={Trash2} onClick={() => { setHiddenIds(prev => new Set([...prev, ...selectedIds])); setSelectedIds(new Set()); }} feedback={{ tone: "warning", title: "批量删除需要确认", detail: `${selectedCount} 项` }}>
                      批量删除
                    </Button>
                  </>
                }
                actionsClassName={s.toolbar}
                className={s.batchBar}
                clearIconOnly={false}
                clearLabel="取消"
                label={<>已选择 {selectedCount} 项</>}
                onClear={() => setSelectedIds(new Set())}
                selectedCount={selectedCount}
              />
            ) : null}
            <section className={s.libraryContent}>
              {currentFolderId ? (
                <button className={s.backButton} type="button" onClick={() => {
                  const currentFolder = presetFolderBreadcrumb(category, currentFolderId)[presetFolderBreadcrumb(category, currentFolderId).length - 1];
                  navigateFolder(currentFolder?.parentId ?? null);
                }}>
                  <ArrowLeft width={14} height={14} />
                  返回上级
                </button>
              ) : null}
              {showDraftFolder ? (
                <FolderRow
                  actions={<Button tone="subtle" icon={X} iconOnly ariaLabel="取消新建文件夹" onClick={() => setShowDraftFolder(false)} />}
                  actionsClassName={s.folderRowActions}
                  className={cx(s.folderItem, s.folderDraft)}
                  countLabel="保存中"
                  dragHandleClassName={s.dragHandle}
                  iconClassName={s.folderIcon}
                  leadingIcon={FolderTree}
                  name="新建文件夹"
                  openClassName={s.folderOpen}
                  showChevron={false}
                />
              ) : null}
              <PresetFolderRows category={category} currentFolderId={currentFolderId} onNavigate={navigateFolder} />
              <PresetItemRows
                copiedSourceIds={copiedSourceIds}
                items={orderedVisibleItems}
                onCopy={copyPresetItem}
                onDelete={(id) => setHiddenIds(prev => new Set([...prev, id]))}
                onReorder={setItemOrder}
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

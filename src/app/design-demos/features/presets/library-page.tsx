"use client";

import Link from "next/link";
import { type MouseEvent as ReactMouseEvent, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Copy, Edit3, FolderTree, GripVertical, Plus, Shuffle, Trash2, X } from "lucide-react";

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
import { Button } from "@/components/design-demo-ui/primitives/button";
import { ButtonLink } from "@/components/design-demo-ui/primitives/button";
import { Checkbox } from "@/components/design-demo-ui/primitives/checkbox";
import { EmptyPage } from "@/components/design-demo-ui/primitives/empty-page";
import { PageHeader } from "@/components/design-demo-ui/primitives/page-header";
import { FolderBreadcrumb, FolderRow, SelectionBatchBar, UnitRowShell } from "@/components/design-demo-ui/patterns";
import { StatusBadge } from "@/components/design-demo-ui/primitives/status-badge";
import { cx, demoHref } from "../../routing";
import type { DemoButtonFeedback } from "../../routing";
import { SortableList, useDemoSortable } from "@/components/design-demo-ui/primitives/sortable";

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
  const copyStateLabel = copyState === "copy" ? "本地副本" : copyState === "source" ? "已复制源" : null;

  const openHref = demoHref(href);

  return (
    <div ref={ref} style={style} className={s.presetItemSortableFrame} data-preset-id={item.id}>
      <UnitRowShell
        actions={(
          <>
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
                title: "预设已删除",
                detail: item.name,
              }}
            />
          </>
        )}
        actionsClassName={s.presetItemActions}
        className={cx(s.presetItemRow, copyState === "copy" && s.presetItemRowCopy, copyState === "source" && s.presetItemRowSource)}
        description={<Link className={s.presetItemDescriptionLink} href={openHref}>{item.description}</Link>}
        dragHandle={<GripVertical className={s.categoryDragIcon} {...handleProps} />}
        leading={(
          <Checkbox
            checked={checked}
            label={checked ? `取消选择预制：${item.name}` : `选择预制：${item.name}`}
            onCheckedChange={() => onToggle(item.id)}
            variant="compact"
          />
        )}
        meta={(
          <Link aria-label={openLabel} className={s.presetItemMetaLink} href={openHref}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <em>{item.isLocalCopy && item.sourceName ? `源：${item.sourceName}` : item.meta}</em>
            <ArrowRight className={s.presetItemArrow} />
          </Link>
        )}
        selected={checked}
        title={(
          <Link aria-label={openLabel} className={s.presetItemTitleLink} href={openHref}>
            <span className={s.presetItemNameText}>{item.name}</span>
            {copyStateLabel ? <span className={s.presetInlineState}>{copyStateLabel}</span> : null}
          </Link>
        )}
      />
    </div>
  );
}

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
    return (
      <div className={s.empty}>当前文件夹没有条目</div>
    );
  }

  return (
    <div className={s.presetItemList}>
      <SortableList items={items.map((item) => item.id)} onReorder={onReorder}>
        {items.map((item, index) => {
          const checked = selectedIds.has(item.id);
          const copyState = item.isLocalCopy ? "copy" : copiedSourceIds.has(item.id) ? "source" : undefined;
          return (
            <PresetLibraryItemRow checked={checked} copyState={copyState} index={index} item={item} key={item.id} onCopy={onCopy} onDelete={onDelete} onToggle={onToggle} />
          );
        })}
      </SortableList>
    </div>
  );
}

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

  const [scrollToId] = useState(() => {
    try {
      const v = sessionStorage.getItem("demo-presets-from");
      if (v) { sessionStorage.removeItem("demo-presets-from"); return v; }
    } catch {}
    return undefined;
  });
  const listRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!scrollToId) return;
    const el = listRef.current?.querySelector(`[data-preset-id="${scrollToId}"]`);
    if (el) { el.scrollIntoView({ block: "center", behavior: "instant" }); }
    else {
      const t = setTimeout(() => {
        listRef.current?.querySelector(`[data-preset-id="${scrollToId}"]`)?.scrollIntoView({ block: "center", behavior: "instant" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [scrollToId]);

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
        <div className={s.presetManagerLayout}>
          <PresetCategorySidebar
            categories={visibleCategories}
            categoryOrder={categoryOrder}
            onDeleteCategory={(id) => setHiddenCategoryIds(prev => new Set([...prev, id]))}
            onReorderCategories={setCategoryOrder}
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
                }} feedback={{ title: `${category.type === "group" ? "预设组" : "预设"}创建表单已准备` }}>新建{category.type === "group" ? "预设组" : "预设"}</Button>
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
                  <Button tone="danger" icon={Trash2} onClick={() => { setHiddenIds(prev => new Set([...prev, ...selectedIds])); setSelectedIds(new Set()); }} feedback={{ tone: "warning", title: "批量删除需要确认", detail: `${selectedCount} 项` }}>批量删除</Button>
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
            <section ref={listRef} className={s.presetLibrarySurface}>
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
  const [expanded, setExpanded] = useState(false);
  const orderedCategories = categoryOrder.length
    ? categoryOrder.map((id) => categories.find((c) => c.id === id)).filter((c): c is DemoCategory => Boolean(c))
    : categories;

  return (
    <aside className={s.presetCategorySidebar}>
      <button className={s.presetCategoryHeader} type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <div>
          <span>分类管理</span>
          <strong className={s.presetCategoryHeaderTitle}>{categories.length} 个分类</strong>
          <strong className={s.presetCategoryHeaderSelected}>{selectedCategory.name}</strong>
        </div>
        <ChevronDown className={cx(s.accordionChevron, expanded && s.accordionChevronOpen)} />
      </button>
      <div className={cx(s.presetCategoryList, expanded && s.presetCategoryListExpanded)}>
        <SortableList items={orderedCategories.map((c) => c.id)} onReorder={onReorderCategories}>
          {orderedCategories.map((category) => {
            const selected = selectedCategory.id === category.id;
            return (
              <PresetCategoryRow category={category} key={category.id} onDelete={onDeleteCategory} onSelect={(cat) => { onSelect(cat); setExpanded(false); }} selected={selected} />
            );
          })}
        </SortableList>
      </div>
    </aside>
  );
}

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
    <div ref={ref} style={style} className={cx(s.presetCategoryItem, selected && s.presetCategoryItemActive)}>
      <div className={s.presetCategoryRow}>
        <button className={s.presetCategorySelect} type="button" onClick={() => onSelect(category)}>
          <GripVertical className={s.categoryDragIcon} {...handleProps} />
          <span className={s.categorySwatch} style={{ backgroundColor: categoryColorValue(category.color) }} />
          <span className={s.presetCategoryText}>
            <strong>{category.name}</strong>
            <span>{categoryItemCount(category)} 个{categoryTypeLabel(category)}</span>
          </span>
        </button>
        <div className={s.presetCategoryActions}>
          <ButtonLink href={`/presets/categories/${category.id}/edit`} icon={Edit3} iconOnly ariaLabel="编辑分类" tone="subtle" />
          <Button tone="danger" icon={Trash2} iconOnly ariaLabel="删除分类" disabled={categoryItemCount(category) > 0} onClick={() => onDelete?.(category.id)} />
        </div>
      </div>
    </div>
  );
}

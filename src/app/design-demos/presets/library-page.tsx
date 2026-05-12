"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckSquare, Edit3, FolderTree, GripVertical, Plus, Shuffle, Square, Trash2, X } from "lucide-react";

import type { DemoCategory, DemoData } from "../design-demo-data";
import s from "../styles/library.module.css";
import { Button } from "../ui/button";
import { ButtonLink } from "../ui/button-link";
import { EmptyPage } from "../ui/empty-page";
import { OperationStateStrip } from "../ui/operation-state-strip";
import { PageHeader } from "../ui/page-header";
import { StatusBadge } from "../ui/status-badge";
import { categoryColorValue, categoryItemCount, categoryTypeLabel, cx, demoHref, presetFolderBreadcrumb, presetFolderChildren, presetFolderItemCount, presetFolderOptions, presetLibraryItems } from "../design-demo-utils";
import type { DemoButtonFeedback, PresetLibraryItem } from "../design-demo-utils";

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
        <ButtonLink href="/presets/categories/new" icon={Plus} iconOnly size="sm" ariaLabel="新建分类" tone="subtle" />
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

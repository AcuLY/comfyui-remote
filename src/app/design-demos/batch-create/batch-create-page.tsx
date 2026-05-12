"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FolderTree, Plus, Search, X } from "lucide-react";

import type { DemoData, DemoProject } from "../design-demo-data";
import s from "./batch-create-page.library.module.css";
import { Button } from "../ui/button";
import { EmptyPage } from "../ui/empty-page";
import { PageHeader } from "../ui/page-header";
import { StatusBadge } from "../ui/status-badge";
import { categoryColorValue, categoryTypeLabel, cx, demoHref, presetFolderBreadcrumb, presetFolderChildren, presetFolderItemCount, projectBatchBindings, rawSectionId } from "../design-demo-utils";
import type { BatchImportItem } from "../design-demo-utils";
import { getBatchCandidateRows } from "./batch-candidates";
export function BatchCreatePage({ project, data }: { project: DemoProject | undefined; data: DemoData }) {
  const activeProject = project ?? data.projects[0];
  const [selectedCategoryId, setSelectedCategoryId] = useState(data.categories[0]?.id ?? "");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [importItems, setImportItems] = useState<BatchImportItem[]>([]);
  const [sectionName, setSectionName] = useState("");
  const [aspectRatio, setAspectRatio] = useState(activeProject?.sections[0]?.aspectRatio ?? "2:3");
  const [shortSidePx, setShortSidePx] = useState(activeProject?.sections[0]?.shortSidePx ?? 768);
  const [createdCount, setCreatedCount] = useState(2);
  const category = data.categories.find((item) => item.id === selectedCategoryId) ?? data.categories[0];
  const bindings = activeProject ? projectBatchBindings(activeProject, data.categories) : [];
  const folderPath = category ? presetFolderBreadcrumb(category, currentFolderId) : [];
  const folderChildren = category && !query.trim() ? presetFolderChildren(category, currentFolderId) : [];
  const candidateRows = getBatchCandidateRows({ category, currentFolderId, query });
  const createdSections = activeProject?.sections.slice(0, Math.min(createdCount, 4)) ?? [];

  function changeCategory(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setCurrentFolderId(null);
    setQuery("");
  }

  function addImport(item: BatchImportItem, replaceCategory = false) {
    setImportItems((current) => {
      const scoped = replaceCategory ? current.filter((existing) => existing.categoryId !== item.categoryId) : current;
      if (scoped.some((existing) => existing.key === item.key || existing.id === item.id)) return scoped;
      return [...scoped, item];
    });
    if (!sectionName) setSectionName(item.name);
  }

  function removeImport(key: string) {
    setImportItems((current) => current.filter((item) => item.key !== key));
  }

  function updateImportVariant(key: string, variantId: string) {
    setImportItems((current) => current.map((item) => item.key === key ? {
      ...item,
      variantId,
      meta: item.variants.find((variant) => variant.id === variantId)?.name ?? item.meta,
    } : item));
  }

  if (!activeProject) return <EmptyPage title="没有项目数据" />;

  return (
    <div className={s.page}>
      <PageHeader
        back={{ href: `/projects/${activeProject.id}`, label: "返回项目" }}
        eyebrow="项目"
        title={`${activeProject.title} / 批量创建小节`}
        subtitle="从预设库导入一个或多个预设，覆盖项目已有绑定后创建新的项目小节。"
        actions={<Button tone="primary" icon={Plus} onClick={() => setCreatedCount((count) => count + 1)}>创建小节</Button>}
      />
      <div className={s.batchCreateWorkspace}>
        <section className={s.batchBrowserPane} aria-label="预设浏览器">
          <div className={s.batchPaneHeader}>
            <div>
              <span>预设浏览</span>
              <strong>预设浏览器</strong>
            </div>
            <StatusBadge status={category?.type === "group" ? "template" : "ready"} label={categoryTypeLabel(category ?? null)} />
          </div>

          <div className={s.batchCategoryTabs}>
            {data.categories.map((item) => (
              <button
                aria-pressed={category?.id === item.id}
                key={item.id}
                onClick={() => changeCategory(item.id)}
                type="button"
              >
                <span style={{ background: categoryColorValue(item.color) }} />
                {item.name}
                {item.type === "group" ? <em>组</em> : null}
              </button>
            ))}
          </div>

          <label className={s.batchSearchBox}>
            <Search className={s.icon} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索预设、预设组或 slug" />
            {query ? (
              <button aria-label="清除搜索" type="button" onClick={() => setQuery("")}>
                <X className={s.icon} />
              </button>
            ) : null}
          </label>

          {category ? (
            <div className={s.batchFolderBar}>
              <div className={s.batchBreadcrumbs}>
                <button type="button" onClick={() => setCurrentFolderId(null)} disabled={currentFolderId === null}>根目录</button>
                {folderPath.map((folder) => (
                  <button type="button" key={folder.id} onClick={() => setCurrentFolderId(folder.id)} disabled={folder.id === currentFolderId}>
                    {folder.name}
                  </button>
                ))}
              </div>
              <span>{presetFolderItemCount(category, currentFolderId)} 项</span>
            </div>
          ) : null}

          <div className={s.batchBrowserList}>
            {currentFolderId ? (
              <button
                className={s.batchFolderRow}
                type="button"
                onClick={() => {
                  const current = folderPath[folderPath.length - 1];
                  setCurrentFolderId(current?.parentId ?? null);
                }}
              >
                <ArrowLeft className={s.icon} />
                <strong>返回上级</strong>
                <span>{folderPath[folderPath.length - 1]?.name ?? "当前目录"}</span>
              </button>
            ) : null}

            {folderChildren.map((folder) => (
              <button className={s.batchFolderRow} type="button" key={folder.id} onClick={() => setCurrentFolderId(folder.id)}>
                <FolderTree className={s.icon} />
                <strong>{folder.name}</strong>
                <span>{presetFolderItemCount(category!, folder.id)} 项</span>
              </button>
            ))}

            {candidateRows.map((row) => {
              const selected = importItems.some((item) => item.key === row.item.key || item.id === row.item.id);
              const Icon = row.icon;
              return (
                <div className={cx(s.batchCandidateRow, selected && s.batchCandidateRowSelected)} key={row.key}>
                  <Icon className={s.icon} />
                  <div className={s.batchCandidateMain}>
                    <strong>{row.title}</strong>
                    <span>{row.description}</span>
                  </div>
                  <div className={s.batchCandidateMeta}>
                    <span>{row.meta}</span>
                    <em>{row.item.sourceLabel}</em>
                  </div>
                  <div className={s.batchCandidateActions}>
                    <button type="button" onClick={() => addImport(row.item, true)}>覆盖</button>
                    <button type="button" onClick={() => addImport(row.item)} disabled={selected}>
                      {selected ? "已导入" : "导入"}
                    </button>
                  </div>
                </div>
              );
            })}

            {folderChildren.length === 0 && candidateRows.length === 0 ? (
              <div className={s.batchEmptyState}>当前分类和文件夹下没有可导入条目</div>
            ) : null}
          </div>
        </section>

        <section className={s.batchConfigPane} aria-label="批量创建配置">
          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>导入列表</span>
                <strong>导入列表</strong>
              </div>
              <em>{importItems.length} 项</em>
            </div>
            {importItems.length === 0 ? (
              <div className={s.batchEmptyState}>从左侧选择预设或预设组后，它们会进入这里并参与新小节创建。</div>
            ) : (
              <div className={s.batchImportList}>
                {importItems.map((item) => (
                  <div className={s.batchImportRow} key={item.key}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.sourceLabel} · {item.meta}</span>
                    </div>
                    {item.variants.length > 1 ? (
                      <select value={item.variantId ?? ""} onChange={(event) => updateImportVariant(item.key, event.target.value)}>
                        {item.variants.map((variant) => (
                          <option value={variant.id} key={variant.id}>{variant.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={s.inlineNotice}>{item.kind === "group" ? "组导入" : "单变体"}</span>
                    )}
                    <Button tone="subtle" icon={X} iconOnly size="sm" onClick={() => removeImport(item.key)} ariaLabel="移除导入项" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>项目绑定</span>
                <strong>已有绑定变体</strong>
              </div>
              <em>{bindings.length} 组</em>
            </div>
            <div className={s.batchBindingList}>
              {bindings.map((binding) => (
                <div className={s.batchBindingRow} key={binding.id}>
                  <div>
                    <strong>{binding.name}</strong>
                    <span>{binding.categoryName}</span>
                  </div>
                  <select defaultValue={binding.variants[0]?.id ?? ""}>
                    <option value="">默认</option>
                    {binding.variants.map((variant) => (
                      <option value={variant.id} key={variant.id}>{variant.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>新小节</span>
                <strong>新小节参数</strong>
              </div>
              <StatusBadge status="queued" label="待创建" />
            </div>
            <div className={s.batchFormGrid}>
              <label>
                <span>小节名称</span>
                <input value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder={importItems[0]?.name ?? "留空自动编号"} />
              </label>
              <label>
                <span>短边像素</span>
                <input value={shortSidePx} onChange={(event) => setShortSidePx(Number(event.target.value) || 0)} inputMode="numeric" />
              </label>
            </div>
            <div className={s.batchRatioGrid}>
              {["1:1", "2:3", "3:2", "4:3", "16:9"].map((ratio) => (
                <button aria-pressed={aspectRatio === ratio} type="button" key={ratio} onClick={() => setAspectRatio(ratio)}>
                  {ratio}
                </button>
              ))}
            </div>
            <div className={s.editorStatusStrip}>
              <span>导入 {importItems.length} 项</span>
              <span>{aspectRatio} · {shortSidePx}px</span>
              <span>创建后进入项目小节列表</span>
            </div>
          </div>

          <div className={s.batchConfigSection}>
            <div className={s.batchSectionHeader}>
              <div>
                <span>最近创建</span>
                <strong>最近创建</strong>
              </div>
              <em>{createdSections.length} 条</em>
            </div>
            <div className={s.batchCreatedList}>
              {createdSections.map((section, index) => (
                <Link href={demoHref(`/projects/${activeProject.id}/sections/${rawSectionId(section)}`)} key={section.id}>
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                  <strong>{section.name}</strong>
                  <em>{section.aspectRatio} · 批量 {section.batchSize}</em>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

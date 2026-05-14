"use client";

import { ChevronRight, Folder, GripVertical, X } from "lucide-react";
import type * as React from "react";
import { useId, useState } from "react";

import { cx } from "../../routing";
import { Button } from "../primitives";
import s from "./patterns.module.css";

export function ToolbarCluster({
  align = "end",
  children,
  className,
}: {
  align?: "start" | "end" | "between";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(s.toolbarCluster, align === "start" && s.toolbarStart, align === "between" && s.toolbarBetween, className)}>
      {children}
    </div>
  );
}

export function UnitRowShell({
  actions,
  actionsClassName,
  body,
  bodyClassName,
  className,
  description,
  descriptionClassName,
  dragHandle,
  dragHandleClassName,
  leading,
  leadingClassName,
  mainClassName,
  media,
  mediaClassName,
  meta,
  metaClassName,
  selected = false,
  title,
  titleClassName,
}: {
  actions?: React.ReactNode;
  actionsClassName?: string;
  body?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  description?: React.ReactNode;
  descriptionClassName?: string;
  dragHandle?: React.ReactNode;
  dragHandleClassName?: string;
  leading?: React.ReactNode;
  leadingClassName?: string;
  mainClassName?: string;
  media?: React.ReactNode;
  mediaClassName?: string;
  meta?: React.ReactNode;
  metaClassName?: string;
  selected?: boolean;
  title: React.ReactNode;
  titleClassName?: string;
}) {
  const columns = [dragHandle ? "auto" : null, leading ? "auto" : null, media ? "auto" : null, "minmax(0, 1fr)", meta ? "auto" : null, actions ? "auto" : null]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={cx(s.unitRow, selected && s.unitRowSelected, className)}
      data-demo-pattern="unit-row"
      style={{ "--unit-row-columns": columns } as React.CSSProperties}
    >
      {dragHandle ? <div className={cx(s.unitDrag, dragHandleClassName)}>{dragHandle}</div> : null}
      {leading ? <div className={cx(s.unitLeading, leadingClassName)}>{leading}</div> : null}
      {media ? <div className={cx(s.unitMedia, mediaClassName)}>{media}</div> : null}
      <div className={cx(s.unitMain, mainClassName)}>
        <div className={cx(s.unitTitle, titleClassName)}>{title}</div>
        {description ? <div className={cx(s.unitDescription, descriptionClassName)}>{description}</div> : null}
        {body ? <div className={cx(s.unitBody, bodyClassName)}>{body}</div> : null}
      </div>
      {meta ? <div className={cx(s.unitMeta, metaClassName)}>{meta}</div> : null}
      {actions ? <ToolbarCluster className={cx(s.unitActions, actionsClassName)}>{actions}</ToolbarCluster> : null}
    </article>
  );
}

export function WorkbenchSurface({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cx(s.workbenchSurface, className)}>
      {title || subtitle || actions ? (
        <header className={s.workbenchHeader}>
          <div>
            {title ? <strong>{title}</strong> : null}
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          {actions ? <ToolbarCluster>{actions}</ToolbarCluster> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EditorBlock({
  actions,
  children,
  description,
  title,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <section className={s.editorBlock}>
      <header className={s.editorBlockHeader}>
        <div>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        {actions ? <ToolbarCluster>{actions}</ToolbarCluster> : null}
      </header>
      {children}
    </section>
  );
}

export function InspectorAside({
  children,
  title,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <aside className={s.inspectorAside}>
      <strong>{title}</strong>
      {children}
    </aside>
  );
}

export type FolderBreadcrumbItem = {
  id: string | null;
  label: string;
};

export function FolderBreadcrumb({
  items,
  onNavigate,
  rootLabel = "根目录",
}: {
  items: FolderBreadcrumbItem[];
  onNavigate?: (id: string | null) => void;
  rootLabel?: string;
}) {
  return (
    <nav className={s.folderBreadcrumb} aria-label="文件夹路径">
      <button type="button" onClick={() => onNavigate?.(null)} disabled={!onNavigate || items.length === 0}>
        {rootLabel}
      </button>
      {items.map((item, index) => (
        <span key={`${item.id ?? "root"}-${index}`}>
          <ChevronRight className={s.patternIcon} aria-hidden="true" />
          <button type="button" onClick={() => onNavigate?.(item.id)} disabled={!onNavigate || index === items.length - 1}>
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function FolderRow({
  actions,
  countLabel,
  name,
  onOpen,
}: {
  actions?: React.ReactNode;
  countLabel: string;
  name: string;
  onOpen?: () => void;
}) {
  return (
    <div className={s.folderRow}>
      <Button className={s.dragButton} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" />
      <button className={s.folderOpen} type="button" onClick={onOpen}>
        <Folder className={s.patternIcon} aria-hidden="true" />
        <strong>{name}</strong>
        <span>{countLabel}</span>
        <ChevronRight className={s.patternIcon} aria-hidden="true" />
      </button>
      {actions ? <ToolbarCluster className={s.folderActions}>{actions}</ToolbarCluster> : null}
    </div>
  );
}

export type MoveTargetOption = {
  id: string | null;
  label: string;
  depth?: number;
  countLabel?: string;
};

export function MoveTargetPicker({
  currentId,
  label = "移动",
  onMove,
  options,
}: {
  currentId?: string | null;
  label?: string;
  onMove?: (id: string | null) => void;
  options: MoveTargetOption[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className={s.movePicker}>
      <Button ariaControls={menuId} ariaExpanded={open} ariaHasPopup="menu" tone="subtle" onClick={() => setOpen((value) => !value)}>
        {label}
      </Button>
      {open ? (
        <div className={s.moveMenu} id={menuId} role="menu">
          {options.map((option) => (
            <button
              disabled={option.id === currentId}
              key={option.id ?? "__root"}
              onClick={() => {
                onMove?.(option.id);
                setOpen(false);
              }}
              style={{ "--move-target-indent": `${(option.depth ?? 0) * 12}px` } as React.CSSProperties}
              type="button"
              role="menuitem"
            >
              <span>{option.label}</span>
              {option.countLabel ? <em>{option.countLabel}</em> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SelectionBatchBar({
  actions,
  onClear,
  selectedCount,
  subject = "项",
}: {
  actions?: React.ReactNode;
  onClear?: () => void;
  selectedCount: number;
  subject?: string;
}) {
  return (
    <div className={s.selectionBatchBar}>
      <strong>已选 {selectedCount} {subject}</strong>
      <ToolbarCluster>
        {actions}
        {onClear ? <Button tone="subtle" icon={X} iconOnly ariaLabel="清除选择" onClick={onClear} /> : null}
      </ToolbarCluster>
    </div>
  );
}

export function SortableRowShell({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <div className={s.sortableRow}>
      <GripVertical className={s.patternIcon} aria-hidden="true" />
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div>{children}</div>
    </div>
  );
}

export function AnchorRail({
  items,
}: {
  items: Array<{ id: string; label: string; meta?: string; active?: boolean }>;
}) {
  return (
    <nav className={s.anchorRail} aria-label="页面内导航">
      {items.map((item) => (
        <a aria-current={item.active ? "true" : undefined} href={`#${item.id}`} key={item.id}>
          <strong>{item.label}</strong>
          {item.meta ? <span>{item.meta}</span> : null}
        </a>
      ))}
    </nav>
  );
}

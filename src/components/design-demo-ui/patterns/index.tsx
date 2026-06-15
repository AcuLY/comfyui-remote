"use client";

import { ChevronRight, Folder, GripVertical, X } from "lucide-react";
import type * as React from "react";
import { useId, useState } from "react";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import { Button } from "../primitives";
import type { ButtonTone, RouteIcon } from "../primitives/shared/types";
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
  className,
  contentClassName,
  description,
  headerClassName,
  title,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  description?: React.ReactNode;
  headerClassName?: string;
  title: React.ReactNode;
}) {
  return (
    <section className={cx(s.editorBlock, className)}>
      <header className={cx(s.editorBlockHeader, headerClassName)}>
        <div>
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
        {actions ? <ToolbarCluster>{actions}</ToolbarCluster> : null}
      </header>
      <div className={cx(s.editorBlockContent, contentClassName)}>{children}</div>
    </section>
  );
}

export function InspectorAside({
  actions,
  children,
  className,
  contentClassName,
  headerClassName,
  title,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  title: React.ReactNode;
}) {
  return (
    <aside className={cx(s.inspectorAside, className)}>
      <header className={cx(s.inspectorHeader, headerClassName)}>
        <strong>{title}</strong>
        {actions ? <ToolbarCluster>{actions}</ToolbarCluster> : null}
      </header>
      <div className={cx(s.inspectorContent, contentClassName)}>{children}</div>
    </aside>
  );
}

export type FolderBreadcrumbItem = {
  id: string | null;
  label: string;
};

export function FolderBreadcrumb({
  activeButtonClassName,
  buttonClassName,
  className,
  itemClassName,
  items,
  onNavigate,
  separatorClassName,
  rootLabel = "根目录",
  size = "md",
}: {
  activeButtonClassName?: string;
  buttonClassName?: string;
  className?: string;
  itemClassName?: string;
  items: FolderBreadcrumbItem[];
  onNavigate?: (id: string | null) => void;
  separatorClassName?: string;
  rootLabel?: string;
  size?: "sm" | "md";
}) {
  return (
    <nav className={cx(s.folderBreadcrumb, size === "sm" && s.folderBreadcrumbSm, className)} aria-label="文件夹路径">
      <button
        className={cx(s.folderBreadcrumbButton, buttonClassName, items.length === 0 && activeButtonClassName)}
        type="button"
        onClick={() => onNavigate?.(null)}
        disabled={!onNavigate || items.length === 0}
      >
        {rootLabel}
      </button>
      {items.map((item, index) => (
        <span className={itemClassName} key={`${item.id ?? "root"}-${index}`}>
          <ChevronRight className={cx(s.patternIcon, separatorClassName)} aria-hidden="true" />
          <button
            className={cx(s.folderBreadcrumbButton, buttonClassName, index === items.length - 1 && activeButtonClassName)}
            type="button"
            onClick={() => onNavigate?.(item.id)}
            disabled={!onNavigate || index === items.length - 1}
          >
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function FolderRow({
  actions,
  actionsClassName,
  countLabel,
  className,
  countClassName,
  dragHandleClassName,
  iconClassName,
  leadingIcon: LeadingIcon = Folder,
  name,
  nameClassName,
  onOpen,
  openClassName,
  showChevron = true,
  showDragHandle = true,
}: {
  actions?: React.ReactNode;
  actionsClassName?: string;
  className?: string;
  countLabel: string;
  countClassName?: string;
  dragHandleClassName?: string;
  iconClassName?: string;
  leadingIcon?: RouteIcon;
  name: string;
  nameClassName?: string;
  onOpen?: () => void;
  openClassName?: string;
  showChevron?: boolean;
  showDragHandle?: boolean;
}) {
  return (
    <div className={cx(s.folderRow, !showDragHandle && s.folderRowNoDrag, !actions && s.folderRowNoActions, className)}>
      {showDragHandle ? <Button className={cx(s.dragButton, dragHandleClassName)} tone="subtle" icon={GripVertical} iconOnly ariaLabel="排序手柄" /> : null}
      <button className={cx(s.folderOpen, !showChevron && s.folderOpenNoChevron, openClassName)} type="button" onClick={onOpen}>
        <LeadingIcon className={cx(s.patternIcon, iconClassName)} aria-hidden="true" />
        <strong className={nameClassName}>{name}</strong>
        <span className={countClassName}>{countLabel}</span>
        {showChevron ? <ChevronRight className={cx(s.patternIcon, iconClassName)} aria-hidden="true" /> : null}
      </button>
      {actions ? <ToolbarCluster className={cx(s.folderActions, actionsClassName)}>{actions}</ToolbarCluster> : null}
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
  buttonClassName,
  buttonTone = "subtle",
  className,
  currentId,
  icon,
  iconOnly = false,
  label = "移动",
  menuClassName,
  onMove,
  optionClassName,
  options,
}: {
  buttonClassName?: string;
  buttonTone?: ButtonTone;
  className?: string;
  currentId?: string | null;
  icon?: RouteIcon;
  iconOnly?: boolean;
  label?: string;
  menuClassName?: string;
  onMove?: (id: string | null) => void;
  optionClassName?: string;
  options: MoveTargetOption[];
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  return (
    <div className={cx(s.movePicker, className)}>
      <Button
        ariaControls={menuId}
        ariaExpanded={open}
        ariaHasPopup="menu"
        ariaLabel={label}
        className={buttonClassName}
        icon={icon}
        iconOnly={iconOnly}
        tone={buttonTone}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <div className={cx(s.moveMenu, menuClassName)} id={menuId} role="menu">
          {options.map((option) => (
            <button
              className={optionClassName}
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
  actionsClassName,
  className,
  clearIconOnly = true,
  clearLabel = "清除选择",
  clearTone = "subtle",
  label,
  labelClassName,
  onClear,
  selectedCount,
  subject = "项",
}: {
  actions?: React.ReactNode;
  actionsClassName?: string;
  className?: string;
  clearIconOnly?: boolean;
  clearLabel?: string;
  clearTone?: ButtonTone;
  label?: React.ReactNode;
  labelClassName?: string;
  onClear?: () => void;
  selectedCount: number;
  subject?: string;
}) {
  return (
    <div className={cx(s.selectionBatchBar, className)}>
      <strong className={labelClassName}>{label ?? <>已选 {selectedCount} {subject}</>}</strong>
      <ToolbarCluster className={actionsClassName}>
        {actions}
        {onClear ? (
          <Button tone={clearTone} icon={X} iconOnly={clearIconOnly} ariaLabel={clearLabel} onClick={onClear}>
            {clearLabel}
          </Button>
        ) : null}
      </ToolbarCluster>
    </div>
  );
}

export function SortableRowShell({
  children,
  className,
  contentClassName,
  handleClassName,
  handleProps,
  index,
  indexClassName,
  marker,
  markerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  handleClassName?: string;
  handleProps?: Record<string, unknown>;
  index: number;
  indexClassName?: string;
  marker?: React.ReactNode;
  markerClassName?: string;
}) {
  const columns = ["auto", "auto", marker ? "auto" : null, "minmax(0, 1fr)"].filter(Boolean).join(" ");

  return (
    <div className={cx(s.sortableRow, className)} style={{ "--sortable-row-columns": columns } as React.CSSProperties}>
      <GripVertical
        className={cx(s.patternIcon, handleClassName)}
        aria-hidden="true"
        style={{ cursor: handleProps ? "grab" : undefined }}
        {...(handleProps as React.SVGAttributes<SVGSVGElement>)}
      />
      <span className={indexClassName}>{String(index + 1).padStart(2, "0")}</span>
      {marker ? <div className={cx(s.sortableMarker, markerClassName)}>{marker}</div> : null}
      <div className={contentClassName}>{children}</div>
    </div>
  );
}

export type AnchorRailItem = {
  active?: boolean;
  className?: string;
  href?: string;
  id: string;
  label: string;
  meta?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLElement>;
};

type AnchorRailLinkComponent = React.ComponentType<{
  "aria-current"?: "true";
  children: React.ReactNode;
  className?: string;
  href: string;
  onClick?: React.MouseEventHandler;
}>;

export function AnchorRail({
  ariaLabel = "页面内导航",
  className,
  items,
  linkComponent: LinkComponent,
}: {
  ariaLabel?: string;
  className?: string;
  items: AnchorRailItem[];
  linkComponent?: AnchorRailLinkComponent;
}) {
  return (
    <nav className={cx(s.anchorRail, className)} aria-label={ariaLabel}>
      {items.map((item) => {
        const content = (
          <>
            <strong>{item.label}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </>
        );
        const itemClassName = cx(s.anchorRailItem, item.className);
        const href = item.href ?? `#${item.id}`;

        return LinkComponent ? (
          <LinkComponent aria-current={item.active ? "true" : undefined} className={itemClassName} href={href} key={item.id} onClick={item.onClick}>
            {content}
          </LinkComponent>
        ) : (
          <a aria-current={item.active ? "true" : undefined} className={itemClassName} href={href} key={item.id} onClick={item.onClick}>
            {content}
          </a>
        );
      })}
    </nav>
  );
}

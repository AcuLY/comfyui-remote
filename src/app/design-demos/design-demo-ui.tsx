"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Children, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  ImageIcon,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";

import type { DemoData, DemoImage } from "./design-demo-data";
import { cx, demoHref, sampleRouteInventory } from "./design-demo-utils";
import type { DemoButtonFeedback, DemoToast, DemoToastTone, RouteIcon } from "./design-demo-utils";
import s from "./design-demo-styles";

const DemoFeedbackContext = createContext<{
  pushToast: (toast: Omit<DemoToast, "id">) => void;
} | null>(null);

function useDemoFeedback() {
  return useContext(DemoFeedbackContext) ?? {
    pushToast: () => undefined,
  };
}

export function DemoFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<DemoToast[]>([]);

  const pushToast = useCallback((toast: Omit<DemoToast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [{ id, ...toast }, ...current].slice(0, 3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  return (
    <DemoFeedbackContext.Provider value={{ pushToast }}>
      {children}
      <DemoToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
    </DemoFeedbackContext.Provider>
  );
}

function DemoToastStack({ toasts, onDismiss }: { toasts: DemoToast[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;

  return (
    <div className={s.toastStack} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          className={cx(
            s.toast,
            toast.tone === "success" && s.toastSuccess,
            toast.tone === "warning" && s.toastWarning,
            toast.tone === "error" && s.toastError,
          )}
          key={toast.id}
        >
          <Check className={s.icon} />
          <div>
            <strong>{toast.title}</strong>
            {toast.detail ? <span>{toast.detail}</span> : null}
          </div>
          <button className={s.iconMiniButton} type="button" onClick={() => onDismiss(toast.id)} aria-label="关闭提示">
            <X className={s.icon} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function OperationStateStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: DemoToastTone }>;
}) {
  return (
    <div className={s.operationStateStrip}>
      {items.map((item) => (
        <span
          className={cx(
            s.operationStateItem,
            item.tone === "success" && s.operationStateSuccess,
            item.tone === "warning" && s.operationStateWarning,
            item.tone === "error" && s.operationStateError,
          )}
          key={`${item.label}-${item.value}`}
        >
          <strong>{item.label}</strong>
          {item.value}
        </span>
      ))}
    </div>
  );
}


function statusTone(status: string) {
  const value = status.toLowerCase();
  if (["done", "active", "kept", "healthy", "success", "ready"].includes(value)) return s.statusGreen;
  if (["running", "pending", "queued", "draft"].includes(value)) return s.statusAmber;
  if (["failed", "error", "trashed", "offline"].includes(value)) return s.statusRed;
  if (["review", "monitor", "template", "featured"].includes(value)) return s.statusSky;
  return "";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "启用",
    done: "完成",
    draft: "草稿",
    error: "错误",
    failed: "失败",
    healthy: "正常",
    kept: "保留",
    monitor: "监控",
    offline: "离线",
    pending: "待处理",
    queued: "排队中",
    ready: "就绪",
    review: "审核",
    running: "运行中",
    success: "成功",
    template: "模板",
    trashed: "删除",
  };
  return labels[status.toLowerCase()] ?? status;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cx(s.status, statusTone(status))}>{label ?? statusLabel(status)}</span>;
}

function controlLabel(children: React.ReactNode, ariaLabel?: string) {
  if (ariaLabel) return ariaLabel;
  if (typeof children === "string" || typeof children === "number") return String(children);
  return "按钮";
}

function imageTagLabels(image: DemoImage) {
  return [
    image.featured ? "p站" : null,
    image.featured2 ? "预览" : null,
    image.cover ? "封面" : null,
  ].filter((item): item is string => Boolean(item));
}

function imageReviewLabel(status: DemoImage["status"]) {
  if (status === "pending") return "待审";
  if (status === "kept") return "保留";
  return "删除";
}

function preventReadonlyEdit(event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.preventDefault();
}

export type FloatingSelectOption = {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
};

export function FloatingSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  valueClassName,
  displayValue,
  leadingIcon,
  endSlot,
  disabled,
}: {
  value: string;
  options: FloatingSelectOption[];
  onChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  valueClassName?: string;
  displayValue?: ReactNode;
  leadingIcon?: ReactNode;
  endSlot?: ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.max(rect.width, 160);
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const maxHeight = Math.max(160, window.innerHeight - rect.bottom - viewportPadding - 6);
    setMenuStyle({
      left,
      maxHeight,
      top: rect.bottom + 4,
      width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  const portalTarget = open && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`.${s.shell}`) ?? document.body
    : null;

  return (
    <div className={cx(s.floatingSelect, className)} ref={wrapRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={cx(s.floatingSelectBtn, buttonClassName)}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        {leadingIcon}
        <span className={cx(s.floatingSelectValue, valueClassName)}>
          {displayValue ?? selected?.label ?? selected?.value ?? value}
        </span>
        {endSlot}
        <ChevronDown aria-hidden="true" />
      </button>
      {open && portalTarget ? createPortal(
        <div
          className={cx(s.floatingSelectMenu, menuClassName)}
          ref={menuRef}
          role="listbox"
          style={menuStyle}
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={cx(s.floatingSelectOption, optionClassName)}
              data-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <span>{option.label ?? option.value}</span>
              {option.description ? <em>{option.description}</em> : null}
            </button>
          ))}
        </div>,
        portalTarget,
      ) : null}
    </div>
  );
}

export function ImageThumbSmall({
  image,
  priority = false,
  wide = false,
}: {
  image: DemoImage;
  priority?: boolean;
  wide?: boolean;
}) {
  return (
    <span className={cx(s.imageThumbSmall, wide && s.imageThumbSmallWide)}>
      {image.src ? (
        <img
          src={image.src}
          alt=""
          fetchPriority={priority ? "high" : "auto"}
          loading="eager"
        />
      ) : (
        <ImageIcon className="size-5" />
      )}
    </span>
  );
}

export function ImageThumbMedium({
  actionSlot,
  image,
  onOpen,
  onSelect,
  priority = false,
  selectable = false,
  selected = false,
  showStatus = true,
  tags = imageTagLabels(image),
}: {
  actionSlot?: React.ReactNode;
  image: DemoImage;
  onOpen?: () => void;
  onSelect?: () => void;
  priority?: boolean;
  selectable?: boolean;
  selected?: boolean;
  showStatus?: boolean;
  tags?: string[];
}) {
  return (
    <article className={cx(s.imageThumbMedium, selected && s.imageThumbMediumSelected)}>
      {selectable ? (
        <button
          className={s.imageThumbSelect}
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          aria-label={selected ? "取消选择" : "选择图片"}
        >
          {selected ? <Check className={s.icon} /> : <Square className={s.icon} />}
        </button>
      ) : null}
      {tags.length > 0 ? (
        <div className={s.imageThumbTags}>
          {tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      ) : null}
      <button className={s.imageThumbImageButton} type="button" onClick={onOpen} aria-label="查看图片">
        {image.src ? (
          <img
            src={image.src}
            alt=""
            fetchPriority={priority ? "high" : "auto"}
            loading="eager"
          />
        ) : (
          <ImageIcon className="size-6" />
        )}
      </button>
      {showStatus ? (
        <div className={s.imageThumbOverlay}>
          <StatusBadge status={image.status} label={imageReviewLabel(image.status)} />
        </div>
      ) : null}
      {actionSlot ? <div className={cx(s.imageThumbActions, !showStatus && s.imageThumbActionsFlush)}>{actionSlot}</div> : null}
    </article>
  );
}

function ImagePreviewFrame({
  image,
  interactive = false,
  onOpen,
  priority = false,
}: {
  image: DemoImage;
  interactive?: boolean;
  onOpen?: () => void;
  priority?: boolean;
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const panBounds = useCallback((scale: number) => {
    const frame = frameRef.current;
    const imageNode = imageRef.current;
    if (!frame || !imageNode) return { x: 0, y: 0 };
    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    const imageWidth = imageNode.offsetWidth;
    const imageHeight = imageNode.offsetHeight;
    return {
      x: Math.max(0, (imageWidth * scale - frameWidth) / 2),
      y: Math.max(0, (imageHeight * scale - frameHeight) / 2),
    };
  }, []);

  const clampView = useCallback((next: { scale: number; x: number; y: number }) => {
    if (next.scale <= 1) return { scale: 1, x: 0, y: 0 };
    const bounds = panBounds(next.scale);
    return {
      scale: next.scale,
      x: Math.min(bounds.x, Math.max(-bounds.x, next.x)),
      y: Math.min(bounds.y, Math.max(-bounds.y, next.y)),
    };
  }, [panBounds]);

  useEffect(() => {
    const node = frameRef.current;
    if (!interactive || !node) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setView((current) => {
        const nextScale = Math.min(5, Math.max(1, Number((current.scale + direction * 0.18).toFixed(2))));
        return clampView({ ...current, scale: nextScale });
      });
    }

    node.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleNativeWheel);
  }, [clampView, interactive]);

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || view.scale <= 1 || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      originX: view.x,
      originY: view.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!interactive || !drag || drag.pointerId !== event.pointerId) return;
    setView((current) => clampView({
      scale: current.scale,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const isLandscapeImage = image.width !== null && image.height !== null
    ? image.width >= image.height
    : false;
  const interactiveImageStyle: CSSProperties | undefined = interactive
    ? {
        height: isLandscapeImage ? "auto" : "100%",
        left: `calc(50% + ${view.x}px)`,
        top: `calc(50% + ${view.y}px)`,
        transform: `translate(-50%, -50%) scale(${view.scale})`,
        width: isLandscapeImage ? "100%" : "auto",
      }
    : undefined;

  const content = image.full || image.src ? (
    <img
      src={image.full || image.src}
      alt=""
      className={cx(s.imageFill, interactive && s.imagePreviewInteractiveImage)}
      fetchPriority={priority ? "high" : "auto"}
      loading="eager"
      draggable={false}
      ref={imageRef}
      style={interactiveImageStyle}
    />
  ) : (
    <ImageIcon className="size-8" />
  );

  if (onOpen) {
    return (
      <button className={s.imagePreviewFrame} type="button" onClick={onOpen} aria-label="Open image preview">
        {content}
      </button>
    );
  }

  return (
    <div
      className={cx(
        s.imagePreviewFrame,
        interactive && s.imagePreviewFrameInteractive,
        interactive && view.scale > 1 && s.imagePreviewFrameZoomed,
        isDragging && s.imagePreviewFrameDragging,
      )}
      onDoubleClick={interactive ? resetView : undefined}
      onPointerCancel={interactive ? handlePointerUp : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? handlePointerUp : undefined}
      ref={frameRef}
    >
      {content}
    </div>
  );
}

export function ImagePreviewLarge({
  actions,
  image,
  meta,
  onClose,
  onNext,
  onPrevious,
  nextDisabled = false,
  previousDisabled = false,
  title,
}: {
  actions?: React.ReactNode;
  image: DemoImage;
  meta?: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  nextDisabled?: boolean;
  previousDisabled?: boolean;
  title?: string;
}) {
  const hasNavigation = Boolean(onPrevious || onNext);
  const hasFooter = hasNavigation || Boolean(actions);

  return (
    <div className={s.lightboxOverlay} role="dialog" aria-modal="true" aria-label="图片预览">
      <div className={s.lightboxPanel}>
        <div className={s.lightboxChrome}>
          <div>
            <strong>{title ?? image.label}</strong>
            {meta ? <span>{meta}</span> : null}
          </div>
          <button className={s.iconMiniButton} type="button" onClick={onClose} aria-label="关闭预览">
            <X className={s.icon} />
          </button>
        </div>
        <div className={s.lightboxImage}>
          <ImagePreviewFrame image={image} interactive key={image.id} priority />
        </div>
        {hasFooter ? (
          <div className={s.lightboxFooter}>
            {hasNavigation ? (
              <div className={s.lightboxNavigation}>
                <Button tone="subtle" icon={ArrowLeft} onClick={onPrevious} disabled={!onPrevious || previousDisabled}>
                  上一张
                </Button>
                <Button tone="subtle" icon={ArrowRight} onClick={onNext} disabled={!onNext || nextDisabled}>
                  下一张
                </Button>
              </div>
            ) : null}
            {actions ? <div className={s.lightboxActions}>{actions}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
  className,
}: {
  href: string;
  children?: React.ReactNode;
  tone?: "default" | "subtle" | "primary" | "pink" | "danger";
  icon?: RouteIcon;
  iconOnly?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const label = iconOnly ? controlLabel(children, ariaLabel) : undefined;

  return (
    <Link
      href={demoHref(href)}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cx(
        s.button,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        iconOnly && s.buttonIconOnly,
        className,
      )}
    >
      {Icon ? <Icon className={s.buttonIcon} /> : null}
      {iconOnly ? null : children}
    </Link>
  );
}

export function Button({
  children,
  tone = "default",
  icon: Icon,
  iconOnly = false,
  ariaLabel,
  onClick,
  pressed,
  pending = false,
  disabled = false,
  feedback,
  className,
}: {
  children?: React.ReactNode;
  tone?: "default" | "subtle" | "primary" | "pink" | "danger";
  icon?: RouteIcon;
  iconOnly?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  feedback?: DemoButtonFeedback;
  className?: string;
}) {
  const { pushToast } = useDemoFeedback();
  const label = iconOnly ? controlLabel(children, ariaLabel) : undefined;

  function handleClick() {
    if (disabled || pending) return;
    onClick?.();
    if (feedback) {
      if (typeof feedback === "string") {
        pushToast({ tone: "success", title: feedback });
      } else {
        pushToast({ tone: feedback.tone ?? "success", title: feedback.title, detail: feedback.detail });
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={iconOnly ? label : undefined}
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      title={iconOnly ? label : undefined}
      disabled={disabled || pending}
      className={cx(
        s.button,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        pending && s.buttonPending,
        iconOnly && s.buttonIconOnly,
        className,
      )}
    >
      {pending ? <Activity className={cx(s.buttonIcon, s.buttonSpinner)} /> : Icon ? <Icon className={s.buttonIcon} /> : null}
      {iconOnly ? null : children}
    </button>
  );
}

export function PageHeader({
  back,
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  back?: { href: string; label: string };
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cx(s.pageHeader, className)}>
      <div className={s.pageTitleBlock}>
        {back ? (
          <ButtonLink href={back.href} tone="subtle" icon={ArrowLeft} className={s.pageBackLink}>
            {back.label}
          </ButtonLink>
        ) : null}
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle ? <div className={s.pageSubtitle}>{subtitle}</div> : null}
      </div>
      {actions ? <div className={s.toolbar}>{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actions ? <div className={s.inlineControls}>{actions}</div> : null}
      </div>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}

export function MetricCard({ icon: Icon, label, value, meta, tone }: { icon: RouteIcon; label: string; value: string | number; meta: string; tone?: string }) {
  return (
    <div className={s.metric}>
      <div className={s.metricLabel}>
        <Icon className={cx("size-4", tone)} />
        {label}
      </div>
      <div className={s.metricValue}>{value}</div>
      <div className={s.metricMeta}>{meta}</div>
    </div>
  );
}

export function ImageListSmall({
  className,
  images,
  limit = 10,
  maxWidth,
  wide = false,
}: {
  className?: string;
  images: DemoImage[];
  limit?: number;
  maxWidth?: number | string;
  wide?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const visibleImages = images.slice(0, limit);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    let rafId = 0;
    const updateOverflow = () => {
      rafId = 0;
      const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
      const next = {
        left: node.scrollLeft > 1,
        right: node.scrollLeft < maxScrollLeft - 1,
      };
      setOverflow((current) => current.left === next.left && current.right === next.right ? current : next);
    };
    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateOverflow);
    };

    scheduleUpdate();
    node.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(node);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      node.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [visibleImages.length, maxWidth, wide]);

  if (images.length === 0) {
    return <div className={s.empty}>没有可用图片</div>;
  }
  const style: CSSProperties | undefined = maxWidth === undefined
    ? undefined
    : { maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth };
  return (
    <div
      className={cx(s.imageListSmallFrame, className)}
      data-overflow-left={overflow.left}
      data-overflow-right={overflow.right}
      style={style}
    >
      <div className={cx(s.imageListSmall, s.imageStrip)} ref={scrollRef}>
        {visibleImages.map((image, index) => (
          <ImageThumbSmall image={image} key={`${image.id}-${index}`} priority={index === 0} wide={wide} />
        ))}
      </div>
    </div>
  );
}

export function ImageStrip({ images, wide = false }: { images: DemoImage[]; wide?: boolean }) {
  return <ImageListSmall images={images} wide={wide} />;
}

type ImageListMediumStyle = CSSProperties & {
  "--demo-image-list-gap"?: string;
  "--demo-image-list-max-height"?: string;
  "--demo-image-list-max-width"?: string;
};

export function ImageListMedium({
  actionPanel,
  children,
  className,
  defaultExpanded = false,
  emptyLabel = "没有可用图片",
  gap,
  maxHeight,
  maxWidth,
  selectPanel,
  summary,
}: {
  actionPanel?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
  emptyLabel?: string;
  gap?: number;
  maxHeight?: number | string;
  maxWidth?: number | string;
  selectPanel?: React.ReactNode;
  summary?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const childrenArray = Children.toArray(children).filter(Boolean);
  const hasItems = childrenArray.length > 0;
  const collapsible = maxHeight !== undefined;
  const style: ImageListMediumStyle = {};
  if (gap !== undefined) style["--demo-image-list-gap"] = `${gap}px`;
  if (maxHeight !== undefined) style["--demo-image-list-max-height"] = typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;
  if (maxWidth !== undefined) style["--demo-image-list-max-width"] = typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth;

  if (!hasItems) return <div className={s.empty}>{emptyLabel}</div>;

  return (
    <div className={cx(s.imageListMedium, className)} style={style}>
      <div className={s.imageListMediumMain}>
        {summary || selectPanel ? (
          <div className={s.imageListMediumHeader}>
            {summary ? <div className={s.imageListMediumSummary}>{summary}</div> : <span />}
            {selectPanel ? <div className={s.imageListMediumSelectPanel}>{selectPanel}</div> : null}
          </div>
        ) : null}
        <div className={s.imageListMediumViewport} data-expanded={!collapsible || expanded}>
          <div className={s.imageListMediumGrid}>
            {childrenArray}
          </div>
          {collapsible && !expanded ? <div className={s.imageListMediumFade} aria-hidden="true" /> : null}
        </div>
        {collapsible ? (
          <button className={s.imageListMediumExpand} type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? <ChevronUp className={s.icon} /> : <ChevronDown className={s.icon} />}
            {expanded ? "收起" : "展开全部"}
          </button>
        ) : null}
      </div>
      {actionPanel ? (
        <div className={s.imageListMediumActionTrack}>
          <div className={s.imageListMediumActionPanel}>{actionPanel}</div>
        </div>
      ) : null}
    </div>
  );
}

export function ImageGrid({
  images,
  showStatus = true,
  selectable = false,
}: {
  images: DemoImage[];
  showStatus?: boolean;
  selectable?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current === null ? 0 : Math.max(current - 1, 0)));
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current === null ? 0 : Math.min(current + 1, images.length - 1)));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  if (images.length === 0) return <div className={s.empty}>没有可用图片</div>;
  const portalTarget = activeImage && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`.${s.shell}`) ?? document.body
    : null;
  return (
    <>
      <ImageListMedium>
        {images.map((image, index) => (
          <ImageThumbMedium
            image={image}
            key={`${image.id}-${index}`}
            onOpen={() => setActiveIndex(index)}
            priority={index === 0}
            selectable={selectable}
            showStatus={showStatus}
            tags={[]}
          />
        ))}
      </ImageListMedium>
      {activeImage && portalTarget ? createPortal(
        <ImagePreviewLarge
          image={activeImage}
          meta={`${activeIndex! + 1} / ${images.length}`}
          onClose={() => setActiveIndex(null)}
          onNext={() => setActiveIndex((current) => (current === null ? 0 : Math.min(current + 1, images.length - 1)))}
          onPrevious={() => setActiveIndex((current) => (current === null ? 0 : Math.max(current - 1, 0)))}
          nextDisabled={activeIndex === images.length - 1}
          previousDisabled={activeIndex === 0}
          actions={(
            <>
              <Button icon={Check} feedback={{ title: "图片已加入保留队列", detail: activeImage.label }}>
                保留
              </Button>
              <Button tone="pink" icon={Star} feedback={{ title: "图片已加入精选队列", detail: activeImage.label }}>
                精选
              </Button>
              <Button tone="pink" icon={Eye} feedback={{ title: "图片已加入预览队列", detail: activeImage.label }}>
                预览
              </Button>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "图片已加入删除队列", detail: activeImage.label }}>
                删除
              </Button>
              <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </>
          )}
        />,
        portalTarget,
      ) : null}
    </>
  );
}

export function ReviewImageBoard({ images }: { images: DemoImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const activeImage = activeIndex === null ? null : images[activeIndex] ?? null;
  const pendingIds = images.filter((image) => image.status === "pending").map((image) => image.id);
  const visibleIds = new Set(images.map((image) => image.id));
  const selectedVisibleIds = new Set([...selectedIds].filter((id) => visibleIds.has(id)));
  const selectedCount = selectedVisibleIds.size;
  const allSelected = images.length > 0 && selectedCount === images.length;
  const pendingOnlySelected = pendingIds.length > 0 && selectedCount === pendingIds.length && pendingIds.every((id) => selectedVisibleIds.has(id));
  const portalTarget = activeImage && typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(`.${s.shell}`) ?? document.body
    : null;

  useEffect(() => {
    if (activeIndex === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveIndex(null);
        return;
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length));
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current === null ? 0 : (current + 1) % images.length));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length]);

  function toggleImage(imageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }

  if (images.length === 0) return <div className={s.empty}>当前筛选下没有图片</div>;

  const hasSelection = selectedCount > 0;
  const actionTargetCount = hasSelection ? selectedCount : images.length;

  return (
    <>
      <ImageListMedium
        className={s.reviewControlStrip}
        maxHeight={520}
        summary={hasSelection ? `已选 ${selectedCount} 张` : "未选择图片"}
        selectPanel={(
          <>
            <Button icon={CheckSquare} pressed={allSelected} onClick={() => setSelectedIds(allSelected ? new Set() : new Set(images.map((image) => image.id)))}>
              {allSelected ? "取消全选" : "全选"}
            </Button>
            <Button icon={Square} pressed={pendingOnlySelected} onClick={() => setSelectedIds(new Set(pendingIds))}>
              待审
            </Button>
            <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())} disabled={selectedCount === 0}>取消选择</Button>
          </>
        )}
        actionPanel={(
          <>
            <Button tone="primary" icon={Check} className={s.reviewActionKeep} feedback={{ title: "已加入保留队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "保留" : "全部保留"}</Button>
            <Button tone="pink" icon={Star} className={s.reviewActionFeatured} disabled={selectedCount === 0} feedback={{ title: "已加入 p站 标记队列", detail: `${selectedCount} 张图片` }}>p站</Button>
            <Button tone="pink" icon={Eye} className={s.reviewActionFeatured} disabled={selectedCount === 0} feedback={{ title: "已加入预览标记队列", detail: `${selectedCount} 张图片` }}>预览</Button>
            <Button tone="subtle" icon={ImageIcon} className={s.reviewActionCover} disabled={selectedCount !== 1} feedback={{ title: "已设为封面", detail: "1 张图片" }}>封面</Button>
            <Button tone="danger" icon={Trash2} className={s.reviewActionDelete} feedback={{ tone: "warning", title: "已加入删除队列", detail: `${actionTargetCount} 张图片` }}>{hasSelection ? "删除" : "全部删除"}</Button>
            <Button tone="subtle" icon={Archive} className={s.reviewActionUndo} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销最近操作</Button>
          </>
        )}
      >
        {images.map((image, index) => {
          const selected = selectedIds.has(image.id);
          const hasStatusOverlay = image.status === "kept" || image.status === "trashed";
          return (
            <ImageThumbMedium
              image={image}
              key={`${image.id}-${index}`}
              onOpen={() => setActiveIndex(index)}
              onSelect={() => toggleImage(image.id)}
              selectable
              selected={selected}
              showStatus={hasStatusOverlay}
            />
          );
        })}
      </ImageListMedium>

      {activeImage && portalTarget ? createPortal(
        <ImagePreviewLarge
          image={activeImage}
          meta={`${activeIndex! + 1} / ${images.length} · ${activeImage.status}`}
          onClose={() => setActiveIndex(null)}
          onNext={() => setActiveIndex((current) => (current === null ? 0 : (current + 1) % images.length))}
          onPrevious={() => setActiveIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length))}
          actions={(
            <>
              <Button icon={Check} feedback={{ title: "图片已加入保留队列", detail: activeImage.label }}>
                保留
              </Button>
              <Button tone="pink" icon={Star} feedback={{ title: "图片已加入精选队列", detail: activeImage.label }}>
                精选
              </Button>
              <Button tone="pink" icon={Eye} feedback={{ title: "图片已加入预览队列", detail: activeImage.label }}>
                预览
              </Button>
              <Button tone="danger" icon={Trash2} feedback={{ tone: "warning", title: "图片已加入删除队列", detail: activeImage.label }}>
                删除
              </Button>
              <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </>
          )}
        />,
        portalTarget,
      ) : null}
    </>
  );
}

export function Field({ label, value, disabled = false }: { label: string; value: string | number; disabled?: boolean }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <input
        aria-readonly="true"
        className={s.input}
        disabled={disabled}
        onBeforeInput={preventReadonlyEdit}
        onChange={() => undefined}
        onDrop={preventReadonlyEdit}
        onPaste={preventReadonlyEdit}
        value={value}
      />
    </div>
  );
}

export function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.textAreaField}>
      <label>{label}</label>
      <textarea
        aria-readonly="true"
        className={s.textarea}
        onBeforeInput={preventReadonlyEdit}
        onChange={() => undefined}
        onDrop={preventReadonlyEdit}
        onPaste={preventReadonlyEdit}
        value={value}
      />
    </div>
  );
}

export function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <FloatingSelect
        ariaLabel={label}
        buttonClassName={s.select}
        className={s.selectShell}
        onChange={() => undefined}
        options={[{ value }]}
        value={value}
      />
    </div>
  );
}

export type SegmentedControlItem<T extends string | number> = {
  value: T;
  label: React.ReactNode;
  count?: number;
  disabled?: boolean;
};

export function SegmentedControl<T extends string | number>({
  items,
  value,
  onChange,
  ariaLabel,
  role = "radiogroup",
  panel = false,
  compact = false,
  className,
}: {
  items: Array<SegmentedControlItem<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  role?: "tablist" | "radiogroup";
  panel?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cx(
        s.segmentedControl,
        panel && s.segmentedControlPanel,
        compact && s.segmentedControlCompact,
        className,
      )}
      data-panel={panel ? "surface" : undefined}
      role={role}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            aria-checked={role === "radiogroup" ? active : undefined}
            aria-selected={role === "tablist" ? active : undefined}
            className={cx(s.segmentedItem, active && s.segmentedItemActive)}
            disabled={item.disabled}
            key={String(item.value)}
            onClick={() => onChange(item.value)}
            role={role === "tablist" ? "tab" : "radio"}
            type="button"
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? <span className={s.segmentedCount}>{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function DemoTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <SegmentedControl
      ariaLabel="切换视图"
      items={tabs.map((tab) => ({ value: tab.key, label: tab.label, count: tab.count }))}
      onChange={onChange}
      role="tablist"
      value={value}
    />
  );
}

export function Switch({
  checked,
  defaultChecked = true,
  ariaLabel = "切换开关",
  onCheckedChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  ariaLabel?: string;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isChecked = checked ?? internalChecked;

  function toggleSwitch() {
    const next = !isChecked;
    if (checked === undefined) setInternalChecked(next);
    onCheckedChange?.(next);
  }

  return (
    <button
      aria-label={ariaLabel}
      aria-checked={isChecked}
      className={s.switch}
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={toggleSwitch}
      role="switch"
      type="button"
    >
      <span className={s.switchThumb} aria-hidden="true" />
    </button>
  );
}

export function SwitchRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Switch ariaLabel={title} />
    </div>
  );
}


export function EmptyRows({ label }: { label: string }) {
  return <div className={s.empty}>{label}</div>;
}

export function RouteTable({ data }: { data: DemoData }) {
  const rows = sampleRouteInventory(data);
  return (
    <Panel title="完整页面路径" subtitle="工作区路径。">
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>页面</th>
              <th>真实路由</th>
              <th>路径</th>
              <th>分组</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.pattern}>
                <td>{row.title}</td>
                <td><code>{row.pattern}</code></td>
                <td><code>{demoHref(row.sample)}</code></td>
                <td>{row.group}</td>
                <td>
                  <Link className={s.button} href={demoHref(row.sample)}>
                    进入 <ArrowRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}


export function EmptyPage({ title }: { title: string }) {
  return (
    <div className={s.page}>
      <PageHeader eyebrow="空状态" title={title} subtitle="当前没有可用数据。" />
      <div className={s.empty}>{title}</div>
    </div>
  );
}

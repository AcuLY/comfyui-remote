"use client";

/* eslint-disable @next/next/no-img-element -- Local design shell previews use direct API image URLs. */

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
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
import s from "./design-demo.module.css";

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

export function ButtonLink({
  href,
  children,
  tone = "default",
  icon: Icon,
  className,
}: {
  href: string;
  children: React.ReactNode;
  tone?: "default" | "subtle" | "primary" | "pink" | "danger";
  icon?: RouteIcon;
  className?: string;
}) {
  return (
    <Link
      href={demoHref(href)}
      className={cx(
        s.button,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        className,
      )}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </Link>
  );
}

export function Button({
  children,
  tone = "default",
  icon: Icon,
  onClick,
  pressed,
  pending = false,
  disabled = false,
  feedback,
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "subtle" | "primary" | "pink" | "danger";
  icon?: RouteIcon;
  onClick?: () => void;
  pressed?: boolean;
  pending?: boolean;
  disabled?: boolean;
  feedback?: DemoButtonFeedback;
  className?: string;
}) {
  const { pushToast } = useDemoFeedback();

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
      aria-pressed={pressed}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      className={cx(
        s.button,
        tone === "subtle" && s.buttonSubtle,
        tone === "primary" && s.buttonPrimary,
        tone === "pink" && s.buttonPink,
        tone === "danger" && s.buttonDanger,
        pending && s.buttonPending,
        className,
      )}
    >
      {pending ? <Activity className={cx("size-4", s.buttonSpinner)} /> : Icon ? <Icon className="size-4" /> : null}
      {children}
    </button>
  );
}

export function PageHeader({
  back,
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  back?: { href: string; label: string };
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={s.pageHeader}>
      <div className={s.pageTitleBlock}>
        {back ? (
          <ButtonLink href={back.href} tone="subtle" icon={ArrowLeft} className={s.pageBackLink}>
            {back.label}
          </ButtonLink>
        ) : null}
        <span className={s.eyebrow}>{eyebrow}</span>
        <h1 className={s.pageTitle}>{title}</h1>
        <div className={s.pageSubtitle}>{subtitle}</div>
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

export function ImageStrip({ images, wide = false }: { images: DemoImage[]; wide?: boolean }) {
  if (images.length === 0) {
    return <div className={s.empty}>没有可用图片</div>;
  }
  return (
    <div className={s.imageStrip}>
      {images.slice(0, 10).map((image, index) => (
        <div className={cx(s.thumb, wide && s.thumbWide)} key={`${image.id}-${index}`}>
          {image.src ? (
            <img
              src={image.src}
              alt=""
              className={s.imageFill}
              fetchPriority={index === 0 ? "high" : "auto"}
              loading="eager"
            />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </div>
      ))}
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
      <div className={s.imageGrid}>
        {images.map((image, index) => (
          <button className={s.imageTile} key={`${image.id}-${index}`} type="button" onClick={() => setActiveIndex(index)}>
            {selectable ? (
              <span className={s.imageTileCheck} aria-hidden="true">
                <Square className={s.icon} />
              </span>
            ) : null}
            {image.src ? (
              <img
                src={image.src}
                alt=""
                className={s.imageFill}
                fetchPriority={index === 0 ? "high" : "auto"}
                loading="eager"
              />
            ) : null}
            <div className={s.imageTileBar}>
              <span className={s.imageTileLabel}>{image.label}</span>
              {showStatus ? <StatusBadge status={image.status} /> : null}
            </div>
          </button>
        ))}
      </div>
      {activeImage && portalTarget ? createPortal(
        <div className={s.lightboxOverlay} role="dialog" aria-modal="true" aria-label="图片预览">
          <div className={s.lightboxPanel}>
            <div className={s.lightboxChrome}>
              <div>
                <strong>{activeImage.label}</strong>
                <span>{activeIndex! + 1} / {images.length}</span>
              </div>
              <button className={s.iconMiniButton} type="button" onClick={() => setActiveIndex(null)} aria-label="关闭预览">
                <X className={s.icon} />
              </button>
            </div>
            <div className={s.lightboxImage}>
              {activeImage.src ? (
                <img
                  src={activeImage.src}
                  alt=""
                  className={s.imageFill}
                  fetchPriority="high"
                  loading="eager"
                />
              ) : null}
            </div>
            <div className={s.lightboxActions}>
              <Button
                tone="subtle"
                icon={ArrowLeft}
                onClick={() => setActiveIndex((current) => (current === null ? 0 : Math.max(current - 1, 0)))}
              >
                上一张
              </Button>
              <Button
                tone="subtle"
                icon={ArrowRight}
                onClick={() => setActiveIndex((current) => (current === null ? 0 : Math.min(current + 1, images.length - 1)))}
              >
                下一张
              </Button>
              <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </div>
          </div>
        </div>,
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

  return (
    <>
      <div className={s.reviewControlStrip}>
        <div>
          <strong>{selectedCount > 0 ? `已选 ${selectedCount} 张` : "未选择图片"}</strong>
          <span>{pendingIds.length} 张待审 · {images.length} 张当前可见</span>
        </div>
        <div className={s.toolbar}>
          <Button icon={CheckSquare} onClick={() => setSelectedIds(selectedCount === images.length ? new Set() : new Set(images.map((image) => image.id)))}>
            {selectedCount === images.length ? "取消全选" : "全选"}
          </Button>
          <Button icon={Square} onClick={() => setSelectedIds(new Set(pendingIds))}>只选待审</Button>
          <Button tone="subtle" icon={X} onClick={() => setSelectedIds(new Set())} disabled={selectedCount === 0}>取消选择</Button>
        </div>
      </div>

      <div className={s.reviewImageGrid}>
        {images.map((image, index) => {
          const selected = selectedIds.has(image.id);
          const hasStatusOverlay = image.status === "kept" || image.status === "trashed";
          return (
            <article className={cx(s.reviewTile, selected && s.reviewTileSelected)} key={`${image.id}-${index}`}>
              <button className={s.reviewSelectButton} type="button" onClick={() => toggleImage(image.id)} aria-pressed={selected} aria-label={selected ? "取消选择" : "选择图片"}>
                {selected ? <Check className={s.icon} /> : null}
              </button>
              {(image.featured || image.featured2 || image.cover) ? (
                <div className={s.reviewMarkers}>
                  {image.featured ? <span>p站</span> : null}
                  {image.featured2 ? <span>预览</span> : null}
                  {image.cover ? <span>封面</span> : null}
                </div>
              ) : null}
              <button className={s.reviewImageButton} type="button" onClick={() => setActiveIndex(index)}>
                {image.src ? <img src={image.src} alt="" className={s.imageFill} loading="eager" /> : null}
                {hasStatusOverlay ? (
                  <span className={s.reviewTileStatus} data-status={image.status}>
                    <StatusBadge status={image.status} />
                  </span>
                ) : null}
              </button>
            </article>
          );
        })}
      </div>

      <div className={s.reviewBulkBar}>
        <span>{selectedCount > 0 ? `${selectedCount} 张图片等待处理` : "选择图片后批量处理"}</span>
        <div className={s.toolbar}>
          <Button tone="primary" icon={Check} disabled={selectedCount === 0} feedback={{ title: "已加入保留队列", detail: `${selectedCount} 张图片` }}>保留</Button>
          <Button tone="pink" icon={Star} disabled={selectedCount === 0} feedback={{ title: "已加入 p站 标记队列", detail: `${selectedCount} 张图片` }}>p站</Button>
          <Button tone="pink" icon={Eye} disabled={selectedCount === 0} feedback={{ title: "已加入预览标记队列", detail: `${selectedCount} 张图片` }}>预览</Button>
          <Button tone="subtle" icon={ImageIcon} disabled={selectedCount !== 1} feedback={{ title: "已设为封面", detail: "1 张图片" }}>封面</Button>
          <Button tone="danger" icon={Trash2} disabled={selectedCount === 0} feedback={{ tone: "warning", title: "已加入删除队列", detail: `${selectedCount} 张图片` }}>删除</Button>
          <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销最近操作</Button>
        </div>
      </div>

      {activeImage && portalTarget ? createPortal(
        <div className={s.lightboxOverlay} role="dialog" aria-modal="true" aria-label="审核图片预览">
          <div className={s.lightboxPanel}>
            <div className={s.lightboxChrome}>
              <div>
                <strong>{activeImage.label}</strong>
                <span>{activeIndex! + 1} / {images.length} · {activeImage.status}</span>
              </div>
              <button className={s.iconMiniButton} type="button" onClick={() => setActiveIndex(null)} aria-label="关闭预览">
                <X className={s.icon} />
              </button>
            </div>
            <div className={s.lightboxImage}>
              {activeImage.src ? <img src={activeImage.src} alt="" className={s.imageFill} loading="eager" /> : null}
            </div>
            <div className={s.lightboxActions}>
              <Button tone="subtle" icon={ArrowLeft} onClick={() => setActiveIndex((current) => (current === null ? 0 : (current + images.length - 1) % images.length))}>
                上一张
              </Button>
              <Button tone="subtle" icon={ArrowRight} onClick={() => setActiveIndex((current) => (current === null ? 0 : (current + 1) % images.length))}>
                下一张
              </Button>
              <Button tone="subtle" icon={Archive} feedback={{ tone: "info", title: "最近操作已撤销" }}>撤销</Button>
            </div>
          </div>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}

export function Field({ label, value, disabled = false }: { label: string; value: string | number; disabled?: boolean }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <input className={s.input} value={value} disabled={disabled} readOnly />
    </div>
  );
}

export function TextAreaField({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.textAreaField}>
      <label>{label}</label>
      <textarea className={s.textarea} value={value} readOnly />
    </div>
  );
}

export function SelectLike({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.field}>
      <label>{label}</label>
      <select className={s.select} value={value} onChange={() => undefined}>
        <option value={value}>{value}</option>
      </select>
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
    <div className={s.tabs} role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={value === tab.key}
          className={cx(s.tab, value === tab.key && s.tabActive)}
          key={tab.key}
          onClick={() => onChange(tab.key)}
          role="tab"
          type="button"
        >
          {tab.label}
          {tab.count !== undefined ? <span className={s.navCount}>{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SwitchRow({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={s.switchRow}>
      <div className={s.switchText}>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <span className={s.switch} />
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


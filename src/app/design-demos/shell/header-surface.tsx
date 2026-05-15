"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import { cx } from "../routing";
import type { HeaderAction, HeaderSpec } from "../routing/header-specs";
import { Button, ButtonLink } from "../shared/primitives";
import s from "./header-surface.module.css";

type RouteHeaderMode = "expanded" | "mobile";
type HeadingLevel = 1 | 2 | 3;

function actionLimitForHeader(mode: RouteHeaderMode, width: number, totalActions: number) {
  if (totalActions <= 0) return 0;
  if (mode === "mobile") return 1;
  if (width >= 1100) return totalActions;
  if (width >= 820) return Math.min(4, totalActions);
  if (width >= 700) return Math.min(3, totalActions);
  return 1;
}

function HeaderActionButton({
  action: item,
}: {
  action: HeaderAction;
}) {
  return (
    <Button
      ariaLabel={item.label}
      icon={item.icon}
      tone={item.tone ?? "default"}
    >
      {item.label}
    </Button>
  );
}

function HeaderMeta({ className, items }: { className?: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className={cx(s.metaStrip, className)}>
      {items.map((item) => (
        <span className={s.metaItem} key={item}>
          <span className={s.metaText}>{item}</span>
        </span>
      ))}
    </div>
  );
}

function HeaderBackLink({
  back,
}: {
  back: NonNullable<HeaderSpec["back"]>;
}) {
  return (
    <ButtonLink
      ariaLabel={back.label}
      tone="subtle"
      href={back.href}
      icon={ArrowLeft}
      iconOnly
    >
      {back.label}
    </ButtonLink>
  );
}

function HeaderTitle({
  children,
  id,
  level,
}: {
  children: ReactNode;
  id: string;
  level: HeadingLevel;
}) {
  if (level === 1) return <h1 id={id}>{children}</h1>;
  if (level === 2) return <h2 id={id}>{children}</h2>;
  return <h3 id={id}>{children}</h3>;
}

export function RouteHeaderSurface({
  className,
  headingLevel = 1,
  hidden = false,
  mode = "expanded",
  spec,
  surfaceRef,
  titleId,
}: {
  className?: string;
  hidden?: boolean;
  headingLevel?: HeadingLevel;
  mode?: RouteHeaderMode;
  spec: HeaderSpec;
  surfaceRef?: (node: HTMLElement | null) => void;
  titleId?: string;
}) {
  const isMobile = mode === "mobile";
  const resolvedTitleId = titleId ?? `${spec.key}-${mode}-title`;
  const overflowMenuId = `${resolvedTitleId}-actions-overflow`;
  const headerNodeRef = useRef<HTMLElement | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowMenuStyle, setOverflowMenuStyle] = useState<CSSProperties>({});
  const [overflowPortalTarget, setOverflowPortalTarget] = useState<HTMLElement | null>(null);
  const actions = useMemo(() => spec.actions ?? [], [spec.actions]);
  const fallbackActionLimit = isMobile ? 1 : Math.min(3, actions.length);
  const visibleActionLimit = headerWidth ? actionLimitForHeader(mode, headerWidth, actions.length) : fallbackActionLimit;
  const visibleActions = actions.slice(0, visibleActionLimit);
  const overflowActions = actions.slice(visibleActionLimit);
  const showsMoreActions = overflowActions.length > 0;
  const overflowMenuOpen = overflowOpen && !hidden;

  const setHeaderNode = useCallback(
    (node: HTMLElement | null) => {
      headerNodeRef.current = node;
      setOverflowPortalTarget(node ? node.closest<HTMLElement>("[data-app-shell]") ?? node.ownerDocument.body : null);
      surfaceRef?.(node);
    },
    [surfaceRef],
  );

  const updateOverflowMenuPosition = useCallback(() => {
    const anchor = overflowRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.min(210, Math.max(160, window.innerWidth - viewportPadding * 2));
    const left = Math.min(
      Math.max(rect.right - width, viewportPadding),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const maxHeight = Math.max(160, window.innerHeight - rect.bottom - viewportPadding - 8);
    setOverflowMenuStyle({
      left,
      maxHeight,
      top: rect.bottom + 8,
      width,
    });
  }, []);

  useEffect(() => {
    const node = headerNodeRef.current;
    if (!node) return;
    const observedNode = node;

    function syncHeaderWidth() {
      setHeaderWidth(Math.ceil(observedNode.getBoundingClientRect().width));
    }

    syncHeaderWidth();
    const observer = new ResizeObserver(syncHeaderWidth);
    observer.observe(observedNode);
    window.addEventListener("resize", syncHeaderWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeaderWidth);
    };
  }, []);

  useEffect(() => {
    if (!hidden) return undefined;
    const frameId = window.requestAnimationFrame(() => setOverflowOpen(false));
    return () => window.cancelAnimationFrame(frameId);
  }, [hidden]);

  useEffect(() => {
    if (!overflowMenuOpen) return;
    updateOverflowMenuPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (overflowRef.current?.contains(target) || overflowMenuRef.current?.contains(target)) return;
      setOverflowOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOverflowOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateOverflowMenuPosition);
    window.addEventListener("scroll", updateOverflowMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateOverflowMenuPosition);
      window.removeEventListener("scroll", updateOverflowMenuPosition, true);
    };
  }, [overflowMenuOpen, updateOverflowMenuPosition]);

  return (
    <header
      aria-labelledby={resolvedTitleId}
      aria-hidden={hidden ? true : undefined}
      className={cx(
        s.fixedHeader,
        hidden && s.fixedHeaderHidden,
        isMobile && s.fixedHeaderMobile,
        className,
      )}
      data-route-header-hidden={hidden ? "true" : "false"}
      data-header-surface
      inert={hidden ? true : undefined}
      ref={setHeaderNode}
    >
      <div className={s.mainRow}>
        <div className={s.leftCluster}>
          {spec.back ? (
            <div className={s.backSlot}>
              <HeaderBackLink back={spec.back} />
            </div>
          ) : null}
        </div>

        <div className={s.identityBlock}>
          <span className={s.titleAccent} aria-hidden="true" />
          <div className={s.titleStack}>
            <HeaderTitle id={resolvedTitleId} level={headingLevel}>
              {spec.title}
            </HeaderTitle>
            {!isMobile && spec.meta?.length ? <p className={s.titleMeta}>{spec.meta.join(" / ")}</p> : null}
            <HeaderMeta className={s.inlineMeta} items={spec.meta?.slice(0, 2)} />
          </div>
        </div>

        <div className={s.actionCluster} role="toolbar" aria-label={`${spec.title} 页面操作`}>
          {visibleActions?.map((item) => (
            <HeaderActionButton action={item} key={item.label} />
          ))}
          {showsMoreActions ? (
            <div className={s.overflowMenuWrap} ref={overflowRef}>
              <Button
                ariaControls={overflowMenuId}
                ariaExpanded={overflowMenuOpen}
                ariaHasPopup="menu"
                ariaLabel="更多页面操作"
                icon={MoreHorizontal}
                iconOnly
                onClick={() => {
                  updateOverflowMenuPosition();
                  setOverflowOpen((open) => !open);
                }}
                pressed={overflowMenuOpen}
              />
              {overflowMenuOpen && overflowPortalTarget ? createPortal(
                <div
                  className={s.overflowMenu}
                  id={overflowMenuId}
                  ref={overflowMenuRef}
                  role="menu"
                  aria-label={`${spec.title} 更多页面操作`}
                  style={overflowMenuStyle}
                >
                  {overflowActions.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        className={s.overflowMenuItem}
                        data-tone={item.tone ?? "default"}
                        key={item.label}
                        onClick={() => setOverflowOpen(false)}
                        role="menuitem"
                        type="button"
                      >
                        <Icon className={s.overflowMenuIcon} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>,
                overflowPortalTarget,
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

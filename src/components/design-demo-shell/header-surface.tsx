"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import { cx, useRouteHref } from "@/app/design-demos/routing";
import type { HeaderAction, HeaderSpec } from "@/app/design-demos/routing/header-specs";
import { Button, ButtonLink } from "@/app/design-demos/shared/primitives";
import s from "./header-surface.module.css";

type RouteHeaderMode = "expanded" | "mobile";
type HeadingLevel = 1 | 2 | 3;

export type HeaderActionSlot = {
  key: string;
  label: string;
  node: ReactNode;
  overflowNode?: ReactNode;
  placement?: "leading" | "trailing";
};

type HeaderActionUnit =
  | { action: HeaderAction; key: string; type: "action" }
  | { key: string; slot: HeaderActionSlot; type: "slot" };

function HeaderActionButton({
  action: item,
}: {
  action: HeaderAction;
}) {
  if (item.href) {
    return (
      <ButtonLink
        ariaLabel={item.label}
        href={item.href}
        icon={item.icon}
        tone={item.tone ?? "default"}
      >
        {item.label}
      </ButtonLink>
    );
  }

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

function HeaderActionSlotView({ slot }: { slot: HeaderActionSlot }) {
  return (
    <div
      className={s.actionSlot}
      data-header-action-slot={slot.key}
      role="group"
      aria-label={slot.label}
    >
      {slot.node}
    </div>
  );
}

function HeaderActionUnitView({ unit }: { unit: HeaderActionUnit }) {
  if (unit.type === "slot") return <HeaderActionSlotView slot={unit.slot} />;
  return <HeaderActionButton action={unit.action} />;
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
  actionSlots,
  className,
  headingLevel = 1,
  hidden = false,
  mode = "expanded",
  spec,
  surfaceRef,
  titleId,
}: {
  actionSlots?: HeaderActionSlot[];
  className?: string;
  hidden?: boolean;
  headingLevel?: HeadingLevel;
  mode?: RouteHeaderMode;
  spec: HeaderSpec;
  surfaceRef?: (node: HTMLElement | null) => void;
  titleId?: string;
}) {
  const hrefForRoute = useRouteHref();
  const isMobile = mode === "mobile";
  const resolvedTitleId = titleId ?? `${spec.key}-${mode}-title`;
  const overflowMenuId = `${resolvedTitleId}-actions-overflow`;
  const headerNodeRef = useRef<HTMLElement | null>(null);
  const actionMeasureRef = useRef<HTMLDivElement | null>(null);
  const leftClusterRef = useRef<HTMLDivElement | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [headerWidth, setHeaderWidth] = useState(0);
  const [visibleActionLimit, setVisibleActionLimit] = useState(0);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowMenuStyle, setOverflowMenuStyle] = useState<CSSProperties>({});
  const [overflowPortalTarget, setOverflowPortalTarget] = useState<HTMLElement | null>(null);
  const actions = useMemo(() => spec.actions ?? [], [spec.actions]);
  const actionUnits = useMemo<HeaderActionUnit[]>(() => {
    const actionItems = actions.map((action) => ({
      action,
      key: `action:${action.label}`,
      type: "action" as const,
    }));
    const slots = actionSlots ?? [];
    const leadingSlotItems = slots.filter((slot) => slot.placement !== "trailing").map((slot) => ({
      key: `slot:${slot.key}`,
      slot,
      type: "slot" as const,
    }));
    const trailingSlotItems = slots.filter((slot) => slot.placement === "trailing").map((slot) => ({
      key: `slot:${slot.key}`,
      slot,
      type: "slot" as const,
    }));
    return [...leadingSlotItems, ...actionItems, ...trailingSlotItems];
  }, [actions, actionSlots]);
  const visibleActionUnits = actionUnits.slice(0, visibleActionLimit);
  const overflowActionUnits = actionUnits.slice(visibleActionLimit);
  const showsMoreActions = overflowActionUnits.length > 0;
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
    const width = Math.min(260, Math.max(180, window.innerWidth - viewportPadding * 2));
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

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const headerNode = headerNodeRef.current;
      const measureNode = actionMeasureRef.current;
      if (!headerNode || !measureNode) {
        setVisibleActionLimit(actionUnits.length);
        return;
      }

      if (actionUnits.length === 0) {
        setVisibleActionLimit(0);
        return;
      }

      const measuredUnits = Array.from(measureNode.querySelectorAll<HTMLElement>("[data-header-measure-unit]"));
      const moreButton = measureNode.querySelector<HTMLElement>("[data-header-measure-more]");
      if (measuredUnits.length !== actionUnits.length || !moreButton) return;

      const styles = window.getComputedStyle(measureNode);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
      const headerRect = headerNode.getBoundingClientRect();
      const leftWidth = Math.ceil(leftClusterRef.current?.getBoundingClientRect().width ?? 0);
      const titleReserve = isMobile
        ? Math.min(340, Math.max(230, headerRect.width * 0.42))
        : Math.min(460, Math.max(300, headerRect.width * 0.36));
      const availableWidth = Math.max(0, headerRect.width - leftWidth - titleReserve - 18);
      const unitWidths = measuredUnits.map((unit) => Math.ceil(unit.getBoundingClientRect().width));
      const moreWidth = Math.ceil(moreButton.getBoundingClientRect().width);
      const fullWidth = unitWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(unitWidths.length - 1, 0);

      let nextVisibleLimit = actionUnits.length;
      if (fullWidth > availableWidth) {
        nextVisibleLimit = 0;
        for (let count = actionUnits.length - 1; count >= 0; count -= 1) {
          const visibleWidth = unitWidths.slice(0, count).reduce((sum, width) => sum + width, 0);
          const usedWidth = visibleWidth + moreWidth + gap * Math.max(count, 0);
          if (usedWidth <= availableWidth) {
            nextVisibleLimit = count;
            break;
          }
        }
      }

      setVisibleActionLimit((current) => (current === nextVisibleLimit ? current : nextVisibleLimit));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [actionUnits, headerWidth, isMobile]);

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
        <div className={s.leftCluster} ref={leftClusterRef}>
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
            {spec.meta?.length ? <p className={s.titleMeta}>{spec.meta.join(" / ")}</p> : null}
          </div>
        </div>

        <div className={s.actionCluster} role="toolbar" aria-label={`${spec.title} 页面操作`}>
          {visibleActionUnits?.map((unit) => (
            <HeaderActionUnitView key={unit.key} unit={unit} />
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
                  role="group"
                  aria-label={`${spec.title} 更多页面操作`}
                  style={overflowMenuStyle}
                >
                  {overflowActionUnits.map((unit) => {
                    if (unit.type === "slot") {
                      return (
                        <div className={s.overflowMenuSlot} key={unit.key} role="group" aria-label={unit.slot.label}>
                          <div className={s.overflowMenuSlotBody}>
                            {unit.slot.overflowNode ?? unit.slot.node}
                          </div>
                        </div>
                      );
                    }

                    const Icon = unit.action.icon;
                    const content = (
                      <>
                        <Icon className={s.overflowMenuIcon} aria-hidden="true" />
                        <span>{unit.action.label}</span>
                      </>
                    );
                    return unit.action.href ? (
                      <Link
                        className={s.overflowMenuItem}
                        data-tone={unit.action.tone ?? "default"}
                        href={hrefForRoute(unit.action.href)}
                        key={unit.key}
                        onClick={() => setOverflowOpen(false)}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        className={s.overflowMenuItem}
                        data-tone={unit.action.tone ?? "default"}
                        key={unit.key}
                        onClick={() => setOverflowOpen(false)}
                        type="button"
                      >
                        {content}
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
      <div className={s.actionMeasureTray} aria-hidden="true" inert ref={actionMeasureRef}>
        {actionUnits.map((unit) => (
          <div className={s.actionMeasureUnit} data-header-measure-unit key={`measure:${unit.key}`}>
            <HeaderActionUnitView unit={unit} />
          </div>
        ))}
        <div className={s.actionMeasureUnit} data-header-measure-more>
          <Button ariaLabel="更多页面操作" icon={MoreHorizontal} iconOnly />
        </div>
      </div>
    </header>
  );
}

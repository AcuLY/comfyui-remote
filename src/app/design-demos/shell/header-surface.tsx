"use client";

import type { ReactNode } from "react";
import type { Ref } from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import { cx } from "../routing";
import type { HeaderAction, HeaderSpec } from "../routing/header-specs";
import { Button, ButtonLink } from "../shared/primitives";
import s from "./header-surface.module.css";

type RouteHeaderMode = "expanded" | "collapsed" | "mobile";
type HeadingLevel = 1 | 2 | 3;

function HeaderActionButton({
  action: item,
  iconOnly = false,
}: {
  action: HeaderAction;
  iconOnly?: boolean;
}) {
  return (
    <Button
      ariaLabel={item.label}
      className={s.headerButton}
      icon={item.icon}
      iconOnly={iconOnly}
      size="sm"
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
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

function HeaderBackLink({
  back,
  mode,
}: {
  back: NonNullable<HeaderSpec["back"]>;
  mode: RouteHeaderMode;
}) {
  const compact = mode === "collapsed" || mode === "mobile";

  return (
    <ButtonLink
      ariaLabel={back.label}
      className={cx(s.headerButton, s.headerBackButton, compact && s.headerBackButtonCompact)}
      href={back.href}
      icon={ArrowLeft}
      iconOnly={compact}
      size="sm"
      tone="subtle"
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
  mode = "expanded",
  spec,
  surfaceRef,
  titleId,
  tools,
}: {
  className?: string;
  headingLevel?: HeadingLevel;
  mode?: RouteHeaderMode;
  spec: HeaderSpec;
  surfaceRef?: Ref<HTMLElement>;
  titleId?: string;
  tools?: ReactNode;
}) {
  const isCollapsed = mode === "collapsed";
  const isMobile = mode === "mobile";
  const resolvedTitleId = titleId ?? `${spec.key}-${mode}-title`;
  const visibleActions = isMobile ? spec.actions?.slice(0, 1) : isCollapsed ? spec.actions?.slice(0, 2) : spec.actions;
  const hiddenCount = Math.max(0, (spec.actions?.length ?? 0) - (visibleActions?.length ?? 0));
  const showsMoreActions = hiddenCount > 0 || Boolean(spec.secondaryActions?.length);
  const actionDensity = (visibleActions?.length ?? 0) + (showsMoreActions ? 1 : 0);

  return (
    <header
      aria-labelledby={resolvedTitleId}
      className={cx(
        s.fixedHeader,
        actionDensity > 1 && s.fixedHeaderStackedActions,
        isCollapsed && s.fixedHeaderCollapsed,
        isMobile && s.fixedHeaderMobile,
        className,
      )}
      data-route-header-collapsed={isCollapsed ? "true" : "false"}
      data-header-surface
      ref={surfaceRef}
    >
      <div className={s.mainRow}>
        <div className={s.leftCluster}>
          {spec.back ? (
            <div className={s.backSlot}>
              <HeaderBackLink back={spec.back} mode={mode} />
            </div>
          ) : null}
        </div>

        <div className={s.identityBlock}>
          <span className={s.eyebrow}>{spec.eyebrow}</span>
          <div className={s.titleRow}>
            <HeaderTitle id={resolvedTitleId} level={headingLevel}>
              {spec.title}
            </HeaderTitle>
            {spec.status ? <span className={s.statusPill}>{spec.status}</span> : null}
          </div>
          <p>{isMobile ? "ComfyUI Manager" : spec.subtitle}</p>
          <HeaderMeta className={s.inlineMeta} items={spec.meta?.slice(0, 2)} />
        </div>

        <div className={s.actionCluster} role="toolbar" aria-label={`${spec.title} 页面操作`}>
          {visibleActions?.map((item) => (
            <HeaderActionButton action={item} iconOnly={isCollapsed || isMobile} key={item.label} />
          ))}
          {showsMoreActions ? (
            <Button
              ariaLabel="更多页面操作"
              className={s.headerButton}
              icon={MoreHorizontal}
              iconOnly
              size="sm"
            />
          ) : null}
          {tools}
        </div>
      </div>

      <HeaderMeta className={s.blockMeta} items={spec.meta} />
      {spec.secondaryActions?.length ? (
        <div className={s.commandRow} role="toolbar" aria-label={`${spec.title} 二级操作`}>
          {spec.secondaryActions.map((item) => (
            <HeaderActionButton action={item} key={item.label} />
          ))}
        </div>
      ) : null}
    </header>
  );
}

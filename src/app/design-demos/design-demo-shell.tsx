"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, Menu, Moon, MoreHorizontal, Sun } from "lucide-react";

import type { DemoData } from "./design-demo-data";
import s from "./design-demo-shell.shell.module.css";
import { findHeaderSpecForRoute } from "./route-header-specs";
import type { HeaderSpec } from "./route-header-specs";
import { RouteHeaderSurface } from "./route-header-surface";
import { Button } from "./ui/button";
import { DemoFeedbackProvider } from "./ui/feedback";
import {
  DESIGN_DEMO_SFW_STORAGE_KEY,
  DESIGN_DEMO_THEME_STORAGE_KEY,
  MOBILE_NAV_LINKS,
  NAV_LINKS,
  applyDesignDemoTheme,
  applyDesignDemoSfwMode,
  cx,
  demoHref,
  isDemoThemeValue,
  isNavActive,
  isSfwEnabledValue,
} from "./design-demo-utils";
import type { DemoTheme } from "./design-demo-utils";

function Sidebar({
  collapsed,
  data,
  currentRoute,
  open,
  onClose,
  onToggleCollapsed,
  theme,
  onToggleTheme,
  sfwMode,
  onToggleSfwMode,
}: {
  collapsed: boolean;
  data: DemoData;
  currentRoute: string;
  open: boolean;
  onClose: () => void;
  onToggleCollapsed: () => void;
  theme: DemoTheme;
  onToggleTheme: () => void;
  sfwMode: boolean;
  onToggleSfwMode: () => void;
}) {
  const isLightTheme = theme === "light";
  const isDarkTheme = !isLightTheme;
  const ThemeIcon = isDarkTheme ? Sun : Moon;
  const SfwIcon = sfwMode ? EyeOff : Eye;
  const grouped = useMemo(() => {
    const map = new Map<string, typeof NAV_LINKS>();
    for (const link of NAV_LINKS) {
      if (!map.has(link.group)) map.set(link.group, []);
      map.get(link.group)!.push(link);
    }
    return [...map.entries()];
  }, []);

  return (
    <aside className={cx(s.sidebar, collapsed && s.sidebarCollapsed, open && s.sidebarOpen)}>
      <div className={s.brand}>
        <div className={s.brandTop}>
          <Button
            className={cx(s.shellButton, s.iconButton, s.sidebarCollapseButton)}
            icon={Menu}
            iconOnly
            onClick={open ? onClose : onToggleCollapsed}
            ariaLabel={open || !collapsed ? "收起侧边栏" : "展开侧边栏"}
          />
          <div className={cx(s.toolbar, s.brandIdentity)}>
            <div className={s.brandName}>
              <strong>ComfyUI Manager</strong>
              <span>创作工作台</span>
            </div>
          </div>
        </div>
      </div>
      {grouped.map(([group, links]) => (
        <nav className={s.navSection} key={group}>
          <div className={s.navTitle}>{group}</div>
          {links.map((link) => {
            const Icon = link.icon;
            const active = isNavActive(currentRoute, link.href, link.activePrefix);
            return (
              <Link
                className={cx(s.navLink, active && s.navLinkActive)}
                href={demoHref(link.href)}
                key={link.href}
                onClick={onClose}
              >
                <Icon className={s.iconMd} />
                <span>{link.label}</span>
                {link.count ? <em className={s.navCount}>{link.count(data)}</em> : null}
              </Link>
            );
          })}
          {group === "系统" ? (
            <div className={s.sidebarTools} aria-label="全局工具">
              <button
                className={cx(s.sidebarToggle, isDarkTheme && s.sidebarToggleActive)}
                type="button"
                role="switch"
                aria-checked={isDarkTheme}
                onClick={onToggleTheme}
              >
                <ThemeIcon className={s.iconMd} />
                <span>暗色</span>
                <span className={s.sidebarToggleSwitch} aria-hidden="true">
                  <span />
                </span>
              </button>
              <button
                className={cx(s.sidebarToggle, sfwMode && s.sidebarToggleActive)}
                type="button"
                role="switch"
                aria-checked={sfwMode}
                onClick={onToggleSfwMode}
              >
                <SfwIcon className={s.iconMd} />
                <span>SFW</span>
                <span className={s.sidebarToggleSwitch} aria-hidden="true">
                  <span />
                </span>
              </button>
            </div>
          ) : null}
        </nav>
      ))}
    </aside>
  );
}

function MobileBottomNav({
  data,
  currentRoute,
  moreOpen,
  onMore,
}: {
  data: DemoData;
  currentRoute: string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  return (
    <nav className={s.mobileBottomNav} aria-label="移动端主导航">
      {MOBILE_NAV_LINKS.map((link) => {
        const Icon = link.icon;
        const active = isNavActive(currentRoute, link.href, link.activePrefix);
        return (
          <Link
            className={cx(s.mobileBottomItem, active && s.mobileBottomItemActive)}
            href={demoHref(link.href)}
            key={link.href}
          >
            <Icon className={s.iconMd} />
            <span>{link.label}</span>
            {link.count ? <em>{link.count(data)}</em> : null}
          </Link>
        );
      })}
      <button
        className={cx(s.mobileBottomItem, moreOpen && s.mobileBottomItemActive)}
        type="button"
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-label="打开更多页面"
      >
        <MoreHorizontal className={s.iconMd} />
        <span>更多</span>
      </button>
    </nav>
  );
}

function MobileTopbar({
  activeLabel,
  toolsOpen,
  onToggleTools,
  theme,
  onToggleTheme,
  sfwMode,
  onToggleSfwMode,
}: {
  activeLabel: string;
  toolsOpen: boolean;
  onToggleTools: () => void;
  theme: DemoTheme;
  onToggleTheme: () => void;
  sfwMode: boolean;
  onToggleSfwMode: () => void;
}) {
  const isDarkTheme = theme === "dark";
  const ThemeIcon = isDarkTheme ? Sun : Moon;
  const SfwIcon = sfwMode ? EyeOff : Eye;

  return (
    <div className={s.mobileTopbar}>
      <div className={s.mobileTopbarTitle}>
        <strong>{activeLabel}</strong>
        <span>ComfyUI Manager</span>
      </div>
      <div className={s.mobileTopbarTools}>
        <Button
          className={cx(s.shellButton, s.iconButton, s.mobileTopbarButton)}
          icon={MoreHorizontal}
          iconOnly
          onClick={onToggleTools}
          pressed={toolsOpen}
          ariaLabel="打开显示设置"
        />
        {toolsOpen ? (
          <div className={s.mobileToolsMenu} role="menu" aria-label="显示设置">
            <button
              className={cx(s.mobileToolsItem, isDarkTheme && s.mobileToolsItemActive)}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isDarkTheme}
              onClick={onToggleTheme}
            >
              <ThemeIcon className={s.iconMd} />
              <span>暗色模式</span>
            </button>
            <button
              className={cx(s.mobileToolsItem, sfwMode && s.mobileToolsItemActive)}
              type="button"
              role="menuitemcheckbox"
              aria-checked={sfwMode}
              onClick={onToggleSfwMode}
            >
              <SfwIcon className={s.iconMd} />
              <span>SFW 模式</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RouteHeaderToolsMenu({
  isDarkTheme,
  onToggleSfwMode,
  onToggleTheme,
  sfwMode,
}: {
  isDarkTheme: boolean;
  onToggleSfwMode: () => void;
  onToggleTheme: () => void;
  sfwMode: boolean;
}) {
  const ThemeIcon = isDarkTheme ? Sun : Moon;
  const SfwIcon = sfwMode ? EyeOff : Eye;

  return (
    <div className={s.routeHeaderToolsMenu} role="menu" aria-label="显示设置">
      <button
        className={cx(s.routeHeaderToolsItem, isDarkTheme && s.routeHeaderToolsItemActive)}
        type="button"
        role="menuitemcheckbox"
        aria-checked={isDarkTheme}
        onClick={onToggleTheme}
      >
        <ThemeIcon className={s.iconMd} aria-hidden="true" />
        <span>暗色模式</span>
      </button>
      <button
        className={cx(s.routeHeaderToolsItem, sfwMode && s.routeHeaderToolsItemActive)}
        type="button"
        role="menuitemcheckbox"
        aria-checked={sfwMode}
        onClick={onToggleSfwMode}
      >
        <SfwIcon className={s.iconMd} aria-hidden="true" />
        <span>SFW 模式</span>
      </button>
    </div>
  );
}

function DemoRouteHeader({
  collapsed,
  config,
  compact,
  isDarkTheme,
  onToggleSfwMode,
  onToggleTheme,
  onToggleTools,
  sfwMode,
  surfaceRef,
  toolsOpen,
}: {
  collapsed: boolean;
  config: HeaderSpec;
  compact: boolean;
  isDarkTheme: boolean;
  onToggleSfwMode: () => void;
  onToggleTheme: () => void;
  onToggleTools: () => void;
  sfwMode: boolean;
  surfaceRef: Ref<HTMLElement>;
  toolsOpen: boolean;
}) {
  return (
    <RouteHeaderSurface
      className={s.routeHeaderSurface}
      mode={compact ? "mobile" : collapsed ? "collapsed" : "expanded"}
      spec={config}
      surfaceRef={surfaceRef}
      tools={
        <div className={s.routeHeaderTools}>
          <Button
            className={cx(s.shellButton, s.iconButton, s.routeHeaderToolButton)}
            icon={MoreHorizontal}
            iconOnly
            onClick={onToggleTools}
            pressed={toolsOpen}
            ariaLabel="打开显示设置"
          />
          {toolsOpen ? (
            <RouteHeaderToolsMenu
              isDarkTheme={isDarkTheme}
              onToggleSfwMode={onToggleSfwMode}
              onToggleTheme={onToggleTheme}
              sfwMode={sfwMode}
            />
          ) : null}
        </div>
      }
    />
  );
}

export function DesignDemoShell({
  children,
  currentRoute,
  data,
  initialTheme,
}: {
  children: ReactNode;
  currentRoute: string;
  data: DemoData;
  initialTheme: DemoTheme;
}) {
  const contentFrameRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const routeHeaderRef = useRef<HTMLElement>(null);
  const routeHeaderCollapsedRef = useRef(false);
  const routeHeaderInsetRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<DemoTheme>(initialTheme);
  const [sfwMode, setSfwMode] = useState(false);
  const [routeHeaderCompact, setRouteHeaderCompact] = useState(false);
  const [routeHeaderCollapsed, setRouteHeaderCollapsed] = useState(false);
  const isLightTheme = theme === "light";
  const routeHeaderConfig = useMemo(() => findHeaderSpecForRoute(data, currentRoute), [currentRoute, data]);
  const hasRouteHeader = Boolean(routeHeaderConfig);
  const activeNav = useMemo(
    () => NAV_LINKS.find((link) => isNavActive(currentRoute, link.href, link.activePrefix)) ?? NAV_LINKS[0],
    [currentRoute],
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(DESIGN_DEMO_THEME_STORAGE_KEY);
      const resolvedTheme = isDemoThemeValue(storedTheme) ? storedTheme : initialTheme;

      applyDesignDemoTheme(resolvedTheme);
      setTheme(resolvedTheme);
      setSidebarCollapsed(window.matchMedia("(min-width: 640px) and (max-width: 1023px)").matches);
      setRouteHeaderCompact(window.matchMedia("(max-width: 760px)").matches);
      setSfwMode(isSfwEnabledValue(window.localStorage.getItem(DESIGN_DEMO_SFW_STORAGE_KEY)));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialTheme]);

  useEffect(() => {
    routeHeaderInsetRef.current = 0;
  }, [routeHeaderCompact, routeHeaderConfig?.key]);

  useEffect(() => {
    const frame = contentFrameRef.current;
    const header = routeHeaderRef.current;

    if (!hasRouteHeader || !frame || !header) {
      frame?.style.removeProperty("--demo-route-header-height");
      return;
    }

    const observedFrame = frame;
    const observedHeader = header;

    function syncHeaderInset() {
      const nextHeight = Math.ceil(observedHeader.getBoundingClientRect().height);
      const stableHeight = Math.max(routeHeaderInsetRef.current, nextHeight);
      routeHeaderInsetRef.current = stableHeight;
      observedFrame.style.setProperty("--demo-route-header-height", `${stableHeight}px`);
    }

    syncHeaderInset();
    const observer = new ResizeObserver(syncHeaderInset);
    observer.observe(observedHeader);
    window.addEventListener("resize", syncHeaderInset);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeaderInset);
    };
  }, [hasRouteHeader, routeHeaderCompact, routeHeaderConfig?.key]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");

    function syncCompactHeader() {
      setRouteHeaderCompact(query.matches);
    }

    syncCompactHeader();
    query.addEventListener("change", syncCompactHeader);
    return () => query.removeEventListener("change", syncCompactHeader);
  }, []);

  useEffect(() => {
    if (!menuOpen && !toolsOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setToolsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, toolsOpen]);

  useEffect(() => {
    let lastScrollTop = 0;
    let frameId = 0;
    let resetFrameId = 0;
    const collapseAfter = 96;
    const expandNearTop = 24;
    const minDirectionDelta = 10;

    function readScrollTop() {
      return mainRef.current?.scrollTop ?? 0;
    }

    function setCollapsed(nextCollapsed: boolean) {
      if (routeHeaderCollapsedRef.current === nextCollapsed) return;
      routeHeaderCollapsedRef.current = nextCollapsed;
      setRouteHeaderCollapsed(nextCollapsed);
    }

    if (!hasRouteHeader) {
      resetFrameId = window.requestAnimationFrame(() => setCollapsed(false));
      return () => window.cancelAnimationFrame(resetFrameId);
    }

    resetFrameId = window.requestAnimationFrame(() => {
      lastScrollTop = readScrollTop();
      setCollapsed(false);
    });

    function handleScroll() {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const nextScrollTop = readScrollTop();
        const delta = nextScrollTop - lastScrollTop;

        if (nextScrollTop <= expandNearTop) {
          setCollapsed(false);
        } else if (delta >= minDirectionDelta && nextScrollTop >= collapseAfter) {
          setCollapsed(true);
        } else if (delta <= -minDirectionDelta) {
          setCollapsed(false);
        }

        lastScrollTop = nextScrollTop;
        frameId = 0;
      });
    }

    const main = mainRef.current;
    main?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      main?.removeEventListener("scroll", handleScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
      if (resetFrameId) window.cancelAnimationFrame(resetFrameId);
    };
  }, [currentRoute, hasRouteHeader]);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyDesignDemoTheme(nextTheme);
      return nextTheme;
    });
  }

  function toggleSfwMode() {
    setSfwMode((currentMode) => {
      const nextMode = !currentMode;
      applyDesignDemoSfwMode(nextMode);
      return nextMode;
    });
  }

  return (
    <DemoFeedbackProvider>
      <div className={cx(s.shell, isLightTheme && s.shellLight)} data-design-demo-shell data-demo-font="harmonyos" data-theme={theme}>
        {!hasRouteHeader ? (
          <MobileTopbar
            activeLabel={activeNav?.label ?? "工作台"}
            toolsOpen={toolsOpen}
            onToggleTools={() => {
              setToolsOpen((open) => !open);
              setMenuOpen(false);
            }}
            theme={theme}
            onToggleTheme={toggleTheme}
            sfwMode={sfwMode}
            onToggleSfwMode={toggleSfwMode}
          />
        ) : null}
        {menuOpen ? (
          <button
            className={s.mobileNavBackdrop}
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭导航菜单"
          />
        ) : null}
        <div className={cx(s.workspace, sidebarCollapsed && s.workspaceCollapsed, hasRouteHeader && s.workspaceWithRouteHeader)}>
          <Sidebar
            collapsed={sidebarCollapsed && !menuOpen}
            data={data}
            currentRoute={currentRoute}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
            theme={theme}
            onToggleTheme={toggleTheme}
            sfwMode={sfwMode}
            onToggleSfwMode={toggleSfwMode}
          />
          <div className={cx(s.contentFrame, hasRouteHeader && s.contentFrameWithRouteHeader)} ref={contentFrameRef}>
            {routeHeaderConfig ? (
              <DemoRouteHeader
                collapsed={routeHeaderCollapsed}
                config={routeHeaderConfig}
                compact={routeHeaderCompact}
                isDarkTheme={theme === "dark"}
                onToggleSfwMode={toggleSfwMode}
                onToggleTheme={toggleTheme}
                onToggleTools={() => {
                  setToolsOpen((open) => !open);
                  setMenuOpen(false);
                }}
                sfwMode={sfwMode}
                surfaceRef={routeHeaderRef}
                toolsOpen={toolsOpen}
              />
            ) : null}
            <main className={cx(s.main, hasRouteHeader && s.mainWithRouteHeader)} ref={mainRef}>
              {children}
            </main>
          </div>
        </div>
        <MobileBottomNav
          data={data}
          currentRoute={currentRoute}
          moreOpen={menuOpen}
          onMore={() => {
            setMenuOpen((open) => !open);
            setToolsOpen(false);
          }}
        />
      </div>
    </DemoFeedbackProvider>
  );
}

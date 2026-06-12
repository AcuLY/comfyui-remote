"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, FlaskConical, ImageIcon, Menu, Moon, MoreHorizontal, Sun } from "lucide-react";

import type { DemoData } from "../data";
import s from "./app-shell.module.css";
import { findHeaderSpecForRoute } from "../routing/header-specs";
import type { HeaderSpec } from "../routing/header-specs";
import { getHeaderActionSlots } from "./header-action-slots";
import { RouteHeaderSurface } from "./header-surface";
import { Button } from "../shared/primitives/button";
import { DemoFeedbackProvider } from "../shared/feedback";
import {
  DESIGN_DEMO_SFW_STORAGE_KEY,
  DESIGN_DEMO_THEME_STORAGE_KEY,
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  applyDesignDemoTheme,
  applyDesignDemoSfwMode,
  buildWorkModeNavLinks,
  cx,
  demoHref,
  isDesignDemoWorkModeValue,
  isDemoThemeValue,
  isNavActive,
  isSfwEnabledValue,
  resolveWorkModeForRoute,
} from "../routing";
import type { DemoTheme, DesignDemoWorkMode, NavLinkDef } from "../routing";

function readStoredWorkMode(): DesignDemoWorkMode {
  if (typeof window === "undefined") return "generation";
  try {
    const storedMode = window.localStorage.getItem(WORK_MODE_STORAGE_KEY);
    return isDesignDemoWorkModeValue(storedMode) ? storedMode : "generation";
  } catch {
    return "generation";
  }
}

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
  navLinks,
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
  navLinks: NavLinkDef[];
}) {
  const isLightTheme = theme === "light";
  const isDarkTheme = !isLightTheme;
  const ThemeIcon = isDarkTheme ? Sun : Moon;
  const SfwIcon = sfwMode ? EyeOff : Eye;
  const grouped = useMemo(() => {
    const map = new Map<string, NavLinkDef[]>();
    for (const link of navLinks) {
      if (!map.has(link.group)) map.set(link.group, []);
      map.get(link.group)!.push(link);
    }
    return [...map.entries()];
  }, [navLinks]);

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
  links,
  workMode,
}: {
  data: DemoData;
  currentRoute: string;
  links: NavLinkDef[];
  workMode: DesignDemoWorkMode;
}) {
  const isTrainingMode = workMode === "lora_training";
  const ModeIcon = isTrainingMode ? FlaskConical : ImageIcon;
  const modeText = isTrainingMode ? "LoRA 训练" : "生图模式";
  const modeLabel = `当前模式：${modeText}`;

  return (
    <nav className={s.mobileBottomNav} aria-label="移动端主导航">
      {links.map((link) => {
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
      <div className={s.mobileModeIndicator} aria-label={modeLabel} title={modeLabel}>
        <ModeIcon className={s.iconMd} aria-hidden="true" />
        <span>{modeText}</span>
      </div>
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

function DemoRouteHeader({
  config,
  compact,
  data,
  hidden,
  surfaceRef,
}: {
  config: HeaderSpec;
  compact: boolean;
  data: DemoData;
  hidden: boolean;
  surfaceRef: (node: HTMLElement | null) => void;
}) {
  const actionSlots = getHeaderActionSlots(config.key, data);

  return (
    <RouteHeaderSurface
      actionSlots={actionSlots}
      className={s.routeHeaderSurface}
      hidden={hidden}
      mode={compact ? "mobile" : "expanded"}
      spec={config}
      surfaceRef={surfaceRef}
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
  const routeHeaderHiddenRef = useRef(false);
  const routeHeaderInsetRef = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sidebarLayoutReady, setSidebarLayoutReady] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<DemoTheme>(initialTheme);
  const [sfwMode, setSfwMode] = useState(false);
  const [storedWorkMode, setStoredWorkMode] = useState<DesignDemoWorkMode>("generation");
  const [routeHeaderCompact, setRouteHeaderCompact] = useState(false);
  const [routeHeaderHidden, setRouteHeaderHidden] = useState(false);
  const isLightTheme = theme === "light";
  const routeHeaderConfig = useMemo(() => findHeaderSpecForRoute(data, currentRoute), [currentRoute, data]);
  const hasRouteHeader = Boolean(routeHeaderConfig);
  const setRouteHeaderNode = useCallback((node: HTMLElement | null) => {
    routeHeaderRef.current = node;
  }, []);
  const workMode = resolveWorkModeForRoute(currentRoute, storedWorkMode);
  const navLinks = useMemo(() => buildWorkModeNavLinks(workMode), [workMode]);
  const activeNav = useMemo(
    () => navLinks.find((link) => isNavActive(currentRoute, link.href, link.activePrefix)) ?? navLinks[0],
    [currentRoute, navLinks],
  );

  useEffect(() => {
    const sidebarQuery = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");

    function syncSidebarCollapse() {
      setSidebarCollapsed(sidebarQuery.matches);
      setSidebarLayoutReady(true);
    }

    syncSidebarCollapse();
    sidebarQuery.addEventListener("change", syncSidebarCollapse);

    const frameId = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(DESIGN_DEMO_THEME_STORAGE_KEY);
      const resolvedTheme = isDemoThemeValue(storedTheme) ? storedTheme : initialTheme;

      applyDesignDemoTheme(resolvedTheme);
      setTheme(resolvedTheme);
      setRouteHeaderCompact(window.matchMedia("(max-width: 760px)").matches);
      setSfwMode(isSfwEnabledValue(window.localStorage.getItem(DESIGN_DEMO_SFW_STORAGE_KEY)));
      setStoredWorkMode(readStoredWorkMode());
    });

    return () => {
      sidebarQuery.removeEventListener("change", syncSidebarCollapse);
      window.cancelAnimationFrame(frameId);
    };
  }, [initialTheme]);

  useEffect(() => {
    function syncStoredWorkMode() {
      setStoredWorkMode(readStoredWorkMode());
    }

    function handleWorkModeChange(event: Event) {
      const nextMode = (event as CustomEvent<{ mode?: string }>).detail?.mode ?? null;
      setStoredWorkMode(isDesignDemoWorkModeValue(nextMode) ? nextMode : readStoredWorkMode());
    }

    window.addEventListener("storage", syncStoredWorkMode);
    window.addEventListener(WORK_MODE_CHANGE_EVENT, handleWorkModeChange);
    return () => {
      window.removeEventListener("storage", syncStoredWorkMode);
      window.removeEventListener(WORK_MODE_CHANGE_EVENT, handleWorkModeChange);
    };
  }, []);

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
    const hideAfter = 96;
    const expandNearTop = 24;
    const minDirectionDelta = 10;

    function readScrollTop() {
      return mainRef.current?.scrollTop ?? 0;
    }

    function setHeaderHidden(nextHidden: boolean) {
      if (routeHeaderHiddenRef.current === nextHidden) return;
      routeHeaderHiddenRef.current = nextHidden;
      setRouteHeaderHidden(nextHidden);
    }

    if (!hasRouteHeader) {
      resetFrameId = window.requestAnimationFrame(() => setHeaderHidden(false));
      return () => window.cancelAnimationFrame(resetFrameId);
    }

    resetFrameId = window.requestAnimationFrame(() => {
      lastScrollTop = readScrollTop();
      setHeaderHidden(false);
    });

    function handleScroll() {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        const nextScrollTop = readScrollTop();
        const delta = nextScrollTop - lastScrollTop;

        if (nextScrollTop <= expandNearTop) {
          setHeaderHidden(false);
        } else if (delta >= minDirectionDelta && nextScrollTop >= hideAfter) {
          setHeaderHidden(true);
        } else if (delta <= -minDirectionDelta) {
          setHeaderHidden(false);
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
    <div className={cx(s.shell, isLightTheme && s.shellLight)} data-app-shell data-demo-font="harmonyos" data-theme={theme}>
      <DemoFeedbackProvider>
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
        <div className={cx(
          s.workspace,
          sidebarLayoutReady && s.workspaceSidebarReady,
          sidebarCollapsed && s.workspaceCollapsed,
          hasRouteHeader && s.workspaceWithRouteHeader,
        )}>
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
            navLinks={navLinks}
          />
          <div className={cx(s.contentFrame, hasRouteHeader && s.contentFrameWithRouteHeader)} ref={contentFrameRef}>
            {routeHeaderConfig ? (
              <DemoRouteHeader
                config={routeHeaderConfig}
                compact={routeHeaderCompact}
                data={data}
                hidden={routeHeaderHidden}
                surfaceRef={setRouteHeaderNode}
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
          links={navLinks}
          workMode={workMode}
        />
        <button
          className={cx(s.mobileNavDrawerButton, menuOpen && s.mobileNavDrawerButtonActive)}
          type="button"
          onClick={() => {
            setMenuOpen((open) => !open);
            setToolsOpen(false);
          }}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "关闭更多页面" : "打开更多页面"}
          title={menuOpen ? "关闭更多页面" : "打开更多页面"}
        >
          <Menu className={s.iconMd} aria-hidden="true" />
        </button>
      </DemoFeedbackProvider>
    </div>
  );
}

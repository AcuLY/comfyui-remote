"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  EyeOff,
  Menu,
  Moon,
  MoreHorizontal,
  X,
} from "lucide-react";

import type { DemoData } from "./design-demo-data";
import s from "./design-demo.module.css";
import { DemoFeedbackProvider } from "./design-demo-ui";
import {
  DESIGN_DEMO_SFW_STORAGE_KEY,
  DESIGN_DEMO_THEME_STORAGE_KEY,
  NAV_LINKS,
  applyDesignDemoSfwMode,
  cx,
  demoHref,
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
  const CollapseIcon = collapsed ? ArrowRight : ArrowLeft;
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
          <button className={cx(s.button, s.iconButton, s.sidebarCollapseButton)} type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}>
            <CollapseIcon className="size-4" />
          </button>
          <div className={cx(s.toolbar, s.brandIdentity)}>
            <div className={s.brandName}>
              <strong>ComfyUI Manager</strong>
              <span>创作工作台</span>
            </div>
          </div>
          <button className={cx(s.button, s.iconButton, s.mobileMenuButton)} type="button" onClick={onClose} aria-label="关闭菜单">
            <X className="size-4" />
          </button>
        </div>
        <div className={s.sidebarTools} aria-label="全局工具">
          <button
            className={cx(s.sidebarToggle, isDarkTheme && s.sidebarToggleActive)}
            type="button"
            role="switch"
            aria-checked={isDarkTheme}
            onClick={onToggleTheme}
          >
            <Moon className="size-4" />
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
            <EyeOff className="size-4" />
            <span>SFW</span>
            <span className={s.sidebarToggleSwitch} aria-hidden="true">
              <span />
            </span>
          </button>
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
                <Icon className="size-4" />
                <span>{link.label}</span>
                {link.count ? <em className={s.navCount}>{link.count(data)}</em> : null}
              </Link>
            );
          })}
        </nav>
      ))}
    </aside>
  );
}

function MobileTopbar({
  activeLabel,
  menuOpen,
  onOpenMenu,
  toolsOpen,
  onToggleTools,
  theme,
  onToggleTheme,
  sfwMode,
  onToggleSfwMode,
}: {
  activeLabel: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
  toolsOpen: boolean;
  onToggleTools: () => void;
  theme: DemoTheme;
  onToggleTheme: () => void;
  sfwMode: boolean;
  onToggleSfwMode: () => void;
}) {
  const isDarkTheme = theme === "dark";

  return (
    <div className={s.mobileTopbar}>
      <button
        className={cx(s.button, s.iconButton, s.mobileTopbarButton)}
        type="button"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-label="打开导航菜单"
      >
        <Menu className="size-4" />
      </button>
      <div className={s.mobileTopbarTitle}>
        <strong>{activeLabel}</strong>
        <span>ComfyUI Manager</span>
      </div>
      <div className={s.mobileTopbarTools}>
        <button
          className={cx(s.button, s.iconButton, s.mobileTopbarButton)}
          type="button"
          onClick={onToggleTools}
          aria-expanded={toolsOpen}
          aria-label="打开显示设置"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {toolsOpen ? (
          <div className={s.mobileToolsMenu} role="menu" aria-label="显示设置">
            <button
              className={cx(s.mobileToolsItem, isDarkTheme && s.mobileToolsItemActive)}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isDarkTheme}
              onClick={onToggleTheme}
            >
              <Moon className="size-4" />
              <span>暗色模式</span>
            </button>
            <button
              className={cx(s.mobileToolsItem, sfwMode && s.mobileToolsItemActive)}
              type="button"
              role="menuitemcheckbox"
              aria-checked={sfwMode}
              onClick={onToggleSfwMode}
            >
              <EyeOff className="size-4" />
              <span>SFW 模式</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DesignDemoShell({
  children,
  currentRoute,
  data,
}: {
  children: ReactNode;
  currentRoute: string;
  data: DemoData;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<DemoTheme>("light");
  const [sfwMode, setSfwMode] = useState(false);
  const isLightTheme = theme === "light";
  const activeNav = useMemo(
    () => NAV_LINKS.find((link) => isNavActive(currentRoute, link.href, link.activePrefix)) ?? NAV_LINKS[0],
    [currentRoute],
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(DESIGN_DEMO_THEME_STORAGE_KEY);
      setSfwMode(isSfwEnabledValue(window.localStorage.getItem(DESIGN_DEMO_SFW_STORAGE_KEY)));

      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
        return;
      }

      if (window.matchMedia("(prefers-color-scheme: light)").matches) {
        setTheme("light");
      }
    });

    return () => window.cancelAnimationFrame(frameId);
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

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem(DESIGN_DEMO_THEME_STORAGE_KEY, nextTheme);
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
      <div className={cx(s.shell, isLightTheme && s.shellLight)} data-theme={theme}>
        <MobileTopbar
          activeLabel={activeNav?.label ?? "工作台"}
          menuOpen={menuOpen}
          onOpenMenu={() => {
            setMenuOpen(true);
            setToolsOpen(false);
          }}
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
        {menuOpen ? (
          <button
            className={s.mobileNavBackdrop}
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="关闭导航菜单"
          />
        ) : null}
        <div className={cx(s.workspace, sidebarCollapsed && s.workspaceCollapsed)}>
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
          <main className={s.main}>
            {children}
          </main>
        </div>
      </div>
    </DemoFeedbackProvider>
  );
}

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "primereact/sidebar";

import { isNavActive } from "../routes";
import type { NavLink } from "../routes";
import type { PrototypeTheme } from "../theme";
import type { PrototypeWorkMode } from "../preferences";

function SidebarNav({
  links,
  currentRoute,
  onNavigate,
  theme,
  followingSystem,
  onSelectTheme,
}: {
  links: NavLink[];
  currentRoute: string;
  onNavigate: (href: string) => void;
  theme: PrototypeTheme;
  followingSystem: boolean;
  onSelectTheme: (choice: "light" | "dark") => void;
}) {
  const groups: Array<{ group: string; links: NavLink[] }> = [];
  for (const link of links) {
    const group = groups.find((item) => item.group === link.group);
    if (group) group.links.push(link);
    else groups.push({ group: link.group, links: [link] });
  }

  return (
    <nav className="shell-nav">
      {groups.map(({ group, links: groupLinks }) => (
        <div className="shell-nav-group" key={group}>
          <div className="shell-nav-group-title">{group}</div>
          {groupLinks.map((link) => (
            <a
              key={link.href}
              href={`#${link.href}`}
              className={`shell-nav-item${isNavActive(currentRoute, link.href) ? " active" : ""}`}
              onClick={() => onNavigate(link.href)}
            >
              <i className={link.icon} />
              <span>{link.label}</span>
            </a>
          ))}
          {group === "系统" ? (
            <div className="shell-tools">
              <div className="shell-tools-title">外观</div>
              <div className="shell-theme-options" role="group" aria-label="主题外观">
                <button
                  type="button"
                  className={`shell-theme-option${theme === "light" ? " active" : ""}`}
                  aria-pressed={theme === "light"}
                  onClick={() => onSelectTheme("light")}
                >
                  <i className="pi pi-sun" />
                  <span>浅色</span>
                </button>
                <button
                  type="button"
                  className={`shell-theme-option${theme === "dark" ? " active" : ""}`}
                  aria-pressed={theme === "dark"}
                  onClick={() => onSelectTheme("dark")}
                >
                  <i className="pi pi-moon" />
                  <span>深色</span>
                </button>
              </div>
              {followingSystem ? <div className="shell-theme-follow">跟随系统</div> : null}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export function Shell({
  currentRoute,
  workMode,
  theme,
  followingSystem,
  navLinks,
  header,
  onNavigate,
  onSelectTheme,
  children,
}: {
  currentRoute: string;
  workMode: PrototypeWorkMode;
  theme: PrototypeTheme;
  followingSystem: boolean;
  navLinks: NavLink[];
  header: { eyebrow: string; title: string };
  onNavigate: (href: string) => void;
  onSelectTheme: (choice: "light" | "dark") => void;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const modeLabel = workMode === "lora_training" ? "LoRA 训练" : "生图模式";
  const modeIcon = workMode === "lora_training" ? "pi pi-bolt" : "pi pi-image";

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <strong>ComfyUI Manager</strong>
          <span>创作工作台</span>
        </div>
        <SidebarNav
          links={navLinks}
          currentRoute={currentRoute}
          onNavigate={onNavigate}
          theme={theme}
          followingSystem={followingSystem}
          onSelectTheme={onSelectTheme}
        />
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div className="shell-header-title">
            <span className="shell-eyebrow">{header.eyebrow}</span>
            <h1>{header.title}</h1>
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>

      <nav className="shell-bottom-nav" aria-label="移动端主导航">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={`#${link.href}`}
            className={`shell-bottom-item${isNavActive(currentRoute, link.href) ? " active" : ""}`}
          >
            <i className={link.icon} />
            <span>{link.label}</span>
          </a>
        ))}
        <div className="shell-mode-indicator" title={`当前模式：${modeLabel}`} aria-label={`当前模式：${modeLabel}`}>
          <i className={modeIcon} />
          <span>{modeLabel}</span>
        </div>
      </nav>
      <button
        type="button"
        className="shell-mobile-nav-drawer-button"
        aria-label="打开导航"
        onClick={() => setMobileNavOpen(true)}
      >
        <i className="pi pi-bars" />
      </button>

      <Sidebar
        visible={mobileNavOpen}
        position="left"
        onHide={() => setMobileNavOpen(false)}
        blockScroll
        dismissable
        showCloseIcon
        className="shell-mobile-drawer"
        header={
          <span className="shell-brand">
            <strong>ComfyUI Manager</strong>
            <span>创作工作台</span>
          </span>
        }
      >
        <SidebarNav
          links={navLinks}
          currentRoute={currentRoute}
          onNavigate={(href) => {
            onNavigate(href);
            setMobileNavOpen(false);
          }}
          theme={theme}
          followingSystem={followingSystem}
          onSelectTheme={onSelectTheme}
        />
      </Sidebar>
    </div>
  );
}

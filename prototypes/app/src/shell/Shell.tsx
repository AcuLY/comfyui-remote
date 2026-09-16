import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "primereact/sidebar";

import { isNavActive } from "../routes";
import type { NavLink } from "../routes";
import type { PrototypeTheme } from "../theme";
import type { PrototypeWorkMode } from "../workMode";

function SidebarNav({
  links,
  currentRoute,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  links: NavLink[];
  currentRoute: string;
  onNavigate: (href: string) => void;
  theme: PrototypeTheme;
  onToggleTheme: () => void;
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
              <button
                type="button"
                className="shell-theme-toggle"
                role="switch"
                aria-checked={theme === "dark"}
                onClick={onToggleTheme}
              >
                <i className={theme === "dark" ? "pi pi-sun" : "pi pi-moon"} />
                <span>{theme === "dark" ? "浅色" : "暗色"}</span>
              </button>
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
  navLinks,
  header,
  onNavigate,
  onToggleTheme,
  children,
}: {
  currentRoute: string;
  workMode: PrototypeWorkMode;
  theme: PrototypeTheme;
  navLinks: NavLink[];
  header: { eyebrow: string; title: string };
  onNavigate: (href: string) => void;
  onToggleTheme: () => void;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const modeLabel = workMode === "lora_training" ? "LoRA 训练" : "生图模式";
  const modeIcon = workMode === "lora_training" ? "pi pi-bolt" : "pi pi-image";

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">ComfyUI Manager</div>
        <SidebarNav
          links={navLinks}
          currentRoute={currentRoute}
          onNavigate={onNavigate}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div className="shell-header-title">
            <span className="shell-eyebrow">{header.eyebrow}</span>
            <h1>{header.title}</h1>
          </div>
          <button
            type="button"
            className="shell-menu-button"
            aria-label="打开导航"
            onClick={() => setMobileNavOpen(true)}
          >
            <i className="pi pi-bars" />
          </button>
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

      <Sidebar
        visible={mobileNavOpen}
        position="left"
        onHide={() => setMobileNavOpen(false)}
        blockScroll
        dismissable
        showCloseIcon
        className="shell-mobile-drawer"
        header={<span className="shell-brand">ComfyUI Manager</span>}
      >
        <SidebarNav
          links={navLinks}
          currentRoute={currentRoute}
          onNavigate={(href) => {
            onNavigate(href);
            setMobileNavOpen(false);
          }}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      </Sidebar>
    </div>
  );
}

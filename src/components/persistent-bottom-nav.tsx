"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Database,
  FolderOpen,
  Images,
  LayoutTemplate,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/queue", label: "待审核", icon: Images },
  { href: "/projects", label: "项目", icon: FolderOpen },
  { href: "/assets/presets", label: "预制", icon: BookOpen },
  { href: "/assets/templates", label: "模板", icon: LayoutTemplate },
  { href: "/assets/models", label: "模型", icon: Database },
  { href: "/settings", label: "设置", icon: Settings },
];

const LAST_ROUTE_PREFIX = "comfyui-manager:last-route:";
const SCROLL_PREFIX = "comfyui-manager:scroll:";

function storageKey(prefix: string, value: string) {
  return `${prefix}${value}`;
}

function normalizeStoredRoute(route: string | null, fallback: string) {
  if (!route?.startsWith(fallback)) {
    return fallback;
  }

  return route;
}

function matchNavItem(pathname: string) {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? null;
}

function readCurrentUrl(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function saveCurrentRoute(pathname: string, searchParams: URLSearchParams) {
  const activeItem = matchNavItem(pathname);
  if (!activeItem) {
    return;
  }

  window.sessionStorage.setItem(
    storageKey(LAST_ROUTE_PREFIX, activeItem.href),
    readCurrentUrl(pathname, searchParams),
  );
}

export function PersistentBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [restoredRoutes, setRestoredRoutes] = useState<Record<string, string>>({});

  const currentUrl = useMemo(
    () => readCurrentUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  useEffect(() => {
    const entries = Object.fromEntries(
      navItems.map((item) => [
        item.href,
        normalizeStoredRoute(
          window.sessionStorage.getItem(storageKey(LAST_ROUTE_PREFIX, item.href)),
          item.href,
        ),
      ]),
    );
    setRestoredRoutes(entries);
  }, []);

  useEffect(() => {
    const activeItem = matchNavItem(pathname);
    if (!activeItem) {
      return;
    }

    saveCurrentRoute(pathname, searchParams);
    setRestoredRoutes((prev) =>
      prev[activeItem.href] === currentUrl
        ? prev
        : { ...prev, [activeItem.href]: currentUrl },
    );
  }, [currentUrl, pathname]);

  useEffect(() => {
    const scrollKey = storageKey(SCROLL_PREFIX, currentUrl);
    const savedScrollTop = window.sessionStorage.getItem(scrollKey);

    if (savedScrollTop !== null) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: Number(savedScrollTop) || 0, behavior: "instant" });
      });
    }

    const saveScroll = () => {
      window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    window.addEventListener("scroll", saveScroll, { passive: true });

    return () => {
      saveScroll();
      window.removeEventListener("scroll", saveScroll);
    };
  }, [currentUrl]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[var(--panel)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-5xl grid-cols-6 gap-1 px-2 py-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const restoredHref = restoredRoutes[href] ?? href;

          return (
            <Link
              key={href}
              href={active ? href : restoredHref}
              onClick={() => saveCurrentRoute(pathname, searchParams)}
              className={`flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] transition ${
                active
                  ? "bg-sky-500/12 text-sky-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

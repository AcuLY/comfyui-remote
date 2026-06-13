"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Database,
  FlaskConical,
  FolderOpen,
  Images,
  LayoutTemplate,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo } from "react";

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
  { href: "/training/runs", label: "LoRA训练", icon: FlaskConical },
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

function readRestoredRoute(href: string) {
  if (typeof window === "undefined") {
    return href;
  }

  return normalizeStoredRoute(
    window.sessionStorage.getItem(storageKey(LAST_ROUTE_PREFIX, href)),
    href,
  );
}

export function PersistentBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUrl = useMemo(
    () => readCurrentUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  useEffect(() => {
    const activeItem = matchNavItem(pathname);
    if (!activeItem) {
      return;
    }

    saveCurrentRoute(pathname, searchParams);
  }, [currentUrl, pathname, searchParams]);

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
      <div className="mx-auto grid max-w-5xl grid-cols-7 gap-0.5 px-1.5 py-2 sm:gap-1 sm:px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              onClick={(event) => {
                saveCurrentRoute(pathname, searchParams);
                if (active) {
                  return;
                }

                const restoredHref = readRestoredRoute(href);
                if (restoredHref !== href) {
                  event.preventDefault();
                  router.push(restoredHref);
                }
              }}
              className={`flex min-h-14 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10px] transition sm:rounded-2xl sm:px-1 sm:text-[11px] ${
                active
                  ? "bg-sky-500/12 text-sky-300"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate whitespace-nowrap leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

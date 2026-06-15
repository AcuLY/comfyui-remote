"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen,
  Database,
  FlaskConical,
  FolderOpen,
  Images,
  ImageIcon,
  LayoutTemplate,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  resolveStoredWorkMode,
  resolveWorkModeForPathname,
  WORK_MODE_CHANGE_EVENT,
  WORK_MODE_STORAGE_KEY,
  type WorkMode,
} from "@/lib/work-mode";

type NavItem = {
  activePrefix?: string | string[];
  href: string;
  label: string;
  icon: LucideIcon;
};

const modeAwareNavItems: Array<{
  generation: Pick<NavItem, "href" | "activePrefix">;
  icon: LucideIcon;
  label: string;
  lora_training: Pick<NavItem, "href" | "activePrefix">;
}> = [
  {
    label: "运行",
    icon: Images,
    generation: { href: "/queue" },
    lora_training: { href: "/training/runs", activePrefix: "/training/runs" },
  },
  {
    label: "项目",
    icon: FolderOpen,
    generation: { href: "/projects" },
    lora_training: { href: "/training/projects", activePrefix: "/training/projects" },
  },
  {
    label: "预制",
    icon: BookOpen,
    generation: { href: "/assets/presets" },
    lora_training: { href: "/training/presets", activePrefix: "/training/presets" },
  },
  {
    label: "模板",
    icon: LayoutTemplate,
    generation: { href: "/assets/templates" },
    lora_training: { href: "/training/templates", activePrefix: "/training/templates" },
  },
];

const sharedNavItems: NavItem[] = [
  { href: "/assets/models", label: "模型", icon: Database, activePrefix: ["/assets/models", "/assets/loras"] },
  { href: "/settings", label: "设置", icon: Settings, activePrefix: "/settings" },
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

function isNavItemActive(pathname: string, item: NavItem) {
  const prefixes = Array.isArray(item.activePrefix) ? item.activePrefix : [item.activePrefix ?? item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function buildNavItems(workMode: WorkMode): NavItem[] {
  return [
    ...modeAwareNavItems.map((item) => ({
      ...item[workMode],
      label: item.label,
      icon: item.icon,
    })),
    ...sharedNavItems,
  ];
}

function matchNavItem(pathname: string, navItems: NavItem[]) {
  return navItems.find((item) => isNavItemActive(pathname, item)) ?? null;
}

function readCurrentUrl(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function saveCurrentRoute(pathname: string, searchParams: URLSearchParams, navItems: NavItem[]) {
  const activeItem = navItems.find((item) => isNavItemActive(pathname, item));
  if (!activeItem) {
    return;
  }

  window.sessionStorage.setItem(
    storageKey(LAST_ROUTE_PREFIX, activeItem.href),
    readCurrentUrl(pathname, searchParams),
  );
}

function subscribeWorkMode(onStoreChange: () => void) {
  window.addEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(WORK_MODE_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getStoredWorkModeSnapshot() {
  return resolveStoredWorkMode(window.localStorage.getItem(WORK_MODE_STORAGE_KEY));
}

function getStoredWorkModeServerSnapshot(): WorkMode {
  return "generation";
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
  const storedWorkMode = useSyncExternalStore(
    subscribeWorkMode,
    getStoredWorkModeSnapshot,
    getStoredWorkModeServerSnapshot,
  );
  const workMode = resolveWorkModeForPathname(pathname, storedWorkMode);
  const navItems = useMemo(() => buildNavItems(workMode), [workMode]);
  const modeText = workMode === "lora_training" ? "LoRA 训练" : "生图模式";
  const modeLabel = `当前模式：${modeText}`;
  const ModeIcon = workMode === "lora_training" ? FlaskConical : ImageIcon;

  const currentUrl = useMemo(
    () => readCurrentUrl(pathname, searchParams),
    [pathname, searchParams],
  );

  useEffect(() => {
    const activeItem = matchNavItem(pathname, navItems);
    if (!activeItem) {
      return;
    }

    saveCurrentRoute(pathname, searchParams, navItems);
  }, [currentUrl, navItems, pathname, searchParams]);

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
      <div className="mx-auto grid max-w-5xl grid-cols-[repeat(6,minmax(0,1fr))_minmax(3.25rem,0.72fr)] gap-0.5 px-1.5 py-2 sm:gap-1 sm:px-2">
        {navItems.map((item) => {
          const { href, label, icon: Icon } = item;
          const active = isNavItemActive(pathname, item);

          return (
            <Link
              key={href}
              href={href}
              onClick={(event) => {
                saveCurrentRoute(pathname, searchParams, navItems);
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
        <div
          aria-label={modeLabel}
          title={modeLabel}
          className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-sky-400/20 bg-sky-500/10 px-0.5 py-2 text-[10px] text-sky-200 sm:rounded-2xl sm:px-1 sm:text-[11px]"
        >
          <ModeIcon className="size-4" aria-hidden="true" />
          <span className="max-w-full truncate whitespace-nowrap leading-tight">{modeText}</span>
        </div>
      </div>
    </nav>
  );
}

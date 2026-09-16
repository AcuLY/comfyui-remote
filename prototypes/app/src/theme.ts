import darkThemeUrl from "primereact/resources/themes/lara-dark-teal/theme.css?url";
import lightThemeUrl from "primereact/resources/themes/lara-light-teal/theme.css?url";

export type PrototypeTheme = "dark" | "light";

const THEME_STORAGE_KEY = "comfyui-manager-prototype:theme";

function isPrototypeTheme(value: string | null): value is PrototypeTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(): PrototypeTheme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPrototypeTheme(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: PrototypeTheme) {
  const link = document.getElementById("theme-link") as HTMLLinkElement | null;
  if (link) {
    link.href = theme === "dark" ? darkThemeUrl : lightThemeUrl;
  }
  document.documentElement.dataset.prototypeTheme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 私有模式等场景下存储失败不应打断主题切换
  }
}

export function initTheme() {
  applyTheme(readStoredTheme());
}

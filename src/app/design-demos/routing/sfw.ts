import type { DemoTheme } from "./types";

export const DESIGN_DEMO_THEME_STORAGE_KEY = "comfyui-manager:design-demo-theme-glass";
export const DESIGN_DEMO_THEME_COOKIE = "comfyui_manager_design_demo_theme";
export const DESIGN_DEMO_THEME_ATTRIBUTE = "data-design-demo-theme";
export const DESIGN_DEMO_SFW_STORAGE_KEY = "comfyui-manager:sfw-mode";
export const DESIGN_DEMO_SFW_ATTRIBUTE = "data-sfw-mode";
export const DESIGN_DEMO_SFW_EVENT = "comfyui-manager:sfw-mode-change";
const DESIGN_DEMO_THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isDemoThemeValue(value: string | null | undefined): value is DemoTheme {
  return value === "light" || value === "dark";
}

export function resolveDemoTheme(value: string | null | undefined, fallback: DemoTheme = "dark"): DemoTheme {
  return isDemoThemeValue(value) ? value : fallback;
}

export function applyDesignDemoTheme(theme: DemoTheme) {
  document.documentElement.setAttribute(DESIGN_DEMO_THEME_ATTRIBUTE, theme);
  window.localStorage.setItem(DESIGN_DEMO_THEME_STORAGE_KEY, theme);
  document.cookie = `${DESIGN_DEMO_THEME_COOKIE}=${theme}; Path=/design-demos; Max-Age=${DESIGN_DEMO_THEME_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function isSfwEnabledValue(value: string | null) {
  return value === "on";
}

export function applyDesignDemoSfwMode(enabled: boolean) {
  document.documentElement.setAttribute(DESIGN_DEMO_SFW_ATTRIBUTE, enabled ? "on" : "off");
  window.localStorage.setItem(DESIGN_DEMO_SFW_STORAGE_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(DESIGN_DEMO_SFW_EVENT));
}

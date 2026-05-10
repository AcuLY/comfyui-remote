export const DESIGN_DEMO_THEME_STORAGE_KEY = "comfyui-manager:design-demo-theme-glass";
export const DESIGN_DEMO_SFW_STORAGE_KEY = "comfyui-manager:sfw-mode";
export const DESIGN_DEMO_SFW_ATTRIBUTE = "data-sfw-mode";
export const DESIGN_DEMO_SFW_EVENT = "comfyui-manager:sfw-mode-change";

export function isSfwEnabledValue(value: string | null) {
  return value === "on";
}

export function applyDesignDemoSfwMode(enabled: boolean) {
  document.documentElement.setAttribute(DESIGN_DEMO_SFW_ATTRIBUTE, enabled ? "on" : "off");
  window.localStorage.setItem(DESIGN_DEMO_SFW_STORAGE_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(DESIGN_DEMO_SFW_EVENT));
}

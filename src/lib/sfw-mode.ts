export const SFW_MODE_STORAGE_KEY = "comfyui-manager:sfw-mode";
export const SFW_MODE_EVENT = "comfyui-manager:sfw-mode-change";
export const SFW_MODE_ATTRIBUTE = "data-sfw-mode";

export function isSfwModeEnabledValue(value: string | null): boolean {
  return value === "on";
}

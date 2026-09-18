import { useSyncExternalStore } from "react";

export type PrototypeTheme = "dark" | "light";
export type PrototypeThemePreference = "system" | PrototypeTheme;
export type PrototypeWorkMode = "generation" | "lora_training";

export const PREFERENCE_KEY = "cm-prototype-preference-v1";

const CHANGE_EVENT = "cm-prototype-preference-change";

type PrototypePreferences = {
  theme: PrototypeThemePreference;
  module: PrototypeWorkMode;
};

const DEFAULT_PREFERENCES: PrototypePreferences = { theme: "system", module: "generation" };

let cachedPreferences: PrototypePreferences | null = null;

function isThemePreference(value: unknown): value is PrototypeThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isWorkMode(value: unknown): value is PrototypeWorkMode {
  return value === "generation" || value === "lora_training";
}

function parsePreferences(): PrototypePreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<PrototypePreferences>;
    return {
      theme: isThemePreference(parsed.theme) ? parsed.theme : "system",
      module: isWorkMode(parsed.module) ? parsed.module : "generation",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function readPreferences(): PrototypePreferences {
  if (!cachedPreferences) cachedPreferences = parsePreferences();
  return cachedPreferences;
}

function writePreferences(next: PrototypePreferences) {
  cachedPreferences = next;
  try {
    window.localStorage.setItem(PREFERENCE_KEY, JSON.stringify(next));
  } catch {
    // 私有模式等场景下存储失败不应打断偏好变更
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", () => {
    cachedPreferences = null;
    onChange();
  });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}

export function usePrototypePreferences(): PrototypePreferences {
  return useSyncExternalStore(subscribe, readPreferences, () => DEFAULT_PREFERENCES);
}

export function systemTheme(): PrototypeTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: PrototypeThemePreference): PrototypeTheme {
  return preference === "system" ? systemTheme() : preference;
}

export function setThemePreference(next: PrototypeThemePreference) {
  writePreferences({ ...readPreferences(), theme: next });
}

export function usePrototypeWorkMode(): PrototypeWorkMode {
  return usePrototypePreferences().module;
}

export function setPrototypeWorkMode(nextMode: PrototypeWorkMode) {
  writePreferences({ ...readPreferences(), module: nextMode });
}

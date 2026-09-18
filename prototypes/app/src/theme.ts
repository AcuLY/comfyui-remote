import { readPreferences, resolveTheme } from "./preferences";
import type { PrototypeTheme } from "./preferences";

export type { PrototypeTheme } from "./preferences";

export type PrototypeThemeModule = "production" | "training";

/**
 * 主题与模块上下文写入根元素属性；生成主题按
 * `:where(:root[data-theme][data-module])` 作用域生效。
 */
export function applyThemeContext(theme: PrototypeTheme, module: PrototypeThemeModule) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.module = module;
  root.dataset.prototypeTheme = theme;
  root.style.colorScheme = theme;
}

export function initTheme() {
  const preferences = readPreferences();
  applyThemeContext(resolveTheme(preferences.theme), preferences.module === "lora_training" ? "training" : "production");
}

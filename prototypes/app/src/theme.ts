import darkThemeUrl from "primereact/resources/themes/lara-dark-teal/theme.css?url";
import lightThemeUrl from "primereact/resources/themes/lara-light-teal/theme.css?url";

import { readPreferences, resolveTheme } from "./preferences";
import type { PrototypeTheme } from "./preferences";

export type { PrototypeTheme } from "./preferences";

export function applyTheme(theme: PrototypeTheme) {
  const link = document.getElementById("theme-link") as HTMLLinkElement | null;
  if (link) {
    link.href = theme === "dark" ? darkThemeUrl : lightThemeUrl;
  }
  document.documentElement.dataset.prototypeTheme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initTheme() {
  applyTheme(resolveTheme(readPreferences().theme));
}

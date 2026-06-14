import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "@/app/design-demos/routing/sfw";

export const TRAINING_THEME_COOKIE = DESIGN_DEMO_THEME_COOKIE;

export function resolveTrainingTheme(cookieValue?: string | null) {
  return resolveDemoTheme(cookieValue);
}

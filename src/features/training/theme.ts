export type TrainingTheme = "dark" | "light";

export const TRAINING_THEME_COOKIE = "comfyui_manager_design_demo_theme";

function isTrainingThemeValue(value: string | null | undefined): value is TrainingTheme {
  return value === "dark" || value === "light";
}

export function resolveTrainingTheme(cookieValue?: string | null, fallback: TrainingTheme = "dark") {
  return isTrainingThemeValue(cookieValue) ? cookieValue : fallback;
}

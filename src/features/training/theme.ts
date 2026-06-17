export type TrainingTheme = "dark" | "light";

export const TRAINING_THEME_STORAGE_KEY = "comfyui-manager:training-theme";
export const TRAINING_THEME_COOKIE = "comfyui_manager_training_theme";
export const TRAINING_THEME_COOKIE_PATH = "/training";
export const TRAINING_THEME_PERSISTENCE = {
  storageKey: TRAINING_THEME_STORAGE_KEY,
  cookieName: TRAINING_THEME_COOKIE,
  cookiePath: TRAINING_THEME_COOKIE_PATH,
} as const;

function isTrainingThemeValue(value: string | null | undefined): value is TrainingTheme {
  return value === "dark" || value === "light";
}

export function resolveTrainingTheme(cookieValue?: string | null, fallback: TrainingTheme = "dark") {
  return isTrainingThemeValue(cookieValue) ? cookieValue : fallback;
}

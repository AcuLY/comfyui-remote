export const loraCategories = ["characters", "styles", "poses", "misc"] as const;

export type LoraCategory = (typeof loraCategories)[number];

export type LoraUploadState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const initialLoraUploadState: LoraUploadState = {
  status: "idle",
  message: null,
};

export function isLoraCategory(value: string): value is LoraCategory {
  return loraCategories.includes(value as LoraCategory);
}

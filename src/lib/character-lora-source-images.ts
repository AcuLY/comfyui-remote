export const CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE = "source" as const;

/**
 * Uploaded Character LoRA reference images no longer expose user-facing role/use labels.
 * Keep accepting legacy role values from old forms/API clients, but store new uploads under
 * the single ordinary source role so future UI does not require this distinction.
 */
export function normalizeSourceImageUploadRole(value: unknown): typeof CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE {
  void value;
  return CHARACTER_LORA_UNDIFFERENTIATED_SOURCE_ROLE;
}

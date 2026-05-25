import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes a raw `civitaiLinks` JSON value into a clean string array,
 * filtering out non-string entries and empty strings.
 */
export function normalizeCivitaiLinks(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

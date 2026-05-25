/**
 * Shared CSV serialization and comparison utilities used by Phase 0 and Phase 1
 * quality modules.
 */

export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = spreadsheetSafeText(value);
  if (!/[",\n\r]|^\s|\s$/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function spreadsheetSafeText(value: unknown): string {
  const text = String(value);
  if (typeof value === "string" && /^[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

export function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

export function parseNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

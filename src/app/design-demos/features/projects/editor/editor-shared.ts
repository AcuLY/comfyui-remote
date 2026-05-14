export function parseHue(color: string | null | undefined): number {
  if (!color) return 220;
  const match = color.match(/^(\d+)/);
  if (match) return parseInt(match[1], 10);
  const LEGACY: Record<string, number> = {
    sky: 200,
    emerald: 160,
    violet: 270,
    amber: 38,
    rose: 350,
    cyan: 185,
    pink: 330,
    orange: 25,
  };
  return LEGACY[color] ?? 220;
}

/**
 * Convert a relative DB image path to an API URL.
 *
 * DB stores paths like "data/images/job-slug/run-00/raw/01.png".
 * The `/api/images/[...path]` route serves from the `data/images/` directory,
 * so we strip that prefix and prepend `/api/images/`.
 */

const DATA_IMAGES_PREFIX = "data/images/";

export function toImageUrl(relativePath: string | null): string | null {
  if (!relativePath) return null;
  const stripped = relativePath.startsWith(DATA_IMAGES_PREFIX)
    ? relativePath.slice(DATA_IMAGES_PREFIX.length)
    : relativePath;
  return `/api/images/${stripped}`;
}

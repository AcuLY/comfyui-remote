/**
 * Convert a relative DB image path to an API URL.
 *
 * DB stores paths like "data/images/job-slug/run-00/raw/01.png".
 * The `/api/images/[...path]` route serves from the `data/images/` directory,
 * so we strip that prefix and prepend `/api/images/`.
 */

const DATA_IMAGES_PREFIX = "data/images/";

type ImageUrlVersion = Date | number | string | null | undefined;

function normalizeImageUrlVersion(version: ImageUrlVersion) {
  if (version == null) return null;
  const value = version instanceof Date ? version.toISOString() : String(version);
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function toImageUrl(
  relativePath: string | null,
  version?: ImageUrlVersion,
): string | null {
  if (!relativePath) return null;
  const stripped = relativePath.startsWith(DATA_IMAGES_PREFIX)
    ? relativePath.slice(DATA_IMAGES_PREFIX.length)
    : relativePath;
  const url = `/api/images/${stripped}`;
  const normalizedVersion = normalizeImageUrlVersion(version);
  return normalizedVersion ? `${url}?v=${encodeURIComponent(normalizedVersion)}` : url;
}

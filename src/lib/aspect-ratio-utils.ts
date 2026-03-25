/**
 * Shared aspect-ratio → resolution utilities.
 *
 * Both front-end pickers and back-end prompt builders import from here so that
 * the mapping stays consistent in one place.
 */

// ---------------------------------------------------------------------------
// Base lookup – SDXL-optimal resolutions with short side ~768-1024
// ---------------------------------------------------------------------------

export const ASPECT_RATIOS: Record<
  string,
  { width: number; height: number; ratioW: number; ratioH: number }
> = {
  "1:1":  { width: 1024, height: 1024, ratioW: 1,  ratioH: 1  },
  "3:4":  { width: 896,  height: 1152, ratioW: 3,  ratioH: 4  },
  "4:3":  { width: 1152, height: 896,  ratioW: 4,  ratioH: 3  },
  "9:16": { width: 768,  height: 1344, ratioW: 9,  ratioH: 16 },
  "16:9": { width: 1344, height: 768,  ratioW: 16, ratioH: 9  },
  "2:3":  { width: 832,  height: 1216, ratioW: 2,  ratioH: 3  },
  "3:2":  { width: 1216, height: 832,  ratioW: 3,  ratioH: 2  },
};

const DEFAULT_RATIO = "3:4";

// ---------------------------------------------------------------------------
// Resolution resolver
// ---------------------------------------------------------------------------

/**
 * Resolve actual pixel dimensions from an aspect ratio key and an optional
 * short-side pixel override.
 *
 * If `shortSidePx` is provided, the short side is set to that value and the
 * long side is calculated from the ratio, rounded to the nearest multiple of 8
 * (important for Stable Diffusion / latent compatibility).
 *
 * If `shortSidePx` is null / undefined, the built-in SDXL-optimal resolution
 * is returned as-is.
 */
export function resolveResolution(
  aspectRatio: string | null | undefined,
  shortSidePx?: number | null,
): { width: number; height: number } {
  const entry = ASPECT_RATIOS[aspectRatio ?? DEFAULT_RATIO] ?? ASPECT_RATIOS[DEFAULT_RATIO];

  if (!shortSidePx || shortSidePx <= 0) {
    return { width: entry.width, height: entry.height };
  }

  // 1:1 square — both sides are the same
  if (entry.ratioW === entry.ratioH) {
    const side = roundTo8(shortSidePx);
    return { width: side, height: side };
  }

  const isPortrait = entry.height > entry.width; // short side = width
  const ratioLong = Math.max(entry.ratioW, entry.ratioH);
  const ratioShort = Math.min(entry.ratioW, entry.ratioH);

  const shortSide = roundTo8(shortSidePx);
  const longSide = roundTo8(shortSide * (ratioLong / ratioShort));

  return isPortrait
    ? { width: shortSide, height: longSide }
    : { width: longSide, height: shortSide };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to nearest multiple of 8 (latent space alignment). */
function roundTo8(n: number): number {
  return Math.round(n / 8) * 8;
}

/**
 * Get the default short-side pixel value for an aspect ratio entry.
 * Useful for displaying the "built-in" value in the UI.
 */
export function getDefaultShortSidePx(aspectRatio: string | null | undefined): number {
  const entry = ASPECT_RATIOS[aspectRatio ?? DEFAULT_RATIO] ?? ASPECT_RATIOS[DEFAULT_RATIO];
  return Math.min(entry.width, entry.height);
}

/**
 * Thumbnail Generator
 *
 * Generates thumbnails for output images. Currently uses a simple file-copy
 * approach as a placeholder. For production, install `sharp` for real resizing:
 *
 *   npm install sharp
 *
 * Then update this module to use sharp for high-quality thumbnail generation.
 */

import { writeFile } from "fs/promises";

/**
 * Generate a thumbnail from an image buffer.
 *
 * @param sourceBuffer  Raw image data
 * @param outputPath    Where to write the thumbnail
 * @param maxWidth      Max width in pixels (default 400)
 */
export async function generateThumbnail(
  sourceBuffer: Buffer,
  outputPath: string,
  maxWidth = 400
): Promise<void> {
  // Try sharp if available, otherwise fall back to copying the original
  try {
    // Dynamic import to avoid hard dependency
    const sharp = (await import("sharp")).default;

    const resized = await sharp(sourceBuffer)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    await writeFile(outputPath, resized);
  } catch {
    // sharp not installed — just copy the raw image as thumb
    // This is acceptable for development; install sharp for production
    console.warn("[thumbnail] sharp not available, using raw image as thumbnail");
    await writeFile(outputPath, sourceBuffer);
  }
}

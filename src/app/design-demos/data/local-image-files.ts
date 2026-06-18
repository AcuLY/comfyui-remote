import fs from "node:fs";
import path from "node:path";

const DATA_IMAGES_PREFIX = "data/images/";

function outputImageRoot() {
  const outputBasePath = process.env.OUTPUT_BASE_PATH;
  return outputBasePath ? path.resolve(/* turbopackIgnore: true */ outputBasePath) : null;
}

function stripDataImagesPrefix(value: string) {
  const normalized = value.replace(/\\/g, "/");
  return normalized.startsWith(DATA_IMAGES_PREFIX) ? normalized.slice(DATA_IMAGES_PREFIX.length) : normalized;
}

function isInsideImageRoot(root: string, resolved: string) {
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (process.platform === "win32") {
    return resolved.toLowerCase().startsWith(rootWithSeparator.toLowerCase());
  }
  return resolved.startsWith(rootWithSeparator);
}

function readImageDimensions(filePath: string) {
  const buffer = fs.readFileSync(/* turbopackIgnore: true */ filePath, { flag: "r" }).subarray(0, 65536);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame && offset + 8 < buffer.length) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }
  return null;
}

export function isRenderableLocalImageFile(filePath: string) {
  try {
    const fileStat = fs.statSync(/* turbopackIgnore: true */ filePath);
    if (!fileStat.isFile() || fileStat.size <= 0) return false;

    const dimensions = readImageDimensions(filePath);
    if (dimensions) return dimensions.width > 1 && dimensions.height > 1;

    return fileStat.size > 512;
  } catch {
    return false;
  }
}

export function isRenderableLocalImagePath(value: string) {
  const relativePath = stripDataImagesPrefix(value);
  if (!relativePath) return false;

  const root = outputImageRoot();
  if (!root) return false;

  const resolved = path.resolve(/* turbopackIgnore: true */ root, relativePath);
  if (!isInsideImageRoot(root, resolved)) return false;

  return isRenderableLocalImageFile(resolved);
}

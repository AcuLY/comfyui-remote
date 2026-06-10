export const AUTO_CENSOR_MOSAIC_SIZE = 100;

export type QuickCensorBrushSettings = {
  areaSize: number;
  blockSize: number;
};

export type MosaicRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getMosaicBlockSize(mosaicSize = AUTO_CENSOR_MOSAIC_SIZE) {
  return Math.max(1, Math.floor(mosaicSize * 0.1));
}

export function getQuickCensorBrushSettings(
  mosaicSize = AUTO_CENSOR_MOSAIC_SIZE,
): QuickCensorBrushSettings {
  return {
    areaSize: mosaicSize,
    blockSize: getMosaicBlockSize(mosaicSize),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function mosaicImageData(
  data: Uint8ClampedArray,
  input: {
    blockSize: number;
    height: number;
    rect: MosaicRect;
    width: number;
  },
) {
  const blockSize = Math.max(1, Math.floor(input.blockSize));
  const left = clamp(Math.floor(input.rect.x), 0, input.width);
  const top = clamp(Math.floor(input.rect.y), 0, input.height);
  const right = clamp(Math.ceil(input.rect.x + input.rect.width), left, input.width);
  const bottom = clamp(Math.ceil(input.rect.y + input.rect.height), top, input.height);

  for (let blockTop = top; blockTop < bottom; blockTop += blockSize) {
    for (let blockLeft = left; blockLeft < right; blockLeft += blockSize) {
      const sampleIndex = (blockTop * input.width + blockLeft) * 4;
      const red = data[sampleIndex] ?? 0;
      const green = data[sampleIndex + 1] ?? 0;
      const blue = data[sampleIndex + 2] ?? 0;
      const alpha = data[sampleIndex + 3] ?? 255;
      const blockRight = Math.min(blockLeft + blockSize, right);
      const blockBottom = Math.min(blockTop + blockSize, bottom);

      for (let y = blockTop; y < blockBottom; y += 1) {
        for (let x = blockLeft; x < blockRight; x += 1) {
          const index = (y * input.width + x) * 4;
          data[index] = red;
          data[index + 1] = green;
          data[index + 2] = blue;
          data[index + 3] = alpha;
        }
      }
    }
  }
}

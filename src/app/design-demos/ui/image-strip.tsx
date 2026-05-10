"use client";

import type { DemoImage } from "../design-demo-data";
import { ImageListSmall } from "./image-list-small";

export function ImageStrip({ images, wide = false }: { images: DemoImage[]; wide?: boolean }) {
  return <ImageListSmall images={images} wide={wide} />;
}

import type { DemoImage } from "../data";

function svgImageDataUri(label: string, hue: number) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1800">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 78% 54%)"/>
          <stop offset="0.56" stop-color="hsl(${(hue + 48) % 360} 76% 48%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 136) % 360} 70% 42%)"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="1800" fill="url(#bg)"/>
      <circle cx="340" cy="420" r="170" fill="rgba(255,255,255,0.22)"/>
      <text x="80" y="1640" fill="white" font-family="Inter, Arial, sans-serif" font-size="118" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function makeImages(count: number): DemoImage[] {
  return Array.from({ length: count }, (_, i) => {
    const src = svgImageDataUri(`Image ${i + 1}`, (i * 34 + 160) % 360);
    return {
      id: `showcase-${i}`,
      src,
      full: src,
      label: `Image ${i + 1}`,
      status: (i % 3 === 0 ? "kept" : i % 5 === 0 ? "trashed" : "pending") as DemoImage["status"],
      featured: i % 4 === 0,
      featured2: i % 6 === 0,
      cover: i === 1,
      width: 1200,
      height: 1800,
    };
  });
}

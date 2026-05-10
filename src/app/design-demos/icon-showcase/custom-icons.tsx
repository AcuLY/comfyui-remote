import { createSvgIcon, createSvgIconFromString, type SvgIconComponent } from "../svg-icon";

/** 示例：用 createSvgIcon 创建描边风格图标 */
export const ComfyuiIcon = createSvgIcon({
  displayName: "ComfyuiIcon",
  children: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8M12 8v8" />
    </>
  ),
});

/** 示例：用 createSvgIcon 创建填充风格图标 */
export const HeartFilledIcon = createSvgIcon({
  displayName: "HeartFilledIcon",
  fill: "currentColor",
  defaultStrokeWidth: 0,
  children: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
});

/** 示例：用 createSvgIconFromString 从原始 SVG 字符串创建图标 */
export const FlameIcon = createSvgIconFromString({
  displayName: "FlameIcon",
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>`,
});

/** 示例：非 24x24 viewBox 的图标 */
export const HexagonIcon = createSvgIcon({
  displayName: "HexagonIcon",
  viewBox: "0 0 100 100",
  children: <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" />,
});

export const CUSTOM_ICONS: Array<{ icon: SvgIconComponent; name: string; desc: string; source: string }> = [
  { icon: ComfyuiIcon, name: "ComfyuiIcon", desc: "自定义描边图标（createSvgIcon）", source: "createSvgIcon" },
  { icon: HeartFilledIcon, name: "HeartFilledIcon", desc: "填充风格爱心（createSvgIcon + fill）", source: "createSvgIcon" },
  { icon: FlameIcon, name: "FlameIcon", desc: "火焰图标（createSvgIconFromString）", source: "createSvgIconFromString" },
  { icon: HexagonIcon, name: "HexagonIcon", desc: "六边形（非 24×24 viewBox）", source: "createSvgIcon" },
];

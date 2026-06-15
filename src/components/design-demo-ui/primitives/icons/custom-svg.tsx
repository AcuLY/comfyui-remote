"use client";

import { forwardRef } from "react";
import type { ComponentType } from "react";
import type { RouteIcon } from "@/app/design-demos/routing";

/* ───────────────────────── types ───────────────────────── */

/** 与 LucideIcon API 一致的 SVG 图标 props */
export type SvgIconProps = {
  className?: string;
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
  style?: React.CSSProperties;
};

/** 由 createSvgIcon 返回的组件类型，同时满足 RouteIcon 和 LucideIcon 接口 */
export type SvgIconComponent = ComponentType<SvgIconProps> & RouteIcon;

/* ───────────────────────── base component ───────────────────────── */

/**
 * 通用 SVG 图标组件，遵循 Lucide 图标 API。
 *
 * ```tsx
 * // 直接使用
 * <SvgIcon viewBox="0 0 24 24">
 *   <path d="M12 2v20M2 12h20" />
 * </SvgIcon>
 * ```
 */
export const SvgIcon = forwardRef<SVGSVGElement, SvgIconProps & {
  viewBox?: string;
  fill?: string;
  children: React.ReactNode;
}>(function SvgIcon(
  {
    children,
    className,
    size = 24,
    color,
    strokeWidth = 2,
    style,
    viewBox = "0 0 24 24",
    fill = "none",
  },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill={fill}
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
});

/* ───────────────────────── factory ───────────────────────── */

/**
 * 从 SVG 子元素创建可复用的图标组件，返回的组件遵循 Lucide 图标 API。
 *
 * ```tsx
 * const ComfyuiIcon = createSvgIcon({
 *   // 可选，显示名，便于 DevTools 调试
 *   displayName: "ComfyuiIcon",
 *   // 可选，默认 "0 0 24 24"
 *   viewBox: "0 0 24 24",
 *   // 可选，默认 "none"（描边图标）；设为 "currentColor" 则为填充图标
 *   fill: "none",
 *   // 可选，默认 2
 *   defaultStrokeWidth: 2,
 *   // SVG 子元素
 *   children: <path d="M12 2L2 7l10 5 10-5-10-5z" />,
 * });
 *
 * // 使用 —— 和 lucide-react 图标完全一样
 * <ComfyuiIcon size={20} style={{ color: "#2563eb" }} />
 * <Button icon={ComfyuiIcon}>ComfyUI</Button>
 * ```
 */
export function createSvgIcon(options: {
  displayName?: string;
  viewBox?: string;
  fill?: string;
  defaultStrokeWidth?: number;
  children: React.ReactNode;
}): SvgIconComponent {
  const {
    displayName = "SvgIcon",
    viewBox = "0 0 24 24",
    fill = "none",
    defaultStrokeWidth = 2,
    children,
  } = options;

  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function IconInner(props, ref) {
    return (
      <SvgIcon
        ref={ref}
        viewBox={viewBox}
        fill={fill}
        strokeWidth={defaultStrokeWidth}
        {...props}
      >
        {children}
      </SvgIcon>
    );
  });

  Icon.displayName = displayName;
  return Icon as SvgIconComponent;
}

/* ───────────────────────── from raw SVG string ───────────────────────── */

/**
 * 从原始 SVG 字符串创建图标组件。
 * 会自动提取 `<svg>` 内部的子元素、viewBox、fill 等属性。
 *
 * ```tsx
 * // 把整个 <svg>...</svg> 字符串粘贴进来即可
 * const MyIcon = createSvgIconFromString({
 *   displayName: "MyIcon",
 *   svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
 *     <path d="M12 2v20M2 12h20" />
 *   </svg>`,
 * });
 * ```
 */
export function createSvgIconFromString(options: {
  displayName?: string;
  svg: string;
  defaultStrokeWidth?: number;
}): SvgIconComponent {
  const { displayName, svg, defaultStrokeWidth = 2 } = options;

  // 解析 SVG 字符串提取属性和内容
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const fillMatch = svg.match(/fill="([^"]+)"/);
  const strokeWidthMatch = svg.match(/stroke-width="([^"]+)"/);

  // 提取 <svg>...</svg> 之间的内容
  const innerContent = svg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "").trim();

  // 将 inner HTML 转为 React elements（通过 dangerouslySetInnerHTML 的中间层）
  const viewBox = viewBoxMatch?.[1] ?? "0 0 24 24";
  const fill = fillMatch?.[1] ?? "none";
  const parsedStrokeWidth = strokeWidthMatch?.[1]
    ? Number(strokeWidthMatch[1])
    : defaultStrokeWidth;

  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function IconFromStringInner(props, ref) {
    return (
      <SvgIcon
        ref={ref}
        viewBox={viewBox}
        fill={fill}
        strokeWidth={parsedStrokeWidth}
        {...props}
      >
        <g dangerouslySetInnerHTML={{ __html: innerContent }} />
      </SvgIcon>
    );
  });

  Icon.displayName = displayName ?? "SvgIconFromString";
  return Icon as SvgIconComponent;
}

/* ───────────────────────── from SVG file URL ───────────────────────── */

/**
 * 从 SVG 文件的 URL（本地路径或远程 URL）创建图标组件。
 * 内部使用 `<use href>` 引用 SVG，因此需要 SVG 文件可通过 URL 访问。
 *
 * > 注意：对于 Next.js public 目录下的 SVG 文件，使用此方式最简单。
 * > SVG 文件需要是"可引用"的（不含外部样式表等）。
 *
 * ```tsx
 * const LogoIcon = createSvgIconFromUrl({
 *   displayName: "LogoIcon",
 *   href: "/icons/logo.svg",
 *   viewBox: "0 0 24 24",
 * });
 *
 * <LogoIcon size={32} />
 * ```
 */
export function createSvgIconFromUrl(options: {
  displayName?: string;
  href: string;
  viewBox?: string;
}): SvgIconComponent {
  const { displayName = "SvgIconFromUrl", href, viewBox = "0 0 24 24" } = options;

  const Icon = forwardRef<SVGSVGElement, SvgIconProps>(function IconFromUrlInner(props, ref) {
    return (
      <SvgIcon ref={ref} viewBox={viewBox} {...props}>
        <use href={href} />
      </SvgIcon>
    );
  });

  Icon.displayName = displayName;
  return Icon as SvgIconComponent;
}

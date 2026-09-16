import localFont from "next/font/local";

/**
 * 组件实验室与新版原型的共享等宽字体。字体文件位于本目录，供
 * src/app/design-demos/layout.tsx 与 src/app/prototype/layout.tsx 复用。
 */
export const ibmPlexMono = localFont({
  src: [
    { path: "./ibm-plex-mono/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./ibm-plex-mono/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./ibm-plex-mono/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./ibm-plex-mono/IBMPlexMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-demo-ibm-plex-mono",
  display: "swap",
});

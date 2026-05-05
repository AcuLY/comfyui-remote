import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./fonts/font-options.css";

const mapleMono = localFont({
  src: [
    {
      path: "./fonts/maple-mono/MapleMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/maple-mono/MapleMono-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/maple-mono/MapleMono-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/maple-mono/MapleMono-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/maple-mono/MapleMono-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/maple-mono/MapleMono-SemiBoldItalic.ttf",
      weight: "600",
      style: "italic",
    },
    {
      path: "./fonts/maple-mono/MapleMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/maple-mono/MapleMono-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-demo-maple-mono",
  display: "swap",
  fallback: ["Cascadia Code", "ui-monospace", "monospace"],
});

export default function DesignDemosLayout({ children }: { children: ReactNode }) {
  return <div className={mapleMono.variable}>{children}</div>;
}

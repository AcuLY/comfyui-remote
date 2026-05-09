import type { ReactNode } from "react";
import { Fira_Code, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./fonts/font-options.css";
import "./design-demo-styles/index.css";

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

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-demo-jetbrains-mono",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-demo-fira-code",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-demo-ibm-plex-mono",
  display: "swap",
});

export default function DesignDemosLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${mapleMono.variable} ${jetBrainsMono.variable} ${firaCode.variable} ${ibmPlexMono.variable}`}>
      {children}
    </div>
  );
}

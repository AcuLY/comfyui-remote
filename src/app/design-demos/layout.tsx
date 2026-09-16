import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./fonts/font-options.css";

const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-mono/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/ibm-plex-mono/IBMPlexMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-demo-ibm-plex-mono",
  display: "swap",
});

export default function DesignDemosLayout({ children }: { children: ReactNode }) {
  return <div className={ibmPlexMono.variable}>{children}</div>;
}

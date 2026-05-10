import type { ReactNode } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import "./fonts/font-options.css";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-demo-ibm-plex-mono",
  display: "swap",
});

export default function DesignDemosLayout({ children }: { children: ReactNode }) {
  return <div className={ibmPlexMono.variable}>{children}</div>;
}

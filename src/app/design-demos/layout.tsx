import type { ReactNode } from "react";
import "./fonts/font-options.css";
import { ibmPlexMono } from "./fonts/plex-mono";

export default function DesignDemosLayout({ children }: { children: ReactNode }) {
  return <div className={ibmPlexMono.variable}>{children}</div>;
}

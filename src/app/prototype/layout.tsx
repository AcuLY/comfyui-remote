import type { ReactNode } from "react";

import "@/app/design-demos/fonts/font-options.css";
import { ibmPlexMono } from "@/app/design-demos/fonts/plex-mono";

export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return <div className={ibmPlexMono.variable}>{children}</div>;
}

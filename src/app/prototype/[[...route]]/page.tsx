import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "@/app/design-demos/routing";

import { PrototypeApp } from "../prototype-app-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ComfyUI Manager",
  description: "ComfyUI Manager 新版应用完整原型。",
};

export default async function PrototypePage() {
  const cookieStore = await cookies();
  const initialTheme = resolveDemoTheme(cookieStore.get(DESIGN_DEMO_THEME_COOKIE)?.value);

  return <PrototypeApp initialTheme={initialTheme} />;
}

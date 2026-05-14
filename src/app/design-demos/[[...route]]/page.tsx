import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DesignDemoApp } from "../shell/app-client";
import { loadDesignDemoData } from "../data/load-demo-data";
import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "../routing/sfw";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ComfyUI Manager",
  description: "ComfyUI Manager frontend workspace.",
};

export default async function DesignDemosPage({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  const [{ route }, data, cookieStore] = await Promise.all([params, loadDesignDemoData(), cookies()]);
  const initialTheme = resolveDemoTheme(cookieStore.get(DESIGN_DEMO_THEME_COOKIE)?.value);

  return <DesignDemoApp initialRouteSegments={route ?? []} data={data} initialTheme={initialTheme} />;
}

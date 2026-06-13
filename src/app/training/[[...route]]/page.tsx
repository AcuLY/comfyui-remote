import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { loadDesignDemoData } from "@/app/design-demos/data/load-demo-data";
import { DESIGN_DEMO_THEME_COOKIE, resolveDemoTheme } from "@/app/design-demos/routing/sfw";
import { TrainingApp } from "../training-app-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ComfyUI Manager Training",
  description: "ComfyUI Manager LoRA training workspace.",
};

export default async function TrainingPage({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  const [{ route }, data, cookieStore] = await Promise.all([params, loadDesignDemoData(), cookies()]);

  if (!route?.length) {
    redirect("/training/runs");
  }

  const initialTheme = resolveDemoTheme(cookieStore.get(DESIGN_DEMO_THEME_COOKIE)?.value);

  return <TrainingApp data={data} initialTheme={initialTheme} />;
}

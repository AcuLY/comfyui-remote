import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { resolveTrainingTheme, TRAINING_THEME_COOKIE } from "@/features/training/theme";
import { loadTrainingRouteData } from "../load-training-route-data";
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
  const [{ route }, cookieStore] = await Promise.all([params, cookies()]);
  const resolvedRoute = route ?? [];

  if (!resolvedRoute.length) {
    redirect("/training/runs");
  }

  const data = await loadTrainingRouteData(resolvedRoute);
  const initialTheme = resolveTrainingTheme(cookieStore.get(TRAINING_THEME_COOKIE)?.value);

  return <TrainingApp data={data} initialTheme={initialTheme} />;
}

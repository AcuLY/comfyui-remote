import type { Metadata } from "next";

import { DesignDemoApp } from "../design-demo-client";
import { loadDesignDemoData } from "../design-demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Design Demos - ComfyUI Manager",
  description: "Routable frontend shell demos for ComfyUI Manager.",
};

export default async function DesignDemosPage({
  params,
}: {
  params: Promise<{ route?: string[] }>;
}) {
  const [{ route }, data] = await Promise.all([params, loadDesignDemoData()]);

  return <DesignDemoApp initialRouteSegments={route ?? []} data={data} />;
}

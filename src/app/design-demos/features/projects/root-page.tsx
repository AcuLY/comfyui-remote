"use client";

import type { DemoData } from "../../data";
import { QueuePage } from "../../features/runs";

export function RootPage({ data }: { data: DemoData }) {
  return <QueuePage data={data} />;
}

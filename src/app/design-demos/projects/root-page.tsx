"use client";

import type { DemoData } from "../design-demo-data";
import { QueuePage } from "../runs-page";

export function RootPage({ data }: { data: DemoData }) {
  return <QueuePage data={data} />;
}

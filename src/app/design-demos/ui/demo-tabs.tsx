"use client";

import { SegmentedControl } from "./segmented-control";

export function DemoTabs<T extends string>({
  tabs,
  value,
  onChange,
  panel = false,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  panel?: boolean;
}) {
  return (
    <SegmentedControl
      ariaLabel="切换视图"
      items={tabs.map((tab) => ({ value: tab.key, label: tab.label, count: tab.count }))}
      onChange={onChange}
      panel={panel}
      role="tablist"
      value={value}
    />
  );
}

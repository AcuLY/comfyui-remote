"use client";

import { SegmentedControl } from "./segmented-control";

export function DemoTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <SegmentedControl
      ariaLabel="切换视图"
      items={tabs.map((tab) => ({ value: tab.key, label: tab.label, count: tab.count }))}
      onChange={onChange}
      role="tablist"
      value={value}
    />
  );
}

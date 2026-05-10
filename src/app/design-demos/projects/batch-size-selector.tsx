"use client";

import { cx } from "../design-demo-utils";
import s from "../styles/projects.module.css";
import { SegmentedControl } from "../ui/segmented-control";

export const BATCH_SIZE_OPTIONS = [1, 2, 4, 8, 16];

export function BatchSizeSelector({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <SegmentedControl
      ariaLabel="批量张数"
      className={cx(s.batchSizeSelector, compact && s.batchSizeSelectorCompact)}
      compact
      items={BATCH_SIZE_OPTIONS.map((option) => ({ value: option, label: option }))}
      onChange={onChange}
      value={value}
    />
  );
}

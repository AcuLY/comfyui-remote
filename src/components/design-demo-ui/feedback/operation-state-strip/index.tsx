"use client";

import type { DemoToastTone } from "@/app/design-demos/routing";
import { cx } from "@/app/design-demos/routing";
import s from "./operation-state-strip.module.css";

export function OperationStateStrip({
  items,
}: {
  items: Array<{ label: string; value: string; tone?: DemoToastTone }>;
}) {
  return (
    <div className={s.operationStateStrip}>
      {items.map((item) => (
        <span
          className={cx(
            s.operationStateItem,
            item.tone === "success" && s.operationStateSuccess,
            item.tone === "warning" && s.operationStateWarning,
            item.tone === "error" && s.operationStateError,
          )}
          key={`${item.label}-${item.value}`}
        >
          <strong>{item.label}</strong>
          {item.value}
        </span>
      ))}
    </div>
  );
}

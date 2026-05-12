"use client";

import { cx } from "../../design-demo-utils";
import s from "./metric-card.module.css";
import type { RouteIcon } from "../_shared/types";

export function MetricCard({ icon: Icon, label, value, meta, tone }: { icon: RouteIcon; label: string; value: string | number; meta: string; tone?: string }) {
  return (
    <div className={s.metric}>
      <div className={s.metricLabel}>
        <Icon className={cx(s.iconMd, tone)} />
        {label}
      </div>
      <div className={s.metricValue}>{value}</div>
      <div className={s.metricMeta}>{meta}</div>
    </div>
  );
}

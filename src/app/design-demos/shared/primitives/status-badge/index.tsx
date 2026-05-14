"use client";

import { cx } from "../../../routing";
import s from "./status-badge.module.css";
import { statusLabel } from "../shared/utils";

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (["done", "active", "kept", "healthy", "success", "ready"].includes(value)) return s.statusGreen;
  if (["running", "pending", "queued", "draft"].includes(value)) return s.statusAmber;
  if (["failed", "error", "trashed", "offline"].includes(value)) return s.statusRed;
  if (["review", "monitor", "template", "featured"].includes(value)) return s.statusSky;
  return "";
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={cx(s.status, statusTone(status))}>{label ?? statusLabel(status)}</span>;
}

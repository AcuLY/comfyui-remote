"use client";

import { cx } from "@/components/design-demo-ui/primitives/classnames";
import s from "./status-badge.module.css";
import { statusLabel } from "@/components/design-demo-ui/primitives/shared/utils";

function statusTone(status: string) {
  const value = status.toLowerCase();
  if (["done", "active", "kept", "healthy", "success", "ready"].includes(value)) return s.statusGreen;
  if (["running", "pending", "queued", "draft"].includes(value)) return s.statusAmber;
  if (["failed", "error", "trashed", "offline"].includes(value)) return s.statusRed;
  if (["review", "monitor", "template", "featured"].includes(value)) return s.statusSky;
  return "";
}

export function StatusBadge({ className, status, label }: { className?: string; status: string; label?: string }) {
  return <span className={cx(s.status, statusTone(status), className)}>{label ?? statusLabel(status)}</span>;
}

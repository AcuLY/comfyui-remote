import type * as React from "react";

import type { DemoImage } from "../../design-demo-data";
export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "启用",
    done: "完成",
    draft: "草稿",
    error: "错误",
    failed: "失败",
    healthy: "正常",
    kept: "保留",
    monitor: "监控",
    offline: "离线",
    pending: "待处理",
    queued: "排队中",
    ready: "就绪",
    review: "审核",
    running: "运行中",
    success: "成功",
    template: "模板",
    trashed: "删除",
  };
  return labels[status.toLowerCase()] ?? status;
}

export function controlLabel(children: React.ReactNode, ariaLabel?: string) {
  if (ariaLabel) return ariaLabel;
  if (typeof children === "string" || typeof children === "number") return String(children);
  return "按钮";
}

export function imageTagLabels(image: DemoImage) {
  return [
    image.featured ? "p站" : null,
    image.featured2 ? "预览" : null,
    image.cover ? "封面" : null,
  ].filter((item): item is string => Boolean(item));
}

export function imageReviewLabel(status: DemoImage["status"]) {
  if (status === "pending") return "待审";
  if (status === "kept") return "保留";
  return "删除";
}

export function preventReadonlyEdit(event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
  event.preventDefault();
}

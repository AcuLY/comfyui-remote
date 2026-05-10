import { AlertTriangle, Clock3, ImageIcon } from "lucide-react";

import { MetricCard } from "../ui/metric-card";
import s from "../styles/runs.module.css";

export function QueueMetrics({
  pendingImages,
  reviewGroups,
  runningCount,
  failedCount,
}: {
  pendingImages: number;
  reviewGroups: number;
  runningCount: number;
  failedCount: number;
}) {
  return (
    <div className={s.metricGrid}>
      <MetricCard icon={ImageIcon} label="待审" value={pendingImages} meta={`${reviewGroups} 个结果组`} />
      <MetricCard icon={Clock3} label="队列" value={runningCount} meta="生成队列" />
      <MetricCard icon={AlertTriangle} label="失败" value={failedCount} meta="可重试任务" />
    </div>
  );
}

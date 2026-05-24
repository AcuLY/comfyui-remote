import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Database, FileText, Images, Layers, Play, UserRound } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import type {
  CharacterLoraJob,
  CharacterLoraJobReport,
  CharacterLoraTrainingRun,
} from "../types";

export const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  canonical_pending: "人设图",
  prompt_pending: "提示词",
  section_generating: "训练集生成",
  reviewing: "审核",
  dataset_ready: "数据集",
  training_queued: "训练排队",
  training_running: "训练中",
  trained: "已训练",
  benchmarking: "训练后处理",
  benchmark_review: "训练后处理",
  promotion_ready: "已训练",
  promoted: "已训练",
  failed: "失败",
  cancelled: "已取消",
  archived: "归档",
  queued: "排队",
  running: "运行中",
  done: "完成",
  keep: "保留",
  reject: "排除",
  pending: "待审",
  included_in_training: "入集",
};

const NAV_ITEMS = [
  { href: "", label: "概览", icon: UserRound },
  { href: "persona-reference", label: "人设图", icon: Images },
  { href: "prompt-card", label: "提示词卡", icon: FileText },
  { href: "sections", label: "训练集模块", icon: Layers },
  { href: "dataset", label: "训练集", icon: Database },
  { href: "training", label: "训练", icon: Play },
] as const;

type ReportCanonicalVersion = CharacterLoraJobReport["canonicalVersions"][number];
type ReportSourceImage = CharacterLoraJobReport["sourceImages"][number];
type ReportCandidateImage = CharacterLoraJobReport["candidateImages"][number];

export function JobPageShell({
  job,
  currentPath,
  title,
  description,
  children,
}: {
  job: CharacterLoraJob;
  currentPath: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const basePath = `/character-lora-training/${job.id}`;

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex flex-col gap-3">
        <Link
          href="/character-lora-training"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.06]"
        >
          <ArrowLeft className="size-3.5" />
          返回训练项目
        </Link>
        <PageHeader title={title} description={description} />
      </div>

      <div className="min-w-0 overflow-x-auto">
        <div className="flex min-w-max gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {NAV_ITEMS.map((item) => {
            const href = item.href ? `${basePath}/${item.href}` : basePath;
            const active = currentPath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href || "overview"}
                href={href}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs transition ${
                  active
                    ? "bg-sky-500/15 text-sky-200"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                }`}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-h-24 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-1 min-w-0 break-words text-xs text-zinc-500">{detail}</div> : null}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-white/10 py-2 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-zinc-200">{value}</dd>
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-zinc-300">
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function ArtifactThumb({
  jobId,
  relativePath,
  alt,
}: {
  jobId: string;
  relativePath: string | null | undefined;
  alt: string;
}) {
  if (!relativePath) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-white/10 bg-black/20 text-xs text-zinc-600">
        无预览
      </div>
    );
  }

  const src = buildArtifactImageUrl(jobId, relativePath, { w: 360, q: 72 });

  return (
    <a href={buildArtifactImageUrl(jobId, relativePath)} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- artifact images are served by the existing route. */}
      <img
        src={src}
        alt={alt}
        className="aspect-[4/5] w-full rounded-lg border border-white/10 bg-black/30 object-cover"
      />
    </a>
  );
}

export function ImageStrip({
  jobId,
  images,
  emptyLabel,
}: {
  jobId: string;
  images: Array<ReportSourceImage | ReportCandidateImage | ReportCanonicalVersion>;
  emptyLabel: string;
}) {
  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {images.slice(0, 10).map((image) => {
        const relativePath = getReportImagePath(image);
        const id = image.id;

        return (
          <div key={id} className="min-w-0">
            <ArtifactThumb jobId={jobId} relativePath={relativePath} alt={id} />
          </div>
        );
      })}
    </div>
  );
}

function getReportImagePath(image: { artifact?: { relativePath?: string | null } | null; relativePath?: string | null }) {
  if ("artifact" in image && image.artifact?.relativePath) {
    return image.artifact.relativePath;
  }
  return image.relativePath ?? null;
}

export function latestTrainingRun(runs: CharacterLoraTrainingRun[]) {
  return runs[0] ?? null;
}

export function reportLatestTrainingRun(report: CharacterLoraJobReport) {
  return report.trainingRuns[report.trainingRuns.length - 1] ?? null;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function compactId(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function buildArtifactImageUrl(jobId: string, relativePath: string, options?: { w?: number; q?: number }) {
  const params = new URLSearchParams({ path: relativePath });
  if (options?.w) params.set("w", String(options.w));
  if (options?.q) params.set("q", String(options.q));
  return `/api/character-lora-training/jobs/${encodeURIComponent(jobId)}/artifacts/image?${params.toString()}`;
}

export function SimpleSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle}>
      {children}
    </SectionCard>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import type { DemoRun } from "../design-demo-data";
import type { findSection } from "../design-demo-utils";
import s from "./review-meta-card.runs.module.css";

export function mergeExecutionMeta(run: DemoRun, section: NonNullable<ReturnType<typeof findSection>>) {
  const fallback: Record<string, unknown> = {
    aspectRatio: section.aspectRatio,
    shortSidePx: section.shortSidePx,
    batchSize: section.batchSize,
    checkpointName: section.checkpointName,
    workflowId: run.id,
    lora1: section.lora1 ?? [],
    lora2: section.lora2 ?? [],
    positivePrompt: section.positivePrompt,
    negativePrompt: section.negativePrompt,
  };

  for (const [key, value] of Object.entries(run.executionMeta ?? {})) {
    if (value !== null && value !== undefined && value !== "") fallback[key] = value;
  }

  return fallback;
}

function metaText(meta: Record<string, unknown>, key: string, fallback = "未记录") {
  const value = meta[key];
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function promptTextWithBreakLines(value: string) {
  return value.replace(/\s*BREAK\s*/g, "\n").trim();
}

function loraName(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

function loraEntries(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const raw = entry as Record<string, unknown>;
      const path = typeof raw.path === "string"
        ? raw.path
        : typeof raw.filePath === "string"
          ? raw.filePath
          : typeof raw.fileName === "string"
            ? raw.fileName
            : "";
      if (!path) return null;
      const weight = raw.weight === null || raw.weight === undefined ? "未设权重" : String(raw.weight);
      const enabled = raw.enabled !== false;
      return { id: `${path}-${index}`, name: loraName(path), weight, enabled };
    })
    .filter((entry): entry is { id: string; name: string; weight: string; enabled: boolean } => Boolean(entry));
}

function SamplerMetaBlock({ meta, stage }: { meta: Record<string, unknown>; stage: 1 | 2 }) {
  const prefix = stage === 1 ? "ks1" : "ks2";
  const hasSampler = ["Seed", "Steps", "Cfg", "Sampler", "Denoise"].some((key) => meta[`${prefix}${key}`] !== null && meta[`${prefix}${key}`] !== undefined);

  if (!hasSampler && stage === 2) {
    return (
      <div className={s.reviewSamplerBlock} data-empty="true">
        <em>KSampler2</em>
        <p>跳过（1x 或未记录高清修复参数）</p>
      </div>
    );
  }

  return (
    <div className={s.reviewSamplerBlock}>
      <em>KSampler{stage}</em>
      <dl>
        <div><dt>seed</dt><dd>{metaText(meta, `${prefix}Seed`)}</dd></div>
        <div><dt>steps</dt><dd>{metaText(meta, `${prefix}Steps`)}</dd></div>
        <div><dt>cfg</dt><dd>{metaText(meta, `${prefix}Cfg`)}</dd></div>
        <div><dt>denoise</dt><dd>{metaText(meta, `${prefix}Denoise`)}</dd></div>
        <div data-span="2"><dt>sampler</dt><dd>{metaText(meta, `${prefix}Sampler`)}</dd></div>
      </dl>
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={s.reviewMetaStat}>
      <em>{label}</em>
      <strong>{value}</strong>
    </div>
  );
}

function ReviewExecutionMeta({ meta }: { meta: Record<string, unknown> }) {
  const lora1 = loraEntries(meta.lora1);
  const lora2 = loraEntries(meta.lora2);
  const positivePrompt = metaText(meta, "positivePrompt", "");
  const negativePrompt = metaText(meta, "negativePrompt", "");
  const positivePromptText = positivePrompt ? promptTextWithBreakLines(positivePrompt) : "";
  const negativePromptText = negativePrompt ? promptTextWithBreakLines(negativePrompt) : "";

  return (
    <div className={s.reviewMetaBody}>
      <div className={s.reviewSamplerGrid}>
        <SamplerMetaBlock meta={meta} stage={1} />
        <SamplerMetaBlock meta={meta} stage={2} />
      </div>

      <div className={s.reviewMetaLine}>
        <MetaStat label="Checkpoint" value={metaText(meta, "checkpointName")} />
        <MetaStat label="Workflow" value={metaText(meta, "workflowId")} />
      </div>

      <div className={s.reviewLoraGrid}>
        {[["LoRA1", lora1] as const, ["LoRA2", lora2] as const].map(([label, entries]) => (
          <div key={label} className={s.reviewLoraColumn}>
            <em>{label}<span>{entries.length}</span></em>
            {entries.length > 0 ? (
              <ul>
                {entries.map((entry) => (
                  <li key={entry.id} data-disabled={!entry.enabled}>
                    <span title={entry.name}>{entry.name}</span>
                    <strong>{entry.weight}</strong>
                  </li>
                ))}
              </ul>
            ) : <p>未记录</p>}
          </div>
        ))}
      </div>

      <div className={s.reviewPromptGrid}>
        <div>
          <em>Prompt<span>{positivePrompt ? `${positivePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{positivePromptText || "未记录"}</pre>
        </div>
        <div>
          <em>Negative<span>{negativePrompt ? `${negativePrompt.length.toLocaleString()} chars` : "空"}</span></em>
          <pre>{negativePromptText || "未记录"}</pre>
        </div>
      </div>
    </div>
  );
}

export function ReviewMetaCard({
  section,
  run,
  meta,
}: {
  section: { name: string };
  run: DemoRun;
  meta: Record<string, unknown> | null;
}) {
  const [open, setOpen] = useState(false);
  const summary = meta
    ? [
        metaText(meta, "aspectRatio") || null,
        metaText(meta, "shortSidePx") ? `${metaText(meta, "shortSidePx")}px` : null,
        metaText(meta, "batchSize") ? `${metaText(meta, "batchSize")} 张` : null,
        metaText(meta, "upscaleFactor") ? `${metaText(meta, "upscaleFactor")}x` : null,
      ].filter(Boolean) as string[]
    : [];

  return (
    <section className={s.reviewMetaSurface} data-open={open ? "true" : "false"}>
      <button
        type="button"
        className={s.reviewMetaHeader}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div>
          <em>RUN-{run.runIndex.toString().padStart(2, "0")}</em>
          <strong>参数信息</strong>
          <span>{section.name} · {run.createdAt}</span>
        </div>
        {summary.length > 0 ? (
          <ul className={s.reviewMetaSummary} aria-hidden={open}>
            {summary.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        ) : null}
        <ChevronDown className={s.reviewMetaChevron} aria-hidden="true" />
      </button>
      {meta ? <ReviewExecutionMeta meta={meta} /> : null}
    </section>
  );
}

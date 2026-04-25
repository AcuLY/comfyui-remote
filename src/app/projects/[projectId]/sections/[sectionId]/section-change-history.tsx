"use client";

import { useMemo, useState } from "react";
import type { SectionChangeDimension } from "@/server/services/section-change-history-service";

type SectionChangeHistoryEntry = {
  id: string;
  dimension: SectionChangeDimension;
  title: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

type SectionChangeHistoryProps = {
  history: Record<SectionChangeDimension, SectionChangeHistoryEntry[]>;
};

const TABS: Array<{ key: SectionChangeDimension; label: string }> = [
  { key: "runParams", label: "运行参数" },
  { key: "prompt", label: "提示词" },
  { key: "lora", label: "LoRA" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringifyCompact(value: unknown) {
  if (value === null || value === undefined) return "空";
  if (typeof value === "string") return value || "空";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function getLoraCount(value: unknown) {
  const record = asRecord(value);
  if (!record) return "0 / 0";
  const lora1 = Array.isArray(record.lora1) ? record.lora1.length : 0;
  const lora2 = Array.isArray(record.lora2) ? record.lora2.length : 0;
  return `${lora1} / ${lora2}`;
}

function Summary({ entry }: { entry: SectionChangeHistoryEntry }) {
  if (entry.dimension === "lora") {
    return (
      <div className="text-[11px] text-zinc-500">
        LoRA1 / LoRA2：{getLoraCount(entry.before)} → {getLoraCount(entry.after)}
      </div>
    );
  }

  if (entry.dimension === "prompt") {
    const before = asRecord(entry.before);
    const after = asRecord(entry.after);
    const beforeText = stringifyCompact(before?.positive ?? before?.negative ?? before?.label ?? null);
    const afterText = stringifyCompact(after?.positive ?? after?.negative ?? after?.label ?? null);
    return (
      <div className="truncate text-[11px] text-zinc-500">
        {beforeText.slice(0, 80)} → {afterText.slice(0, 80)}
      </div>
    );
  }

  const after = asRecord(entry.after);
  const params = after
    ? Object.entries(after)
        .map(([key, value]) => `${key}: ${stringifyCompact(value)}`)
        .join("；")
    : "";
  return <div className="truncate text-[11px] text-zinc-500">{params || "运行参数已更新"}</div>;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10px] font-medium text-zinc-500">{label}</div>
      <pre className="max-h-52 overflow-auto rounded-lg border border-white/5 bg-black/20 p-2 text-[10px] leading-4 text-zinc-400">
        {stringifyCompact(value)}
      </pre>
    </div>
  );
}

export function SectionChangeHistory({ history }: SectionChangeHistoryProps) {
  const [activeTab, setActiveTab] = useState<SectionChangeDimension>("runParams");
  const entries = history[activeTab] ?? [];
  const totalCount = useMemo(
    () => TABS.reduce((sum, tab) => sum + (history[tab.key]?.length ?? 0), 0),
    [history],
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-zinc-200">变更记录</div>
          <div className="text-[11px] text-zinc-500">按维度保留最近 10 条，当前共 {totalCount} 条。</div>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/20 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                activeTab === tab.key
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] text-zinc-500">{history[tab.key]?.length ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-zinc-600">
          暂无{TABS.find((tab) => tab.key === activeTab)?.label}变更记录
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <details key={entry.id} className="group rounded-xl border border-white/5 bg-black/10 p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-zinc-300">{entry.title}</div>
                    <Summary entry={entry} />
                  </div>
                  <div className="shrink-0 text-[10px] text-zinc-600">{formatDate(entry.createdAt)}</div>
                </div>
              </summary>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <JsonBlock label="变更前" value={entry.before} />
                <JsonBlock label="变更后" value={entry.after} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

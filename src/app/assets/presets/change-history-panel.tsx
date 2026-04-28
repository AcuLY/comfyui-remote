"use client";

import { useState } from "react";
import type {
  PresetHistoryEntry,
} from "@/server/services/preset-change-history-service";
import type { ChangeHistoryTabs } from "./preset-types";

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function stringifyHistoryValue(value: unknown) {
  if (value === null || value === undefined) return "空";
  if (typeof value === "string") return value || "空";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function historySummary(entry: PresetHistoryEntry<string>) {
  if (entry.dimension === "variants") {
    const after = entry.after && typeof entry.after === "object" ? entry.after as Record<string, unknown> : null;
    return after?.name ? `变体：${String(after.name)}` : "关联变体已更新";
  }
  if (entry.dimension === "content") {
    const after = entry.after && typeof entry.after === "object" ? entry.after as Record<string, unknown> : null;
    return after?.name ? `变体：${String(after.name)}` : "提示词与 LoRA 已更新";
  }
  if (entry.dimension === "members") {
    const beforeCount = Array.isArray(entry.before) ? entry.before.length : 0;
    const afterCount = Array.isArray(entry.after) ? entry.after.length : 0;
    return `${beforeCount} 个成员 → ${afterCount} 个成员`;
  }
  const after = entry.after && typeof entry.after === "object" ? entry.after as Record<string, unknown> : null;
  return after?.name ? `名称：${String(after.name)}` : "基础信息已更新";
}

export function PresetChangeHistoryPanel<Dimension extends string>({
  history,
  tabs,
}: {
  history: Record<Dimension, PresetHistoryEntry<Dimension>[]>;
  tabs: ChangeHistoryTabs<Dimension>;
}) {
  const [activeTab, setActiveTab] = useState<Dimension>(tabs[0].key);
  const entries = history[activeTab] ?? [];
  const totalCount = tabs.reduce((sum, tab) => sum + (history[tab.key]?.length ?? 0), 0);

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-zinc-200">变更记录</div>
          <div className="text-[10px] text-zinc-500">按维度保留最近 10 条，当前共 {totalCount} 条</div>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded px-2 py-1 text-[10px] transition ${
                activeTab === tab.key ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] text-zinc-500">{history[tab.key]?.length ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 py-5 text-center text-[11px] text-zinc-600">
          暂无{tabs.find((tab) => tab.key === activeTab)?.label}变更记录
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <details key={entry.id} className="group rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <summary className="cursor-pointer list-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-zinc-300">{entry.title}</div>
                    <div className="truncate text-[10px] text-zinc-500">{historySummary(entry)}</div>
                  </div>
                  <div className="shrink-0 text-[10px] text-zinc-600">{formatHistoryDate(entry.createdAt)}</div>
                </div>
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] font-medium text-zinc-500">变更前</div>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-white/5 bg-black/20 p-2 text-[10px] leading-4 text-zinc-400">
                    {stringifyHistoryValue(entry.before)}
                  </pre>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 text-[10px] font-medium text-zinc-500">变更后</div>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-white/5 bg-black/20 p-2 text-[10px] leading-4 text-zinc-400">
                    {stringifyHistoryValue(entry.after)}
                  </pre>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

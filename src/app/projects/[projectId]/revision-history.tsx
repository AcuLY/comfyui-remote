"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Bot, User, Server } from "lucide-react";
import type { ProjectRevisionSummary } from "@/lib/server-data";

type RevisionSnapshot = {
  title?: string;
  // Legacy fields (may exist in old snapshots)
  characterPrompt?: string;
  scenePrompt?: string | null;
  stylePrompt?: string | null;
  characterLoraPath?: string;
  sections?: Array<{
    id: string;
    positivePrompt?: string | null;
    negativePrompt?: string | null;
    aspectRatio?: string | null;
    batchSize?: number | null;
    seedPolicy1?: string | null;
    seedPolicy2?: string | null;
    ksampler1?: Record<string, unknown> | null;
    ksampler2?: Record<string, unknown> | null;
  }>;
};

type RevisionDetail = {
  id: string;
  revisionNumber: number;
  actorType: string;
  createdAt: string;
  snapshot: RevisionSnapshot;
};

const actorIcons = {
  user: User,
  agent: Bot,
  system: Server,
} as const;

const actorLabels = {
  user: "用户",
  agent: "AI Agent",
  system: "系统",
} as const;

function ActorBadge({ actorType }: { actorType: string }) {
  const Icon = actorIcons[actorType as keyof typeof actorIcons] ?? User;
  const label = actorLabels[actorType as keyof typeof actorLabels] ?? actorType;

  const colorClass =
    actorType === "agent"
      ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
      : actorType === "system"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : "border-sky-500/20 bg-sky-500/10 text-sky-300";

  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function SnapshotField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <div className="rounded-xl bg-white/[0.03] p-2.5">
      <div className="text-[10px] text-zinc-500">{label}</div>
      <div className="mt-0.5 text-xs text-zinc-300 break-words">{value}</div>
    </div>
  );
}

function RevisionItem({ revision, projectId }: { revision: ProjectRevisionSummary; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<RevisionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggleExpand() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (detail) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/revisions/${revision.revisionNumber}`,
      );
      if (response.ok) {
        const json = await response.json();
        setDetail(json.data ?? json);
      }
    } catch {
      // Non-critical — just won't show detail
    } finally {
      setLoading(false);
    }
  }

  const Chevron = expanded ? ChevronDown : ChevronRight;
  const snapshot = detail?.snapshot;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={toggleExpand}
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-white/[0.03]"
      >
        <Chevron className="size-3.5 shrink-0 text-zinc-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200">
              #{revision.revisionNumber}
            </span>
            <ActorBadge actorType={revision.actorType} />
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-500">{revision.createdAt}</div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-3">
          {loading && (
            <div className="text-xs text-zinc-500">加载快照中...</div>
          )}
          {!loading && snapshot && (
            <div className="space-y-2">
              {/* Legacy fields from old snapshots - show conditionally */}
              {snapshot.characterPrompt && <SnapshotField label="Character prompt (legacy)" value={snapshot.characterPrompt} />}
              {snapshot.scenePrompt && <SnapshotField label="Scene prompt (legacy)" value={snapshot.scenePrompt} />}
              {snapshot.stylePrompt && <SnapshotField label="Style prompt (legacy)" value={snapshot.stylePrompt} />}
              {snapshot.characterLoraPath && <SnapshotField label="LoRA path (legacy)" value={snapshot.characterLoraPath} />}
              {snapshot.sections && snapshot.sections.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium text-zinc-500">Positions</div>
                  {snapshot.sections.map((pos, i) => (
                    <div key={pos.id ?? i} className="rounded-xl bg-white/[0.02] p-2 text-[11px] text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-300">#{i + 1}</span>
                        {pos.aspectRatio && <span>{pos.aspectRatio}</span>}
                        {pos.batchSize && <span>batch {pos.batchSize}</span>}
                        {pos.seedPolicy1 && <span>seed1: {pos.seedPolicy1}</span>}
                        {pos.seedPolicy2 && <span>seed2: {pos.seedPolicy2}</span>}
                      </div>
                      {pos.positivePrompt && (
                        <div className="mt-1 text-zinc-400 break-words">
                          <span className="text-zinc-500">+</span> {pos.positivePrompt}
                        </div>
                      )}
                      {pos.negativePrompt && (
                        <div className="mt-0.5 text-zinc-500 break-words">
                          <span className="text-zinc-600">−</span> {pos.negativePrompt}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!loading && !snapshot && !detail && (
            <div className="text-xs text-zinc-500">无法加载快照详情。</div>
          )}
        </div>
      )}
    </div>
  );
}

export function RevisionHistory({
  revisions,
  projectId,
}: {
  revisions: ProjectRevisionSummary[];
  projectId: string;
}) {
  if (revisions.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        编辑参数后，修订历史会自动出现在这里。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {revisions.map((revision) => (
        <RevisionItem key={revision.id} revision={revision} projectId={projectId} />
      ))}
    </div>
  );
}

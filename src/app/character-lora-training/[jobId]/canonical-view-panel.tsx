"use client";

import { Check, RefreshCw, X } from "lucide-react";

import { ArtifactThumbCompact } from "./shared-ui";

type CanonicalVersion = {
  id: string;
  version: number;
  status: string;
  canonicalView?: string | null;
  artifact?: { id: string; relativePath: string | null; sha256: string | null } | null;
};

type ViewSpec = {
  key: string;
  label: string;
  promptPhrase: string;
};

type CanonicalViewPanelProps = {
  viewSpec: ViewSpec;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidates: any[];
  jobId: string;
  currentCanonicalVersionId: string | null;
  selectAction: (versionId: string) => Promise<void>;
  rejectAction: (versionId: string) => Promise<void>;
  onAddToRerun?: (candidate: { id: string; label: string; relativePath: string; artifactId: string; sha256: string; canonicalView: string | null }) => void;
};

export function CanonicalViewPanel({
  viewSpec,
  candidates,
  jobId,
  currentCanonicalVersionId,
  selectAction,
  rejectAction,
  onAddToRerun,
}: CanonicalViewPanelProps) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-100">{viewSpec.label}</h3>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-400">
          {candidates.length}
        </span>
      </div>

      {/* Candidate horizontal strip */}
      {candidates.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-white/[0.08] text-[11px] text-zinc-600">
          暂无候选
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {candidates.map((version) => {
            const isCurrent = version.id === currentCanonicalVersionId;
            const isRejected = version.status === "rejected";
            const hasArtifact = !!(version.artifact?.id && version.artifact?.relativePath && version.artifact?.sha256);
            return (
              <div
                key={version.id}
                className={`group relative flex-none ${isRejected ? "opacity-50" : ""}`}
                style={{ width: "clamp(72px, 18vw, 100px)" }}
              >
                <div
                  className={`overflow-hidden rounded-md ${isCurrent ? "ring-2 ring-sky-400/70" : ""}`}
                >
                  <ArtifactThumbCompact
                    jobId={jobId}
                    relativePath={version.artifact?.relativePath}
                    alt={`v${version.version}`}
                  />
                </div>
                {/* Version + status */}
                <div className="mt-1 flex items-center justify-between gap-0.5">
                  <span className="text-[10px] tabular-nums text-zinc-400">v{version.version}</span>
                  {isCurrent && (
                    <span className="rounded bg-sky-500/20 px-1 py-px text-[9px] text-sky-300">当前</span>
                  )}
                </div>
                {/* Action buttons */}
                {!isRejected && (
                  <div className="mt-1 flex gap-1">
                    <form action={() => selectAction(version.id)} className="flex-1">
                      <button
                        type="submit"
                        disabled={isCurrent}
                        title="选用"
                        className="flex h-5 w-full items-center justify-center rounded bg-sky-500/20 text-sky-300 transition hover:bg-sky-500/30 disabled:opacity-30"
                      >
                        <Check className="size-3" />
                      </button>
                    </form>
                    <form action={() => rejectAction(version.id)} className="flex-1">
                      <button
                        type="submit"
                        disabled={isCurrent}
                        title="拒绝"
                        className="flex h-5 w-full items-center justify-center rounded bg-rose-500/20 text-rose-300 transition hover:bg-rose-500/30 disabled:opacity-30"
                      >
                        <X className="size-3" />
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={!hasArtifact}
                      onClick={() => {
                        if (hasArtifact && onAddToRerun) {
                          onAddToRerun({
                            id: version.id,
                            label: `v${version.version}`,
                            relativePath: version.artifact!.relativePath!,
                            artifactId: version.artifact!.id,
                            sha256: version.artifact!.sha256!,
                            canonicalView: version.canonicalView ?? null,
                          });
                        }
                      }}
                      title="加入生图面板"
                      className="flex h-5 flex-1 items-center justify-center rounded bg-white/[0.06] text-zinc-400 transition hover:bg-violet-500/20 hover:text-violet-300 disabled:opacity-30"
                    >
                      <RefreshCw className="size-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

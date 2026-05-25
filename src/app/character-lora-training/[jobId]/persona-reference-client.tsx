"use client";

import { useCallback, useState } from "react";

import { CANONICAL_VIEW_SPECS } from "@/lib/character-lora-canonical-views";
import { CanonicalViewPanel } from "./canonical-view-panel";
import { GenerationPanel, type RerunBaseImage } from "./rerun-panel";
import type { WorkflowActionResult } from "./workflow-actions";

type PersonaReferenceClientProps = {
  candidatesByView: Record<string, Array<{
    id: string;
    version: number;
    status: string;
    canonicalView?: string | null;
    artifact?: { id: string; relativePath: string | null; sha256: string | null } | null;
  }>>;
  sourceImages: Array<{ id: string; relativePath: string | null }>;
  allNonRejectedVersions: Array<{ id: string; version: number; canonicalView?: string | null }>;
  jobId: string;
  currentCanonicalVersionId: string | null;
  enqueueAction: (formData: FormData) => Promise<WorkflowActionResult>;
  selectAction: (versionId: string) => Promise<void>;
  rejectAction: (versionId: string) => Promise<void>;
  rerunAction: (formData: FormData) => Promise<WorkflowActionResult>;
  disabled: boolean;
};

export function PersonaReferenceClient({
  candidatesByView,
  sourceImages,
  allNonRejectedVersions,
  jobId,
  currentCanonicalVersionId,
  enqueueAction,
  selectAction,
  rejectAction,
  rerunAction,
  disabled,
}: PersonaReferenceClientProps) {
  const [rerunBaseImages, setRerunBaseImages] = useState<RerunBaseImage[]>([]);

  const handleAddToRerun = useCallback((candidate: RerunBaseImage) => {
    setRerunBaseImages((prev) => {
      if (prev.some((img) => img.id === candidate.id)) return prev;
      return [...prev, candidate];
    });
  }, []);

  const handleRemoveFromRerun = useCallback((id: string) => {
    setRerunBaseImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleClearRerun = useCallback(() => {
    setRerunBaseImages([]);
  }, []);

  return (
    <div className="space-y-3">
      {/* Unified generation panel (always visible) */}
      <GenerationPanel
        baseImages={rerunBaseImages}
        onRemoveImage={handleRemoveFromRerun}
        onClear={handleClearRerun}
        jobId={jobId}
        sourceImages={sourceImages}
        allNonRejectedVersions={allNonRejectedVersions}
        enqueueAction={enqueueAction}
        rerunAction={rerunAction}
        disabled={disabled}
      />

      {/* View panels grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CANONICAL_VIEW_SPECS.map((view) => (
          <CanonicalViewPanel
            key={view.key}
            viewSpec={view}
            candidates={candidatesByView[view.key]}
            jobId={jobId}
            currentCanonicalVersionId={currentCanonicalVersionId}
            selectAction={selectAction}
            rejectAction={rejectAction}
            onAddToRerun={handleAddToRerun}
          />
        ))}
      </div>
    </div>
  );
}

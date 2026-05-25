"use client";

import { useCallback, useEffect } from "react";

import { CANONICAL_VIEW_SPECS } from "@/lib/character-lora-canonical-views";
import { useTaskPanel } from "@/components/task-panel";
import { CanonicalViewPanel } from "./canonical-view-panel";
import type { GenerationBaseImage } from "@/components/task-panel";

type PersonaReferenceClientProps = {
  candidatesByView: Record<string, Array<{
    id: string;
    version: number;
    status: string;
    canonicalView?: string | null;
    artifact?: { id: string; relativePath: string | null; sha256: string | null } | null;
  }>>;
  sourceImages: Array<{ id: string; relativePath: string | null }>;
  jobId: string;
  currentCanonicalVersionId: string | null;
  selectAction: (versionId: string) => Promise<void>;
  rejectAction: (versionId: string) => Promise<void>;
};

export function PersonaReferenceClient({
  candidatesByView,
  sourceImages,
  jobId,
  currentCanonicalVersionId,
  selectAction,
  rejectAction,
}: PersonaReferenceClientProps) {
  const { pushBaseImage, setFormConfig, setOpen } = useTaskPanel();

  // Configure panel on mount
  useEffect(() => {
    setFormConfig({
      type: "canonical",
      jobId,
      sourceImages,
      disabled: sourceImages.length === 0,
      disabledReason: "需要至少一张原始参考图才能初次生图",
    });
    return () => setFormConfig(null);
  }, [setFormConfig, jobId, sourceImages]);

  const handleAddToRerun = useCallback((candidate: GenerationBaseImage) => {
    pushBaseImage(candidate);
    setOpen(true);
  }, [pushBaseImage, setOpen]);

  return (
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
  );
}

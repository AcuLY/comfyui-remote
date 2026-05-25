"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";

import { ArtifactThumbCompact } from "../../shared-ui";
import { GenerationPanel, type GenerationBaseImage } from "../../rerun-panel";
import type { WorkflowActionResult } from "../../workflow-actions";

type CandidateImage = {
  id: string;
  relativePath: string | null;
  generationRunId: string;
  reviewStatus: string;
};

type SectionGenerationClientProps = {
  candidateImages: CandidateImage[];
  jobId: string;
  enqueueAction: (formData: FormData) => Promise<WorkflowActionResult>;
  rerunAction: (formData: FormData) => Promise<WorkflowActionResult>;
  disabled: boolean;
  disabledReason?: string;
};

export function SectionGenerationClient({
  candidateImages,
  jobId,
  enqueueAction,
  rerunAction,
  disabled,
  disabledReason,
}: SectionGenerationClientProps) {
  const [baseImages, setBaseImages] = useState<GenerationBaseImage[]>([]);

  const handleAddToPanel = useCallback((image: CandidateImage) => {
    setBaseImages((prev) => {
      if (prev.some((img) => img.id === image.id)) return prev;
      return [...prev, {
        id: image.id,
        label: image.id.slice(0, 6),
        relativePath: image.relativePath ?? "",
        generationRunId: image.generationRunId,
      }];
    });
  }, []);

  const handleRemove = useCallback((id: string) => {
    setBaseImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    setBaseImages([]);
  }, []);

  return (
    <div className="space-y-3">
      <GenerationPanel
        variant="section"
        baseImages={baseImages}
        onRemoveImage={handleRemove}
        onClear={handleClear}
        jobId={jobId}
        enqueueAction={enqueueAction}
        rerunAction={rerunAction}
        disabled={disabled}
        disabledReason={disabledReason}
      />

      {/* Candidate images with "add to panel" button */}
      {candidateImages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {candidateImages.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => handleAddToPanel(image)}
              title="加入生图面板"
              className="group relative flex-none rounded-md border border-white/10 transition hover:border-violet-400/40"
              style={{ width: "56px" }}
            >
              <ArtifactThumbCompact jobId={jobId} relativePath={image.relativePath} alt={image.id.slice(0, 6)} />
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 opacity-0 transition group-hover:opacity-100">
                <RefreshCw className="size-3.5 text-violet-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

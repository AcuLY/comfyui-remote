"use client";

import { useState } from "react";

import type { PromptCardDraftFields } from "@/lib/character-lora-prompt-card-draft";
import type { PromptCardDraftResult } from "../workflow-actions";
import { PromptCardDrafts } from "./prompt-card-drafts";
import { PromptCardEditor } from "./prompt-card-editor";

type PromptCardDraftClientProps = {
  drafts: PromptCardDraftResult[];
  triggerToken: string;
  defaultCanonicalVersionId: string;
  initialDraft: {
    characterDescription: string;
    identityTraits: string;
    outfitTraits: string;
    negativeTraits: string;
    finalPromptDraft: string;
  };
  jobId: string;
};

export function PromptCardDraftClient({
  drafts,
  triggerToken,
  defaultCanonicalVersionId,
  initialDraft,
  jobId,
}: PromptCardDraftClientProps) {
  const [editorKey, setEditorKey] = useState(0);
  const [currentDraft, setCurrentDraft] = useState(initialDraft);

  function handleApply(draft: PromptCardDraftFields) {
    setCurrentDraft(draft);
    setEditorKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <PromptCardDrafts drafts={drafts} onApply={handleApply} />
      <PromptCardEditor
        key={editorKey}
        jobId={jobId}
        triggerToken={triggerToken}
        defaultCanonicalVersionId={defaultCanonicalVersionId}
        initialDraft={currentDraft}
      />
    </div>
  );
}

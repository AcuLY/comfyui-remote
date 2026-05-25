"use client";

import { useEffect } from "react";
import { useTaskPanel } from "@/components/task-panel";

type PromptCardPanelConfigProps = {
  jobId: string;
  sourceImages: Array<{ id: string; relativePath: string | null }>;
};

export function PromptCardPanelConfig({ jobId, sourceImages }: PromptCardPanelConfigProps) {
  const { setFormConfig } = useTaskPanel();

  useEffect(() => {
    setFormConfig({
      type: "promptCard",
      jobId,
      sourceImages,
    });
    return () => setFormConfig(null);
  }, [setFormConfig, jobId, sourceImages]);

  return null;
}

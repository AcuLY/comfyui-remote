"use client";

import { useEffect } from "react";
import { useTaskPanel } from "@/components/task-panel";

export function SectionPanelConfig({
  jobId,
  sectionId,
  disabled,
  disabledReason,
}: {
  jobId: string;
  sectionId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const { setFormConfig } = useTaskPanel();

  useEffect(() => {
    setFormConfig({ type: "section", jobId, sectionId, disabled, disabledReason });
    return () => setFormConfig(null);
  }, [setFormConfig, jobId, sectionId, disabled, disabledReason]);

  return null;
}

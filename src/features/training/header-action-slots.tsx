"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/design-demo-ui/primitives/button";
import type { HeaderActionSlot } from "@/components/design-demo-shell/header-surface";
import { matchRoute } from "./routes";

export const TRAINING_PROJECT_SECTION_ADD_EVENT = "training:project-sections:add";

function dispatchTrainingProjectSectionAdd() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TRAINING_PROJECT_SECTION_ADD_EVENT));
}

function TrainingProjectSectionAddAction() {
  return (
    <Button icon={Plus} tone="primary" onClick={dispatchTrainingProjectSectionAdd}>
      新建小节
    </Button>
  );
}

export function getTrainingHeaderActionSlots(route: string): HeaderActionSlot[] | undefined {
  const match = matchRoute(route);
  if (match.key !== "training-project-sections") return undefined;

  return [
    {
      key: "training-project-section-add",
      label: "新建小节",
      node: <TrainingProjectSectionAddAction />,
      overflowNode: <TrainingProjectSectionAddAction />,
    },
  ];
}

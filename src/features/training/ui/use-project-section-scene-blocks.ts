"use client";

import { useState } from "react";

import type { LoraTrainingSectionBlock } from "@/features/training/types";

import { buildProjectSectionStateKey } from "./project-page-utils";

export function useProjectSectionSceneBlocks(
  projectId: string | null,
  sectionId: string | null,
  initialBlocks: LoraTrainingSectionBlock[],
) {
  const projectSectionStateKey = projectId && sectionId ? buildProjectSectionStateKey(projectId, sectionId) : null;
  const [sectionSceneBlocksByKey, setSectionSceneBlocksByKey] = useState<Record<string, LoraTrainingSectionBlock[]>>(() => (
    projectSectionStateKey ? { [projectSectionStateKey]: initialBlocks } : {}
  ));
  const [editingSceneBlockState, setEditingSceneBlockState] = useState(() => ({
    blockId: null as string | null,
    projectId,
    sectionId,
  }));
  const sceneBlocks = projectSectionStateKey ? sectionSceneBlocksByKey[projectSectionStateKey] ?? initialBlocks : initialBlocks;
  const visibleEditingSceneBlockId = editingSceneBlockState.projectId === projectId && editingSceneBlockState.sectionId === sectionId ? editingSceneBlockState.blockId : null;
  const scenePreview = sceneBlocks.map((block) => block.text).join("\n\n");

  function setEditingSceneBlockId(blockId: string | null) {
    setEditingSceneBlockState({
      blockId,
      projectId,
      sectionId,
    });
  }

  function updateSceneBlocks(updater: (current: LoraTrainingSectionBlock[]) => LoraTrainingSectionBlock[]) {
    if (!projectSectionStateKey) return;
    setSectionSceneBlocksByKey((current) => ({
      ...current,
      [projectSectionStateKey]: updater(current[projectSectionStateKey] ?? initialBlocks),
    }));
  }

  function replaceSceneBlocks(blocks: LoraTrainingSectionBlock[]) {
    if (!projectSectionStateKey) return;
    setSectionSceneBlocksByKey((current) => ({
      ...current,
      [projectSectionStateKey]: blocks,
    }));
  }

  return {
    replaceSceneBlocks,
    sceneBlocks,
    scenePreview,
    setEditingSceneBlockId,
    updateSceneBlocks,
    visibleEditingSceneBlockId,
  };
}

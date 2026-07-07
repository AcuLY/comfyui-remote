import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type {
  LoraTrainingProject,
  LoraTrainingSection,
  LoraTrainingSectionBlock,
  LoraTrainingTemplate,
} from "@/features/training/types";

export type LoraTrainingTemplateSeedSection = LoraTrainingTemplate["sections"][number];

export type ProjectSectionDraftState = {
  blockCount: number;
  firstBlock: string;
  imagePrompt: string;
  projectTitle: string;
  projectId: string;
  scenePreview: string;
  sectionId: string;
  sectionTitle: string;
};

export type NewProjectTemplateHints = {
  sections: string;
  templateId: string;
  templateTitle: string;
};

export function findProject(data: TrainingAppData, projectId?: string) {
  if (!projectId) return undefined;
  const training = buildLoraTrainingData(data);
  return training.projects.find((project) => project.id === projectId);
}

export function findSection(project: LoraTrainingProject | undefined, sectionId?: string) {
  if (!project || !sectionId) return undefined;
  return project.sections.find((section) => section.id === sectionId);
}

export function buildProjectSectionStateKey(projectId: string, sectionId: string) {
  return `${projectId}:${sectionId}`;
}

export function moveSceneBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

export function nextSceneBlockOrdinal(blocks: LoraTrainingSectionBlock[], prefix: string) {
  const ordinals = blocks
    .map((block) => (block.id.startsWith(prefix) ? Number(block.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function buildSeedSectionCopy(section: LoraTrainingTemplateSeedSection, copyNumber: number): LoraTrainingTemplateSeedSection {
  return {
    ...section,
    id: `${section.id}-copy-${copyNumber}`,
    title: `${section.title} 副本 ${copyNumber}`,
  };
}

export function nextSeedSectionCopyNumber(sections: LoraTrainingTemplateSeedSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextProjectSectionCopyNumber(sections: LoraTrainingSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextProjectSectionDraftNumber(sections: LoraTrainingSection[]) {
  const draftPrefix = "new-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function readNewProjectTemplateHints(search: string): NewProjectTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    sections: searchParams.get("sections") ?? "",
    templateId: searchParams.get("templateId") ?? "",
    templateTitle: searchParams.get("template") ?? "",
  };
}

export function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

export function buildTrainingProjectTriggerToken(title: string) {
  const normalized = title.trim().replace(/\s+/g, "_");
  return normalized || "training_project";
}

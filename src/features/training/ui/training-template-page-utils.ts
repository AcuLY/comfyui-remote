import type { LoraTrainingProject, LoraTrainingSectionBlock, LoraTrainingTemplate } from "@/features/training/types";
import type { LoraTrainingTemplateSection } from "./training-template-section-row";

export function buildTemplateSectionStateKey(templateId: string, sectionId: string) {
  return `${templateId}:${sectionId}`;
}

export function moveTemplateBlock(blocks: LoraTrainingSectionBlock[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) return blocks;
  const nextBlocks = [...blocks];
  [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
  return nextBlocks;
}

export function nextTemplateSceneBlockOrdinal(blocks: LoraTrainingSectionBlock[], prefix: string) {
  const ordinals = blocks
    .map((block) => (block.id.startsWith(prefix) ? Number(block.id.slice(prefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextTemplateSectionCopyNumber(sections: LoraTrainingTemplateSection[], sourceId: string) {
  const copyPrefix = `${sourceId}-copy-`;
  const ordinals = sections
    .map((section) => {
      if (section.id === sourceId) return 0;
      return section.id.startsWith(copyPrefix) ? Number(section.id.slice(copyPrefix.length)) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function nextTemplateSectionDraftNumber(sections: LoraTrainingTemplateSection[]) {
  const draftPrefix = "new-template-section-";
  const ordinals = sections
    .map((section) => (section.id.startsWith(draftPrefix) ? Number(section.id.slice(draftPrefix.length)) : Number.NaN))
    .filter((value) => Number.isFinite(value));
  return ordinals.length ? Math.max(...ordinals) + 1 : 1;
}

export function orderTemplateSectionsByIds(sections: LoraTrainingTemplateSection[], orderedIds: string[]) {
  const sectionMap = Object.fromEntries(sections.map((section) => [section.id, section]));
  const orderedSections = orderedIds.map((id) => sectionMap[id]).filter((section): section is LoraTrainingTemplateSection => Boolean(section));
  const missingSections = sections.filter((section) => !orderedIds.includes(section.id));
  return [...orderedSections, ...missingSections];
}

export function orderTrainingTemplatesByIds(templates: LoraTrainingTemplate[], orderedIds: string[]) {
  const templateMap = Object.fromEntries(templates.map((template) => [template.id, template]));
  const orderedTemplates = orderedIds.map((id) => templateMap[id]).filter((template): template is LoraTrainingTemplate => Boolean(template));
  const missingTemplates = templates.filter((template) => !orderedIds.includes(template.id));
  return [...orderedTemplates, ...missingTemplates];
}

export function buildTemplateSectionsFromProject(project: LoraTrainingProject): LoraTrainingTemplateSection[] {
  return project.sections.map((section) => ({
    id: `project-${project.id}-${section.id}`,
    title: section.title,
    enabled: section.enabled,
    blockCount: section.blocks.length,
    blocks: section.blocks.map((block) => ({
      ...block,
      id: `project-${project.id}-${section.id}-${block.id}`,
    })),
    resolvedScene: section.resolvedScene,
    scenePreview: section.resolvedScene || section.title,
  }));
}

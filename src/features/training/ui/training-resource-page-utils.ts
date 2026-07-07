import { buildLoraTrainingData } from "@/features/training/build";
import type { TrainingAppData } from "@/features/training/data";
import type { LoraTrainingPreset, LoraTrainingTemplate } from "@/features/training/types";

export function findPreset(data: TrainingAppData, presetId?: string) {
  if (!presetId) return undefined;
  const training = buildLoraTrainingData(data);
  return training.presets.find((preset) => preset.id === presetId);
}

export function findTemplate(data: TrainingAppData, templateId?: string) {
  if (!templateId) return undefined;
  const training = buildLoraTrainingData(data);
  return training.templates.find((template) => template.id === templateId);
}

export function uniquePresetCategories(presets: LoraTrainingPreset[]) {
  return Array.from(new Set(presets.reduce<string[]>((items, preset) => [...items, preset.category], [])));
}

export function uniquePresetFolders(presets: LoraTrainingPreset[]) {
  return Array.from(new Set(presets.reduce<string[]>((items, preset) => [...items, preset.folder], [])));
}

export function isProductionTrainingPath(pathname: string | null | undefined) {
  return pathname === "/training" || pathname?.startsWith("/training/") === true;
}

export type NewPresetHints = {
  artifact: string;
  category: string;
  folder: string;
  project: string;
  sourceRun: string;
};

export type NewTemplateHints = {
  projectId: string;
  sections: string;
  sourceProject: string;
};

export function readNewPresetHints(search: string) {
  const searchParams = new URLSearchParams(search);
  return {
    artifact: searchParams.get("artifact") ?? "",
    category: searchParams.get("category") ?? "",
    folder: searchParams.get("folder") ?? "",
    project: searchParams.get("project") ?? "",
    sourceRun: searchParams.get("sourceRun") ?? "",
  };
}

export function readNewTemplateHints(search: string): NewTemplateHints {
  const searchParams = new URLSearchParams(search);
  return {
    projectId: searchParams.get("projectId") ?? "",
    sections: searchParams.get("sections") ?? "",
    sourceProject: searchParams.get("sourceProject") ?? "",
  };
}

export function createProjectFromTemplateHref(template: LoraTrainingTemplate) {
  const searchParams = new URLSearchParams({
    sections: String(template.sections.length),
    template: template.title,
    templateId: template.id,
  });
  return `/training/projects/new?${searchParams.toString()}`;
}

import type { DemoData, DemoProject } from "../data/types";
import { rawSectionId } from "./image-status";

export function firstProject(data: DemoData) {
  return data.projects[0];
}

export function firstSection(project: DemoProject | undefined) {
  return project?.sections[0];
}

export function firstRun(data: DemoData) {
  return data.runs[0];
}

export function firstPreset(data: DemoData) {
  return data.categories.flatMap((category) => category.presets)[0];
}

export function firstCategory(data: DemoData) {
  return data.categories[0];
}

export function firstGroup(data: DemoData) {
  return data.categories.flatMap((category) => category.groups)[0];
}

export function firstTemplate(data: DemoData) {
  return data.templates[0];
}

export function findProject(data: DemoData, projectId?: string) {
  return data.projects.find((project) => project.id === projectId) ?? firstProject(data);
}

export function findSection(project: DemoProject | undefined, sectionId?: string) {
  return project?.sections.find((section) => rawSectionId(section) === sectionId || section.id === sectionId) ?? firstSection(project);
}

export function findRun(data: DemoData, runId?: string) {
  return data.runs.find((run) => run.id === runId) ?? firstRun(data);
}

export function findPreset(data: DemoData, presetId?: string) {
  return data.categories.flatMap((category) => category.presets).find((preset) => preset.id === presetId) ?? firstPreset(data);
}

export function findCategory(data: DemoData, categoryId?: string) {
  return data.categories.find((category) => category.id === categoryId) ?? firstCategory(data);
}

export function findGroup(data: DemoData, groupId?: string) {
  return data.categories.flatMap((category) => category.groups).find((group) => group.id === groupId) ?? firstGroup(data);
}

export function findTemplate(data: DemoData, templateId?: string) {
  return data.templates.find((template) => template.id === templateId) ?? firstTemplate(data);
}

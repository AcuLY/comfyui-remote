/**
 * Data facade — re-exports server repository functions for use in page components and API routes.
 *
 * NOTE: This file is an architectural compromise. Ideally `lib/` should not import from `server/`,
 * but this barrel has 48+ importers across the codebase. Moving it to `server/facades/data.ts`
 * would require updating all of them. Tracked as tech debt for a future bulk migration.
 */

// Queue & run data
export {
  getCensoringQueueData,
  getFailedRuns,
  getQueueRuns,
  getQueueRunsPage,
  getReviewGroup,
  getReviewGroupIds,
  getRunningRuns,
} from "@/server/repositories/queue-data-repository";

// Project view data
export { listProjects, listProjectFolders, getProjectDetail, getProjectSectionEditData, getProjectResults, getSectionResults, getProjectFormOptions, getProjectEditData } from "@/server/repositories/project-view-repository";
export type { ProjectDetailSection, ProjectDetail, ProjectSectionFolderItem, ProjectResultsData, SectionResultsData, ProjectFormCategory, ProjectFormOptions, PresetBinding, ProjectEditData, SectionBlockSummary } from "@/server/repositories/project-view-repository";
export { listSectionTrashItems as getSectionTrashItems, listTrashItems as getTrashItems } from "@/server/repositories/trash-repository";

// Preset view data
export {
  getPresetCategoriesWithPresets,
  getPresetLibraryV2,
  getPresetGroupEditData,
  getPresetGroups,
  getPresetGroup,
  getPresetFolders,
  getPresetFolder,
  listPresetSortRuleCategories,
} from "@/server/repositories/preset-view-repository";
export type {
  SlotTemplateDef,
  PresetCategoryItem,
  PresetItem,
  LinkedVariantRef,
  PresetVariantItem,
  FolderItem,
  PresetFolderItem,
  PresetCategoryFull,
  PresetFull,
  PresetLibraryV2,
  PresetGroupItem,
  PresetGroupEditData,
} from "@/server/repositories/preset-view-repository";

// Template view data
export { listProjectTemplates, getProjectTemplateDetail } from "@/server/repositories/template-view-repository";
export type { ProjectTemplateSectionData, ProjectTemplateSectionFolderItem, ProjectTemplateListItem, ProjectTemplateDetail } from "@/server/repositories/template-view-repository";

// Re-export from project-repository
export type { ProjectCreateOptions } from "@/server/repositories/project-repository";

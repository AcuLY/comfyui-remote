export type PromptBlockType = "custom" | "preset";
export type LoraStage = "lora1" | "lora2";

export type LoraBinding = {
  path: string;
  weight: number;
  enabled: boolean;
};

export type ResolvedLoraEntry = LoraBinding & {
  id: string;
  source: "preset" | "manual";
  sourceLabel?: string;
  sourceColor?: string;
  sourceName?: string;
  bindingId?: string;
  groupBindingId?: string;
  detachedBindingId?: string;
  detachedGroupBindingId?: string;
  detachedPresetPath?: string;
  suppressed?: boolean;
};

export type SectionLoraConfig = {
  lora1: ResolvedLoraEntry[];
  lora2: ResolvedLoraEntry[];
};

export type PresetVariantRow = {
  id: string;
  presetId: string;
  preset?: { category?: { type?: string | null } | null } | null;
  name?: string | null;
  prompt: string;
  negativePrompt: string | null;
  lora1: unknown;
  lora2: unknown;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export type PresetVariantMetadataRow = {
  id: string;
  presetId: string;
  name?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export type PresetVariantLinkRow = {
  sourceVariantId: string;
  linkedVariantId: string;
  sortOrder?: number | null;
};

export type PresetCategoryRow = {
  id: string;
  name: string;
  type?: string | null;
  color?: string | null;
  positivePromptOrder?: number | null;
  negativePromptOrder?: number | null;
  lora1Order?: number | null;
  lora2Order?: number | null;
};

export type PresetRow = {
  id: string;
  categoryId: string;
  name: string;
  variants?: PresetVariantMetadataRow[];
};

export type PresetGroupRow = {
  id: string;
  categoryId: string;
  name: string;
};

export type SectionPresetBindingRow = {
  id: string;
  projectSectionId: string;
  bindingKey: string;
  categoryId: string;
  presetId: string | null;
  variantId: string | null;
  presetGroupId?: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
  category: PresetCategoryRow;
  preset: PresetRow | null;
  presetGroup?: PresetGroupRow | null;
};

export type SectionPromptBlockRow = {
  id: string;
  projectSectionId: string;
  sectionBindingId: string | null;
  type: PromptBlockType;
  customLabel: string | null;
  customPositive: string | null;
  customNegative: string | null;
  sortOrder: number;
};

export type SectionManualLoraEntryRow = {
  id: string;
  projectSectionId: string;
  sectionBindingId: string | null;
  stage: string;
  path: string;
  weight: number;
  enabled: boolean;
  detachedFromBindingKey: string | null;
  detachedFromPresetId: string | null;
  detachedFromVariantId: string | null;
  detachedFromPath: string | null;
  metadata: unknown;
  sortOrder: number;
};

export type TemplateSectionPresetBindingRow = {
  id: string;
  projectTemplateSectionId: string;
  bindingKey: string;
  categoryId: string;
  presetId: string | null;
  variantId: string | null;
  presetGroupId?: string | null;
  groupBindingKey: string | null;
  sortOrder: number;
  category: PresetCategoryRow;
  preset: PresetRow | null;
  presetGroup?: PresetGroupRow | null;
};

export type TemplateSectionPromptBlockRow = {
  id: string;
  projectTemplateSectionId: string;
  templateSectionBindingId: string | null;
  type: PromptBlockType;
  customLabel: string | null;
  customPositive: string | null;
  customNegative: string | null;
  sortOrder: number;
};

export type TemplateSectionManualLoraEntryRow = {
  id: string;
  projectTemplateSectionId: string;
  templateSectionBindingId: string | null;
  stage: string;
  path: string;
  weight: number;
  enabled: boolean;
  detachedFromBindingKey: string | null;
  detachedFromPresetId: string | null;
  detachedFromVariantId: string | null;
  detachedFromPath: string | null;
  metadata: unknown;
  sortOrder: number;
};

export type SectionResolverSectionRow = {
  id: string;
  aspectRatio?: string | null;
  aspectRatios?: unknown;
  shortSidePx?: number | null;
  batchSize?: number | null;
  seedPolicy1?: string | null;
  seedPolicy2?: string | null;
  upscaleFactor?: number | null;
  checkpointName?: string | null;
  ksampler1?: unknown;
  ksampler2?: unknown;
  extraParams?: unknown;
  project?: {
    checkpointName?: string | null;
    projectLevelOverrides?: unknown;
  } | null;
};

export type MissingReferenceKind =
  | "preset"
  | "presetGroup"
  | "presetVariant"
  | "sectionBinding"
  | "variantLink";

export type MissingReference = {
  kind: MissingReferenceKind;
  id: string;
  ownerId?: string;
};

export type ResolvedPresetVariantContent = {
  prompt: string;
  negativePrompt: string | null;
  lora1: LoraBinding[];
  lora2: LoraBinding[];
  missingReferences: MissingReference[];
};

export type ResolvePresetVariantContentInput = {
  variants: PresetVariantRow[];
  variantLinks?: PresetVariantLinkRow[];
};

export type ResolvedPromptBlock = {
  type: PromptBlockType | string;
  sourceId: string | null;
  variantId: string | null;
  presetGroupId?: string | null;
  categoryId: string | null;
  bindingId: string | null;
  groupBindingId: string | null;
  label: string;
  positive: string;
  negative: string | null;
  sortOrder: number;
};

export type ResolvedPresetGroupMemberContent = {
  presetId: string;
  variantId: string;
  presetName: string;
  label: string;
  categoryId: string;
  categoryName: string;
  categoryColor?: string | null;
  positivePromptOrder: number;
  negativePromptOrder: number;
  lora1Order: number;
  lora2Order: number;
  prompt: string;
  negativePrompt: string | null;
  lora1: LoraBinding[];
  lora2: LoraBinding[];
};

export type ResolvedPresetGroupContent = {
  groupId: string;
  categoryId: string;
  name: string;
  prompt: string;
  negativePrompt: string | null;
  lora1: LoraBinding[];
  lora2: LoraBinding[];
  members: ResolvedPresetGroupMemberContent[];
  missingReferences: MissingReference[];
};

export type ResolvedSectionConfig = {
  promptBlocks: ResolvedPromptBlock[];
  prompt: {
    positive: string;
    negative: string | null;
  };
  presets: Array<{
    categoryId: string;
    presetId: string;
    variantId: string | null;
    bindingId: string;
    label: string;
  }>;
  loraConfig: SectionLoraConfig;
  parameters: Record<string, unknown>;
  ksampler1: unknown;
  ksampler2: unknown;
  extraParams: unknown;
  warnings: string[];
  missingReferences: MissingReference[];
};

export type ResolveSectionConfigInput = {
  section: SectionResolverSectionRow;
  presetBindings: SectionPresetBindingRow[];
  promptBlockRows: SectionPromptBlockRow[];
  manualLoraEntries: SectionManualLoraEntryRow[];
  presetVariants?: PresetVariantRow[];
  variantLinks?: PresetVariantLinkRow[];
  presetGroupResolutions?: ResolvedPresetGroupContent[];
};

export type TemplateResolverSectionRow = SectionResolverSectionRow;

export type ProjectTemplatePresetBindingRow = {
  id?: string;
  projectTemplateId?: string;
  categoryId: string;
  presetId: string;
  variantId: string | null;
  sortOrder: number;
};

export type ResolveTemplateSectionConfigInput = {
  templateSection: TemplateResolverSectionRow;
  presetBindings: TemplateSectionPresetBindingRow[];
  promptBlockRows: TemplateSectionPromptBlockRow[];
  manualLoraEntries: TemplateSectionManualLoraEntryRow[];
  presetVariants?: PresetVariantRow[];
  variantLinks?: PresetVariantLinkRow[];
  presetGroupResolutions?: ResolvedPresetGroupContent[];
};

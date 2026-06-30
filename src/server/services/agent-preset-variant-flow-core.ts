export type SyncPresetVariantFlowInput = {
  sourceProjectTitle: string;
  targetProjectTitle: string;
  expectedSourceProjectId: string | null;
  expectedTargetProjectId: string | null;
  sourcePresetName: string | null;
  targetPresetName: string | null;
  matchSectionsBy: "name";
  matchVariantsBy: "name";
  dryRun: boolean;
  sampleSectionNumbers: number[] | null;
};

type ProjectChoice = {
  id: string;
  title: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

export type FlowTargetPreset = {
  id: string;
  name: string;
  variants: Array<{ id: string; name: string }>;
};

export type FlowPromptBlock = {
  id: string;
  sourceId: string | null;
  variantId: string | null;
  bindingId: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  presetName?: string | null;
  variantName?: string | null;
  label: string;
  sortOrder: number;
};

export type FlowSectionForVerification = {
  id: string;
  name: string | null;
  sortOrder: number;
  manualLoraEntries: Array<{
    sectionBindingId: string | null;
    enabled: boolean;
  }>;
  loraEntries?: Array<{
    bindingId: string | null | undefined;
    enabled: boolean;
  }>;
  promptBlocks: FlowPromptBlock[];
};

export type FlowDryRunForVerification = {
  plannedUpdateCount: number;
  plan: Array<Record<string, unknown>>;
};

export type BuildFlowVerificationInput = {
  targetPresetName: string;
  verificationDryRun: FlowDryRunForVerification;
  sections: FlowSectionForVerification[];
  targetPreset: FlowTargetPreset;
  sampleSectionNumbers?: number[] | null;
};

export type BuildRoleFlowVerificationInput = {
  verificationDryRun: FlowDryRunForVerification;
  sections: FlowSectionForVerification[];
  sampleSectionNumbers?: number[] | null;
};

function requireStringField(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function optionalStringField(input: Record<string, unknown>, field: string): string | null {
  const value = input[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseSampleSectionNumbers(value: unknown): number[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    throw new Error("sampleSectionNumbers must be an array");
  }
  const parsed = value.map((item, index) => {
    if (!Number.isInteger(item) || item < 1) {
      throw new Error(`sampleSectionNumbers[${index}] must be a positive integer`);
    }
    return item;
  });
  return [...new Set(parsed)];
}

export function parseSyncPresetVariantFlowInput(body: unknown): SyncPresetVariantFlowInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid JSON body");
  }

  const input = body as Record<string, unknown>;
  const matchSectionsBy = input.matchSectionsBy ?? "name";
  const matchVariantsBy = input.matchVariantsBy ?? "name";
  if (matchSectionsBy !== "name") {
    throw new Error('Only matchSectionsBy: "name" is supported');
  }
  if (matchVariantsBy !== "name") {
    throw new Error('Only matchVariantsBy: "name" is supported');
  }

  const rawDryRun = input.dryRun;
  if (rawDryRun !== undefined && typeof rawDryRun !== "boolean") {
    throw new Error("dryRun must be a boolean");
  }
  const expectedSourceProjectId = optionalStringField(input, "expectedSourceProjectId");
  const expectedTargetProjectId = optionalStringField(input, "expectedTargetProjectId");
  if (rawDryRun === false && (!expectedSourceProjectId || !expectedTargetProjectId)) {
    throw new Error("dryRun:false requires expectedSourceProjectId and expectedTargetProjectId");
  }

  return {
    sourceProjectTitle: requireStringField(input, "sourceProjectTitle"),
    targetProjectTitle: requireStringField(input, "targetProjectTitle"),
    expectedSourceProjectId,
    expectedTargetProjectId,
    sourcePresetName: optionalStringField(input, "sourcePresetName"),
    targetPresetName: optionalStringField(input, "targetPresetName"),
    matchSectionsBy,
    matchVariantsBy,
    dryRun: rawDryRun !== false,
    sampleSectionNumbers: parseSampleSectionNumbers(input.sampleSectionNumbers),
  };
}

function timeValue(value: Date | string | undefined): number {
  if (!value) return 0;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function pickLatestProjectByExactTitle<T extends ProjectChoice>(projects: T[], title: string): T {
  const normalizedTitle = title.trim();
  const matches = projects.filter((project) => project.title.trim() === normalizedTitle);
  if (matches.length === 0) {
    throw new Error("PROJECT_TITLE_NOT_FOUND");
  }
  return [...matches].sort((left, right) => {
    const byUpdatedAt = timeValue(right.updatedAt) - timeValue(left.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;
    return timeValue(right.createdAt) - timeValue(left.createdAt);
  })[0];
}

function getTargetBlock(section: FlowSectionForVerification, targetPresetId: string): FlowPromptBlock | null {
  return section.promptBlocks
    .filter((block) => block.sourceId === targetPresetId)
    .sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null;
}

function isRoleCategory(category: { name?: string | null; slug?: string | null }) {
  const normalizedName = (category.name ?? "").trim().toLocaleLowerCase();
  const normalizedSlug = (category.slug ?? "").trim().toLocaleLowerCase();
  return normalizedName === "角色" || ["character", "characters", "role", "roles"].includes(normalizedSlug);
}

function getRoleBlock(section: FlowSectionForVerification): FlowPromptBlock | null {
  return section.promptBlocks
    .filter((block) => isRoleCategory({ name: block.categoryName, slug: block.categorySlug }))
    .sort((left, right) => left.sortOrder - right.sortOrder)[0] ?? null;
}

function hasEnabledLoraForBinding(section: FlowSectionForVerification, bindingId: string) {
  if (section.loraEntries) {
    return section.loraEntries.some((entry) => entry.enabled && entry.bindingId === bindingId);
  }

  return section.manualLoraEntries.some(
    (entry) => entry.enabled && entry.sectionBindingId === bindingId,
  );
}

function defaultSampleSectionNumbers(total: number): number[] {
  if (total <= 0) return [];
  return [...new Set([1, Math.ceil(total / 2), total])];
}

export function buildSyncPresetVariantFlowVerification(input: BuildFlowVerificationInput) {
  const sections = [...input.sections].sort((left, right) => {
    const bySortOrder = left.sortOrder - right.sortOrder;
    if (bySortOrder !== 0) return bySortOrder;
    return left.id.localeCompare(right.id);
  });
  const variantNameById = new Map(input.targetPreset.variants.map((variant) => [variant.id, variant.name]));
  const variantDistribution: Record<string, number> = {};
  const missing: Array<{ sectionId: string; sectionName: string | null; reason: string }> = [];

  for (const section of sections) {
    const block = getTargetBlock(section, input.targetPreset.id);
    if (block?.variantId) {
      const variantName = variantNameById.get(block.variantId) ?? "Unknown variant";
      variantDistribution[variantName] = (variantDistribution[variantName] ?? 0) + 1;
    }

    if (!block?.bindingId) {
      missing.push({
        sectionId: section.id,
        sectionName: section.name,
        reason: "Target preset block not found",
      });
      continue;
    }

    const hasRoleLoraEntry = hasEnabledLoraForBinding(section, block.bindingId);
    if (!hasRoleLoraEntry) {
      missing.push({
        sectionId: section.id,
        sectionName: section.name,
        reason: "Target binding LoRA entry not found in manual LoRA rows",
      });
    }
  }

  const sampleNumbers = input.sampleSectionNumbers?.length
    ? input.sampleSectionNumbers
    : defaultSampleSectionNumbers(sections.length);
  const sampleBlocks = sampleNumbers
    .map((sectionNumber) => {
      const section = sections[sectionNumber - 1];
      if (!section) return null;
      const block = getTargetBlock(section, input.targetPreset.id);
      return {
        sectionNumber,
        sectionId: section.id,
        sectionName: section.name,
        blockId: block?.id ?? null,
        bindingId: block?.bindingId ?? null,
        variantId: block?.variantId ?? null,
        variantName: block?.variantId ? variantNameById.get(block.variantId) ?? null : null,
        label: block?.label ?? null,
      };
    })
    .filter((sample): sample is NonNullable<typeof sample> => sample !== null);

  const plannedUpdateCount = input.verificationDryRun.plannedUpdateCount;
  return {
    passed: plannedUpdateCount === 0 && missing.length === 0,
    plannedUpdateCount,
    plan: input.verificationDryRun.plan,
    variantDistribution,
    loraConfig: {
      totalSections: sections.length,
      okCount: sections.length - missing.length,
      missingCount: missing.length,
      missing,
    },
    sampleBlocks,
  };
}

export function buildRoleSyncPresetVariantFlowVerification(input: BuildRoleFlowVerificationInput) {
  const sections = [...input.sections].sort((left, right) => {
    const bySortOrder = left.sortOrder - right.sortOrder;
    if (bySortOrder !== 0) return bySortOrder;
    return left.id.localeCompare(right.id);
  });
  const variantDistribution: Record<string, number> = {};
  const missing: Array<{ sectionId: string; sectionName: string | null; reason: string }> = [];

  for (const section of sections) {
    const block = getRoleBlock(section);
    if (block?.variantId) {
      const variantName = block.variantName ?? "Unknown variant";
      variantDistribution[variantName] = (variantDistribution[variantName] ?? 0) + 1;
    }

    if (!block?.bindingId) {
      missing.push({
        sectionId: section.id,
        sectionName: section.name,
        reason: "Target role preset block not found",
      });
      continue;
    }

    const hasRoleLoraEntry = hasEnabledLoraForBinding(section, block.bindingId);
    if (!hasRoleLoraEntry) {
      missing.push({
        sectionId: section.id,
        sectionName: section.name,
        reason: "Target role binding LoRA entry not found in manual LoRA rows",
      });
    }
  }

  const sampleNumbers = input.sampleSectionNumbers?.length
    ? input.sampleSectionNumbers
    : defaultSampleSectionNumbers(sections.length);
  const sampleBlocks = sampleNumbers
    .map((sectionNumber) => {
      const section = sections[sectionNumber - 1];
      if (!section) return null;
      const block = getRoleBlock(section);
      return {
        sectionNumber,
        sectionId: section.id,
        sectionName: section.name,
        blockId: block?.id ?? null,
        bindingId: block?.bindingId ?? null,
        variantId: block?.variantId ?? null,
        variantName: block?.variantName ?? null,
        label: block?.label ?? null,
      };
    })
    .filter((sample): sample is NonNullable<typeof sample> => sample !== null);

  const plannedUpdateCount = input.verificationDryRun.plannedUpdateCount;
  return {
    passed: plannedUpdateCount === 0 && missing.length === 0,
    plannedUpdateCount,
    plan: input.verificationDryRun.plan,
    variantDistribution,
    loraConfig: {
      totalSections: sections.length,
      okCount: sections.length - missing.length,
      missingCount: missing.length,
      missing,
    },
    sampleBlocks,
  };
}

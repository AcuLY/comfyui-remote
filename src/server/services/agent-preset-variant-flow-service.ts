import { prisma } from "@/lib/prisma";
import { syncPresetVariants } from "@/server/services/agent-preset-variant-service";
import {
  buildSyncPresetVariantFlowVerification,
  parseSyncPresetVariantFlowInput,
  pickLatestProjectByExactTitle,
  type FlowDryRunForVerification,
  type FlowSectionForVerification,
  type FlowTargetPreset,
} from "@/server/services/agent-preset-variant-flow-core";

type ProjectLookup = {
  id: string;
  title: string;
  updatedAt: Date | string;
  createdAt?: Date | string;
};

type PresetRecord = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: Date;
  category: {
    name: string;
    slug: string;
  };
};

type PresetCandidate = PresetRecord & {
  count: number;
};

function isRoleCategory(category: { name: string; slug: string }) {
  const normalizedName = category.name.trim().toLocaleLowerCase();
  const normalizedSlug = category.slug.trim().toLocaleLowerCase();
  return normalizedName === "角色" || ["character", "characters", "role", "roles"].includes(normalizedSlug);
}

async function findProjectByTitle(title: string, expectedProjectId: string | null, errorPrefix: "SOURCE" | "TARGET"): Promise<ProjectLookup> {
  if (expectedProjectId) {
    const project = await prisma.project.findUnique({
      where: { id: expectedProjectId },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });
    if (!project) {
      throw new Error(`${errorPrefix}_PROJECT_NOT_FOUND`);
    }
    if (project.title.trim() !== title.trim()) {
      throw new Error(`${errorPrefix}_PROJECT_TITLE_MISMATCH`);
    }
    return project;
  }

  const projects = await prisma.project.findMany({
    where: { title },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });
  return pickLatestProjectByExactTitle(projects, title);
}

async function inferPresetNameFromProject(projectId: string, explicitPresetName: string | null, errorPrefix: "SOURCE" | "TARGET") {
  if (explicitPresetName) return explicitPresetName;

  const sections = await prisma.projectSection.findMany({
    where: { projectId, enabled: true },
    select: {
      sectionPromptBlocks: {
        where: {
          sectionBinding: { isNot: null },
        },
        select: {
          sectionBinding: {
            select: { presetId: true },
          },
        },
      },
    },
  });

  const counts = new Map<string, number>();
  for (const section of sections) {
    for (const block of section.sectionPromptBlocks) {
      const presetId = block.sectionBinding?.presetId;
      if (presetId) {
        counts.set(presetId, (counts.get(presetId) ?? 0) + 1);
      }
    }
  }

  const presetIds = [...counts.keys()];
  if (presetIds.length === 0) {
    throw new Error(`${errorPrefix}_ROLE_PRESET_NOT_INFERRED`);
  }

  const presets = await prisma.preset.findMany({
    where: { id: { in: presetIds }, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
    },
  });

  const candidates: PresetCandidate[] = (presets as PresetRecord[]).map((preset) => ({
    ...preset,
    count: counts.get(preset.id) ?? 0,
  }));
  const roleCandidates = candidates.filter((candidate) => isRoleCategory(candidate.category));
  const usableCandidates = roleCandidates.length > 0 ? roleCandidates : candidates;
  if (usableCandidates.length === 0) {
    throw new Error(`${errorPrefix}_ROLE_PRESET_NOT_INFERRED`);
  }

  const sortedCandidates = [...usableCandidates].sort((left, right) => {
    const byCount = right.count - left.count;
    if (byCount !== 0) return byCount;
    const bySortOrder = left.sortOrder - right.sortOrder;
    if (bySortOrder !== 0) return bySortOrder;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  const [picked, runnerUp] = sortedCandidates;
  if (runnerUp && runnerUp.count === picked.count && runnerUp.sortOrder === picked.sortOrder) {
    throw new Error(`${errorPrefix}_ROLE_PRESET_AMBIGUOUS`);
  }

  return picked.name;
}

async function findPresetForVerification(nameOrSlug: string): Promise<FlowTargetPreset> {
  const preset = await prisma.preset.findFirst({
    where: {
      isActive: true,
      OR: [{ name: nameOrSlug }, { slug: nameOrSlug }],
    },
    select: {
      id: true,
      name: true,
      variants: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (!preset) throw new Error("TARGET_PRESET_NOT_FOUND");
  return preset;
}

async function getSectionsForVerification(projectId: string): Promise<FlowSectionForVerification[]> {
  const sections = await prisma.projectSection.findMany({
    where: { projectId, enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      manualLoraEntries: {
        select: {
          sectionBindingId: true,
          enabled: true,
        },
      },
      sectionPromptBlocks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          sectionBindingId: true,
          customLabel: true,
          sectionBinding: {
            select: {
              presetId: true,
              variantId: true,
              preset: { select: { name: true } },
              variant: { select: { name: true } },
            },
          },
          sortOrder: true,
        },
      },
    },
  });

  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    sortOrder: section.sortOrder,
    manualLoraEntries: section.manualLoraEntries,
    promptBlocks: section.sectionPromptBlocks.map((block) => ({
      id: block.id,
      sourceId: block.sectionBinding?.presetId ?? null,
      variantId: block.sectionBinding?.variantId ?? null,
      bindingId: block.sectionBindingId,
      label: block.customLabel ??
        [
          block.sectionBinding?.preset.name,
          block.sectionBinding?.variant?.name,
        ].filter(Boolean).join(" / "),
      sortOrder: block.sortOrder,
    })),
  }));
}

function toVerificationDryRun(result: Awaited<ReturnType<typeof syncPresetVariants>>): FlowDryRunForVerification {
  return {
    plannedUpdateCount: result.plannedUpdateCount,
    plan: result.plan,
  };
}

export async function syncPresetVariantFlow(body: unknown) {
  const input = parseSyncPresetVariantFlowInput(body);
  const [sourceProject, targetProject] = await Promise.all([
    findProjectByTitle(input.sourceProjectTitle, input.expectedSourceProjectId, "SOURCE"),
    findProjectByTitle(input.targetProjectTitle, input.expectedTargetProjectId, "TARGET"),
  ]);
  const [sourcePresetName, targetPresetName] = await Promise.all([
    inferPresetNameFromProject(sourceProject.id, input.sourcePresetName, "SOURCE"),
    inferPresetNameFromProject(targetProject.id, input.targetPresetName, "TARGET"),
  ]);

  const syncBody = {
    sourceProjectId: sourceProject.id,
    sourcePresetName,
    targetPresetName,
    matchSectionsBy: input.matchSectionsBy,
    matchVariantsBy: input.matchVariantsBy,
  };
  const initialDryRun = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: true });

  if (input.dryRun) {
    return {
      dryRun: true,
      sourceProject: { id: sourceProject.id, title: sourceProject.title, updatedAt: sourceProject.updatedAt },
      targetProject: { id: targetProject.id, title: targetProject.title, updatedAt: targetProject.updatedAt },
      sourcePresetName,
      targetPresetName,
      initialDryRun,
    };
  }

  const apply = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: false });
  const verificationDryRun = await syncPresetVariants(targetProject.id, { ...syncBody, dryRun: true });
  const [targetPreset, sections] = await Promise.all([
    findPresetForVerification(targetPresetName),
    getSectionsForVerification(targetProject.id),
  ]);
  const verification = buildSyncPresetVariantFlowVerification({
    targetPresetName,
    verificationDryRun: toVerificationDryRun(verificationDryRun),
    sections,
    targetPreset,
    sampleSectionNumbers: input.sampleSectionNumbers,
  });

  return {
    dryRun: false,
    sourceProject: { id: sourceProject.id, title: sourceProject.title, updatedAt: sourceProject.updatedAt },
    targetProject: { id: targetProject.id, title: targetProject.title, updatedAt: targetProject.updatedAt },
    sourcePresetName,
    targetPresetName,
    initialDryRun,
    apply,
    verificationDryRun,
    verification,
  };
}
